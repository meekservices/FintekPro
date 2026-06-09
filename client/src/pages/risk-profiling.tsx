import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Shield as LucideShield,
	ChevronRight,
	ChevronLeft,
	CheckCircle,
	AlertTriangle,
	Info,
	Clock,
	Target,
	TrendingUp,
	DollarSign,
	Calendar,
	Briefcase,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Question {
	id: number;
	category: string;
	questionText: string;
	questionType: string;
	options: Array<{ value: string; label: string; score: number }>;
	helpText?: string;
	weight: number;
	sebiMandatory: boolean;
	displayOrder: number;
}

interface RiskProfile {
	id: number;
	userId: number;
	panNumber: string;
	riskScore: number;
	riskTier: string;
	tierLabel: string;
	assessmentDate: string;
	validUntil: string;
	categoryScores: Record<string, number>;
	sebiOverrideApplied: boolean;
	sebiOverrideReason?: string;
	originalTier?: string;
}

interface ProductEligibility {
	productType: string;
	isEligible: boolean;
	reason: string;
}

const CATEGORY_ICONS: Record<string, any> = {
	age_demographics: Calendar,
	income_stability: DollarSign,
	net_worth: TrendingUp,
	investment_horizon: Target,
	risk_tolerance: LucideShield,
	investment_experience: Briefcase,
};

const RISK_TIER_COLORS: Record<string, string> = {
	RP1: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
	RP2: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
	RP3: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
	RP4: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
	RP5: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
};

const RISK_TIER_DESCRIPTIONS: Record<string, string> = {
	RP1: "Conservative - Focused on capital preservation with minimal risk",
	RP2: "Moderately Conservative - Prefers stability with some growth potential",
	RP3: "Moderate - Balanced approach between growth and safety",
	RP4: "Moderately Aggressive - Seeks higher returns with acceptance of higher risk",
	RP5: "Aggressive - Maximum growth orientation with high risk tolerance",
};

export default function RiskProfilingPage() {
	const [, setLocation] = useLocation();
	const { toast } = useToast();
	const [currentStep, setCurrentStep] = useState<
		"intro" | "questionnaire" | "review" | "result"
	>("intro");
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [responses, setResponses] = useState<
		Record<number, { selectedOption: string; score: number }>
	>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const { data: questionnaire, isLoading: loadingQuestions } = useQuery<{
		questions: Question[];
		version: string;
	}>({
		queryKey: ["/api/sebi-risk-profiling/questionnaire"],
		enabled: currentStep === "questionnaire" || currentStep === "review",
	});

	const { data: existingProfile, isLoading: loadingProfile } =
		useQuery<RiskProfile>({
			queryKey: ["/api/sebi-risk-profiling/my-profile"],
			retry: false,
		});

	const { data: productEligibility } = useQuery<ProductEligibility[]>({
		queryKey: ["/api/sebi-risk-profiling/product-eligibility"],
		enabled: currentStep === "result" && !!existingProfile,
	});

	const submitAssessmentMutation = useMutation({
		mutationFn: async (data: {
			questionnaireVersion: string;
			responses: Record<number, { selectedOption: string; score: number }>;
		}) => {
			return apiRequest("/api/sebi-risk-profiling/submit-assessment", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/sebi-risk-profiling/my-profile"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/sebi-risk-profiling/product-eligibility"],
			});
			setCurrentStep("result");
			toast({
				title: "Assessment Complete",
				description: "Your risk profile has been calculated and saved.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Submission Failed",
				description:
					error.message || "Failed to submit assessment. Please try again.",
				variant: "destructive",
			});
		},
	});

	const questions = questionnaire?.questions || [];
	const currentQuestion = questions[currentQuestionIndex];
	const totalQuestions = questions.length;
	const progressPercent =
		totalQuestions > 0
			? ((currentQuestionIndex + 1) / totalQuestions) * 100
			: 0;

	const handleOptionSelect = (
		questionId: number,
		optionValue: string,
		score: number,
	) => {
		setResponses((prev) => ({
			...prev,
			[questionId]: { selectedOption: optionValue, score },
		}));
	};

	const handleNext = () => {
		if (currentQuestionIndex < totalQuestions - 1) {
			setCurrentQuestionIndex((prev) => prev + 1);
		} else {
			setCurrentStep("review");
		}
	};

	const handlePrevious = () => {
		if (currentQuestionIndex > 0) {
			setCurrentQuestionIndex((prev) => prev - 1);
		}
	};

	const handleSubmit = async () => {
		if (!questionnaire?.version) return;
		setIsSubmitting(true);
		try {
			await submitAssessmentMutation.mutateAsync({
				questionnaireVersion: questionnaire.version,
				responses,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const groupedQuestions = questions.reduce(
		(acc, q) => {
			if (!acc[q.category]) acc[q.category] = [];
			acc[q.category].push(q);
			return acc;
		},
		{} as Record<string, Question[]>,
	);

	const isCurrentAnswered = currentQuestion
		? !!responses[currentQuestion.id]
		: false;

	const allQuestionsAnswered = questions.every((q) => responses[q.id]);

	if (loadingProfile) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
			</div>
		);
	}

	if (currentStep === "intro") {
		return (
			<div className="container mx-auto py-8 max-w-4xl">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
							<LucideShield className="h-8 w-8 text-primary" />
						</div>
						<CardTitle className="text-2xl">
							SEBI Risk Profiling Assessment
						</CardTitle>
						<CardDescription className="text-base mt-2">
							As per SEBI regulations, all investors must complete a risk
							profiling assessment before investing in securities. This
							assessment helps us understand your investment preferences and
							recommend suitable products.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{existingProfile && (
							<Alert>
								<CheckCircle className="h-4 w-4" />
								<AlertTitle>You Have an Existing Risk Profile</AlertTitle>
								<AlertDescription>
									<div className="mt-2 space-y-2">
										<div className="flex items-center gap-2">
											<Badge
												className={RISK_TIER_COLORS[existingProfile.riskTier]}
											>
												{existingProfile.riskTier} - {existingProfile.tierLabel}
											</Badge>
											<span className="text-sm text-muted-foreground">
												Score: {existingProfile.riskScore}/100
											</span>
										</div>
										<p className="text-sm">
											Valid until:{" "}
											{new Date(
												existingProfile.validUntil,
											).toLocaleDateString()}
										</p>
										{existingProfile.sebiOverrideApplied && (
											<p className="text-sm text-orange-600">
												SEBI Override Applied:{" "}
												{existingProfile.sebiOverrideReason}
											</p>
										)}
										<p className="text-sm text-muted-foreground mt-2">
											You can retake the assessment if your financial situation
											has changed.
										</p>
									</div>
								</AlertDescription>
							</Alert>
						)}

						<div className="grid gap-4 md:grid-cols-2">
							<Card className="border-2 border-primary/20">
								<CardHeader className="pb-2">
									<CardTitle className="text-lg flex items-center gap-2">
										<Clock className="h-5 w-5 text-primary" />
										Duration
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-muted-foreground">
										This assessment takes approximately 5-10 minutes to
										complete.
									</p>
								</CardContent>
							</Card>

							<Card className="border-2 border-primary/20">
								<CardHeader className="pb-2">
									<CardTitle className="text-lg flex items-center gap-2">
										<Target className="h-5 w-5 text-primary" />
										Purpose
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-muted-foreground">
										Your risk profile determines which investment products are
										suitable for you.
									</p>
								</CardContent>
							</Card>
						</div>

						<Separator />

						<div className="space-y-3">
							<h3 className="font-semibold">Assessment Categories:</h3>
							<div className="grid gap-2 md:grid-cols-2">
								{[
									{
										name: "Age & Demographics",
										desc: "Life stage and family responsibilities",
									},
									{
										name: "Income Stability",
										desc: "Source and consistency of income",
									},
									{
										name: "Net Worth",
										desc: "Assets, liabilities, and liquidity",
									},
									{
										name: "Investment Horizon",
										desc: "Time frame for investments",
									},
									{
										name: "Risk Tolerance",
										desc: "Comfort with volatility and losses",
									},
									{
										name: "Investment Experience",
										desc: "Prior knowledge and experience",
									},
								].map((cat, idx) => (
									<div
										key={idx}
										className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
									>
										<Info className="h-4 w-4 mt-0.5 text-primary" />
										<div>
											<p className="font-medium text-sm">{cat.name}</p>
											<p className="text-xs text-muted-foreground">
												{cat.desc}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>

						<Alert
							variant="default"
							className="border-amber-200 bg-amber-50 dark:bg-amber-900/20"
						>
							<AlertTriangle className="h-4 w-4 text-amber-600" />
							<AlertTitle className="text-amber-800 dark:text-amber-200">
								Important Notice
							</AlertTitle>
							<AlertDescription className="text-amber-700 dark:text-amber-300">
								Please answer all questions honestly and accurately. Your
								responses will be used to determine your investment suitability.
								Providing inaccurate information may result in unsuitable
								investment recommendations.
							</AlertDescription>
						</Alert>
					</CardContent>
					<CardFooter className="flex justify-between">
						<Button
							variant="outline"
							onClick={() => setLocation("/portfolio")}
							data-testid="button-back-portfolio"
						>
							Back to Portfolio
						</Button>
						<Button
							onClick={() => setCurrentStep("questionnaire")}
							data-testid="button-start-assessment"
						>
							{existingProfile ? "Retake Assessment" : "Start Assessment"}
							<ChevronRight className="ml-2 h-4 w-4" />
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	if (currentStep === "questionnaire") {
		if (loadingQuestions) {
			return (
				<div className="min-h-screen flex items-center justify-center">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
						<p className="text-muted-foreground">Loading questionnaire...</p>
					</div>
				</div>
			);
		}

		if (!currentQuestion) {
			return (
				<div className="container mx-auto py-8 max-w-4xl">
					<Alert variant="destructive">
						<AlertTriangle className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>
							No questionnaire available. Please contact support.
						</AlertDescription>
					</Alert>
				</div>
			);
		}

		const CategoryIcon =
			CATEGORY_ICONS[currentQuestion.category] || LucideShield;

		return (
			<div className="container mx-auto py-8 max-w-3xl">
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between mb-4">
							<Badge variant="outline" className="capitalize">
								{currentQuestion.category.replace(/_/g, " ")}
							</Badge>
							<span className="text-sm text-muted-foreground">
								Question {currentQuestionIndex + 1} of {totalQuestions}
							</span>
						</div>
						<Progress value={progressPercent} className="h-2" />
						<div className="flex items-center gap-3 mt-6">
							<div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
								<CategoryIcon className="h-6 w-6 text-primary" />
							</div>
							<CardTitle className="text-xl leading-tight">
								{currentQuestion.questionText}
							</CardTitle>
						</div>
						{currentQuestion.helpText && (
							<CardDescription className="mt-3">
								{currentQuestion.helpText}
							</CardDescription>
						)}
						{currentQuestion.sebiMandatory && (
							<Badge variant="secondary" className="mt-2">
								SEBI Mandatory
							</Badge>
						)}
					</CardHeader>
					<CardContent>
						<RadioGroup
							value={responses[currentQuestion.id]?.selectedOption || ""}
							onValueChange={(value) => {
								const option = currentQuestion.options.find(
									(o) => o.value === value,
								);
								if (option) {
									handleOptionSelect(currentQuestion.id, value, option.score);
								}
							}}
							className="space-y-3"
						>
							{currentQuestion.options.map((option, idx) => (
								<div
									key={idx}
									className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
										responses[currentQuestion.id]?.selectedOption ===
										option.value
											? "border-primary bg-primary/5"
											: "hover:bg-muted/50"
									}`}
									onClick={() =>
										handleOptionSelect(
											currentQuestion.id,
											option.value,
											option.score,
										)
									}
									data-testid={`option-${currentQuestion.id}-${idx}`}
								>
									<RadioGroupItem
										value={option.value}
										id={`option-${currentQuestion.id}-${idx}`}
									/>
									<Label
										htmlFor={`option-${currentQuestion.id}-${idx}`}
										className="cursor-pointer flex-1 text-base"
									>
										{option.label}
									</Label>
								</div>
							))}
						</RadioGroup>
					</CardContent>
					<CardFooter className="flex justify-between">
						<Button
							variant="outline"
							onClick={handlePrevious}
							disabled={currentQuestionIndex === 0}
							data-testid="button-previous"
						>
							<ChevronLeft className="mr-2 h-4 w-4" />
							Previous
						</Button>
						<Button
							onClick={handleNext}
							disabled={!isCurrentAnswered}
							data-testid="button-next"
						>
							{currentQuestionIndex === totalQuestions - 1
								? "Review Answers"
								: "Next"}
							<ChevronRight className="ml-2 h-4 w-4" />
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	if (currentStep === "review") {
		return (
			<div className="container mx-auto py-8 max-w-4xl">
				<Card>
					<CardHeader>
						<CardTitle className="text-2xl flex items-center gap-2">
							<CheckCircle className="h-6 w-6 text-primary" />
							Review Your Answers
						</CardTitle>
						<CardDescription>
							Please review your responses before submitting. You can go back to
							change any answer.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{Object.entries(groupedQuestions).map(
							([category, categoryQuestions]) => (
								<div key={category} className="space-y-3">
									<h3 className="font-semibold capitalize text-lg border-b pb-2">
										{category.replace(/_/g, " ")}
									</h3>
									{categoryQuestions.map((q, idx) => {
										const response = responses[q.id];
										const selectedOption = q.options.find(
											(o) => o.value === response?.selectedOption,
										);
										return (
											<div key={q.id} className="p-4 bg-muted/30 rounded-lg">
												<p className="font-medium text-sm mb-2">
													{q.questionText}
												</p>
												<div className="flex items-center justify-between">
													<Badge variant={response ? "default" : "destructive"}>
														{selectedOption?.label || "Not Answered"}
													</Badge>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => {
															setCurrentQuestionIndex(
																questions.findIndex((qu) => qu.id === q.id),
															);
															setCurrentStep("questionnaire");
														}}
														data-testid={`button-edit-${q.id}`}
													>
														Edit
													</Button>
												</div>
											</div>
										);
									})}
								</div>
							),
						)}

						{!allQuestionsAnswered && (
							<Alert variant="destructive">
								<AlertTriangle className="h-4 w-4" />
								<AlertTitle>Incomplete Assessment</AlertTitle>
								<AlertDescription>
									Please answer all questions before submitting.
								</AlertDescription>
							</Alert>
						)}
					</CardContent>
					<CardFooter className="flex justify-between">
						<Button
							variant="outline"
							onClick={() => {
								setCurrentStep("questionnaire");
								setCurrentQuestionIndex(totalQuestions - 1);
							}}
							data-testid="button-back-questions"
						>
							<ChevronLeft className="mr-2 h-4 w-4" />
							Back to Questions
						</Button>
						<Button
							onClick={handleSubmit}
							disabled={!allQuestionsAnswered || isSubmitting}
							data-testid="button-submit-assessment"
						>
							{isSubmitting ? (
								<>
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
									Calculating...
								</>
							) : (
								<>
									Submit Assessment
									<CheckCircle className="ml-2 h-4 w-4" />
								</>
							)}
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	if (currentStep === "result") {
		if (!existingProfile) {
			return (
				<div className="min-h-screen flex items-center justify-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
				</div>
			);
		}

		return (
			<div className="container mx-auto py-8 max-w-4xl space-y-6">
				<Card className="border-2 border-primary/20">
					<CardHeader className="text-center pb-2">
						<div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
							<LucideShield className="h-10 w-10 text-primary" />
						</div>
						<CardTitle className="text-2xl">Your Risk Profile</CardTitle>
						<CardDescription>
							Based on your assessment responses
						</CardDescription>
					</CardHeader>
					<CardContent className="text-center space-y-6">
						<div className="inline-block">
							<Badge
								className={`text-2xl px-6 py-3 ${RISK_TIER_COLORS[existingProfile.riskTier]}`}
							>
								{existingProfile.riskTier} - {existingProfile.tierLabel}
							</Badge>
						</div>

						<div className="max-w-md mx-auto">
							<div className="flex items-center justify-between text-sm mb-2">
								<span>Risk Score</span>
								<span className="font-bold">
									{existingProfile.riskScore}/100
								</span>
							</div>
							<Progress value={existingProfile.riskScore} className="h-3" />
						</div>

						<p className="text-muted-foreground max-w-lg mx-auto">
							{RISK_TIER_DESCRIPTIONS[existingProfile.riskTier]}
						</p>

						{existingProfile.sebiOverrideApplied && (
							<Alert className="max-w-lg mx-auto border-orange-200 bg-orange-50 dark:bg-orange-900/20">
								<AlertTriangle className="h-4 w-4 text-orange-600" />
								<AlertTitle className="text-orange-800 dark:text-orange-200">
									SEBI Override Applied
								</AlertTitle>
								<AlertDescription className="text-orange-700 dark:text-orange-300">
									{existingProfile.sebiOverrideReason}
									{existingProfile.originalTier && (
										<span className="block mt-1">
											Original tier: {existingProfile.originalTier}
										</span>
									)}
								</AlertDescription>
							</Alert>
						)}

						<div className="text-sm text-muted-foreground">
							<p>
								Assessment Date:{" "}
								{new Date(existingProfile.assessmentDate).toLocaleDateString()}
							</p>
							<p>
								Valid Until:{" "}
								{new Date(existingProfile.validUntil).toLocaleDateString()}
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="h-5 w-5" />
							Category Breakdown
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-2">
							{existingProfile.categoryScores &&
								Object.entries(existingProfile.categoryScores).map(
									([category, score]) => {
										const CategoryIcon =
											CATEGORY_ICONS[category] || LucideShield;
										return (
											<div
												key={category}
												className="p-4 bg-muted/30 rounded-lg"
											>
												<div className="flex items-center gap-2 mb-2">
													<CategoryIcon className="h-4 w-4 text-primary" />
													<span className="font-medium capitalize">
														{category.replace(/_/g, " ")}
													</span>
												</div>
												<div className="flex items-center gap-2">
													<Progress
														value={score as number}
														className="h-2 flex-1"
													/>
													<span className="text-sm font-medium w-12 text-right">
														{score as number}%
													</span>
												</div>
											</div>
										);
									},
								)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5" />
							Product Eligibility
						</CardTitle>
						<CardDescription>
							Based on your risk profile, you are eligible for the following
							investment products
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-3 md:grid-cols-2">
							{productEligibility?.map((product, idx) => (
								<div
									key={idx}
									className={`p-4 rounded-lg border-2 ${
										product.isEligible
											? "border-green-200 bg-green-50 dark:bg-green-900/20"
											: "border-red-200 bg-red-50 dark:bg-red-900/20"
									}`}
								>
									<div className="flex items-center justify-between">
										<span className="font-medium">{product.productType}</span>
										{product.isEligible ? (
											<CheckCircle className="h-5 w-5 text-green-600" />
										) : (
											<AlertTriangle className="h-5 w-5 text-red-600" />
										)}
									</div>
									<p className="text-sm text-muted-foreground mt-1">
										{product.reason}
									</p>
								</div>
							)) || (
								<p className="text-muted-foreground col-span-2">
									Loading eligibility...
								</p>
							)}
						</div>
					</CardContent>
				</Card>

				<div className="flex justify-center gap-4">
					<Button
						variant="outline"
						onClick={() => setLocation("/portfolio")}
						data-testid="button-go-portfolio"
					>
						Go to Portfolio
					</Button>
					<Button
						onClick={() => setLocation("/store")}
						data-testid="button-explore-products"
					>
						Explore Products
					</Button>
				</div>
			</div>
		);
	}

	return null;
}
