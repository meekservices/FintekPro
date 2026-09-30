import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	Target,
	Clock,
	Lightbulb,
	CheckCircle2,
	XCircle,
	Award,
	Trophy,
	Sparkles,
	BadgeCheck,
	ExternalLink,
	RotateCcw,
	ChevronLeft,
	ChevronRight,
	GraduationCap,
	Eye,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PracticeQuestion {
	id: string;
	question: string;
	options: string[];
	topic?: string;
	correctIndex?: number;
	explanation?: string;
}

interface TopicDiagnostic {
	topic: string;
	total: number;
	correct: number;
	incorrect: number;
	unanswered: number;
	accuracyPercentage: number;
	status: "Proficient" | "Satisfactory" | "Needs Review";
}

interface TestResult {
	success: boolean;
	courseId: string;
	courseTitle?: string;
	seriesCode?: string;
	scorePercentage: number;
	totalQuestions: number;
	correctCount: number;
	incorrectCount: number;
	unansweredCount: number;
	penaltyPerWrong?: number;
	negativeMarksDeducted?: number;
	grossScore?: number;
	netRawScore?: number;
	passingPercentage: number;
	passed: boolean;
	empanelmentSynced?: boolean;
	certificateNumber?: string;
	topicDiagnostics?: TopicDiagnostic[];
	chapterDiagnostics?: Array<{
		chapter: string;
		score: number;
		total: number;
		passed: boolean;
	}>;
	aiCapsule?: {
		generated: boolean;
		weakTopics: string[];
		summaryNotes: string;
		recommendedAction: string;
	};
	reviews: Array<{
		id: string;
		question: string;
		options: string[];
		selectedOptionIndex: number | null;
		correctOptionIndex: number;
		isCorrect: boolean;
		explanation: string;
		topic: string;
	}>;
}

export default function AgentPracticeTestPage() {
	const [location, setLocation] = useLocation();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	// Parse search/query params from window.location.search or wouter location
	const searchParams = useMemo(() => {
		if (typeof window === "undefined") return new URLSearchParams();
		return new URLSearchParams(window.location.search);
	}, [location]);

	const courseId = searchParams.get("courseId") || "nism-va";
	const paperId = searchParams.get("paper") || searchParams.get("paperId") || "paper-1";
	const initialTestType = (searchParams.get("testType") as "exam" | "practice") || "practice";

	const [testType] = useState<"exam" | "practice">(initialTestType);
	const [showInstantRemarks, setShowInstantRemarks] = useState(true);
	const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
	const [viewMode, setViewMode] = useState<"single" | "all">("single");
	const [answers, setAnswers] = useState<Record<string, number>>({});
	const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
	const [result, setResult] = useState<TestResult | null>(null);

	// Fetch practice test questions
	const queryUrl = useMemo(() => {
		if (courseId === "irdai-posp") {
			return "/api/knowledge-hub/irdai/practice-test";
		}
		let url = `/api/knowledge-hub/nism/courses/${encodeURIComponent(courseId)}/practice-test?testType=${testType}`;
		if (paperId.startsWith("paper-")) {
			url += `&paperId=${encodeURIComponent(paperId)}`;
		} else {
			url += `&mode=${encodeURIComponent(paperId)}`;
		}
		return url;
	}, [courseId, paperId, testType]);

	const { data, isLoading, error, refetch } = useQuery<{
		success: boolean;
		courseId: string;
		courseTitle: string;
		seriesCode: string;
		paperId?: string;
		paperTitle?: string;
		testType?: "exam" | "practice";
		passingPercentage: number;
		durationMinutes?: number;
		timeLimitMinutes?: number;
		questions: PracticeQuestion[];
	}>({
		queryKey: [queryUrl],
		queryFn: async () => {
			const res = await apiRequest("GET", queryUrl);
			return typeof res?.json === "function" ? await res.json() : res;
		},
		refetchOnWindowFocus: false,
	});

	const questions = data?.questions || [];
	const courseTitle = data?.courseTitle || (courseId === "irdai-posp" ? "IRDAI POSP 15-Hour Certification" : "NISM Certification Exam");
	const seriesCode = data?.seriesCode || (courseId === "irdai-posp" ? "IRDAI-POSP" : courseId.toUpperCase());
	const paperTitle = data?.paperTitle || (paperId.startsWith("paper-") ? `Mock ${paperId.toUpperCase()}` : `${paperId} Questions Paper`);
	const passingPercentage = data?.passingPercentage ?? (courseId === "irdai-posp" ? 35 : 60);
	const durationMinutes = testType === "practice" ? 0 : data?.durationMinutes || data?.timeLimitMinutes || 180;

	// Timer logic for exam simulation
	useEffect(() => {
		if (testType === "exam" && durationMinutes > 0 && secondsRemaining === null && !result) {
			setSecondsRemaining(durationMinutes * 60);
		}
	}, [testType, durationMinutes, secondsRemaining, result]);

	useEffect(() => {
		if (testType !== "exam" || secondsRemaining === null || secondsRemaining <= 0 || result) {
			return;
		}
		const timer = setInterval(() => {
			setSecondsRemaining((prev) => {
				if (prev === null || prev <= 1) {
					clearInterval(timer);
					toast({
						title: "Time Expired",
						description: "Your exam simulation time has elapsed. Submitting now...",
						variant: "destructive",
					});
					handleSubmit();
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [testType, secondsRemaining, result]);

	// Evaluation mutation
	const submitMutation = useMutation({
		mutationFn: async () => {
			const submitUrl =
				courseId === "irdai-posp"
					? "/api/knowledge-hub/irdai/practice-test/submit"
					: `/api/knowledge-hub/nism/courses/${encodeURIComponent(courseId)}/practice-test/submit`;
			const res = await apiRequest("POST", submitUrl, {
				answers,
				questionIds: questions.map((q) => q.id),
			});
			return typeof res?.json === "function" ? await res.json() : res;
		},
		onSuccess: (data: TestResult) => {
			setResult(data);
			window.scrollTo({ top: 0, behavior: "smooth" });
			queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/certifications/my"] });
			queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/nism/summary"] });
			if (data.passed) {
				toast({
					title: "Benchmark Cleared! 🎉",
					description: `You scored ${data.scorePercentage}%. Passing criteria: ${data.passingPercentage}%.`,
				});
			} else {
				toast({
					title: "Review Required",
					description: `You scored ${data.scorePercentage}%. Passing criteria: ${data.passingPercentage}%. Review concepts below.`,
					variant: "destructive",
				});
			}
		},
		onError: (err: any) => {
			toast({
				title: "Submission Error",
				description: err.message || "Failed to evaluate scorecard. Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleSubmit = () => {
		if (Object.keys(answers).length === 0) {
			toast({
				title: "No Questions Answered",
				description: "Please attend at least one question before submitting.",
				variant: "destructive",
			});
			return;
		}
		submitMutation.mutate();
	};

	const handleReset = () => {
		setAnswers({});
		setResult(null);
		setActiveQuestionIndex(0);
		if (testType === "exam") {
			setSecondsRemaining(durationMinutes * 60);
		}
		refetch();
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	// Statistics
	const answeredCount = Object.keys(answers).length;
	const totalQuestions = questions.length;
	const rightCount = questions.filter(
		(q) => answers[q.id] !== undefined && q.correctIndex !== undefined && answers[q.id] === q.correctIndex,
	).length;
	const wrongCount = answeredCount - rightCount;
	const currentAccuracy = answeredCount > 0 ? Math.round((rightCount / answeredCount) * 100) : 0;

	const formatTime = (secs: number | null) => {
		if (secs === null) return "--:--";
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	if (isLoading) {
		return (
			<div className="container max-w-6xl mx-auto py-10 px-4 min-h-[70vh] flex flex-col items-center justify-center space-y-4">
				<div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
				<h2 className="text-lg font-bold text-foreground">Preparing Practice Session...</h2>
				<p className="text-xs text-muted-foreground">
					Loading curriculum accredited question bank with statutory rationales and scoring engines.
				</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="container max-w-4xl mx-auto py-12 px-4 text-center space-y-4">
				<div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 max-w-md mx-auto space-y-2">
					<XCircle className="h-8 w-8 text-destructive mx-auto" />
					<h2 className="text-base font-bold text-foreground">Practice Test Unavailable</h2>
					<p className="text-xs text-muted-foreground">
						Could not load question paper. Please verify your connection or try again.
					</p>
					<div className="pt-2 flex items-center justify-center gap-2">
						<Button size="sm" onClick={() => refetch()} className="text-xs">
							Retry Loading
						</Button>
						<Button size="sm" variant="outline" onClick={() => setLocation("/agent/knowledge-hub/certifications")} className="text-xs">
							Back to Hub
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background text-foreground pb-16">
			{/* Top Navigation Bar */}
			<header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border/60 shadow-sm">
				<div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setLocation("/agent/knowledge-hub/certifications")}
							className="text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2.5 h-8"
						>
							<ArrowLeft className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Back to Hub</span>
						</Button>
						<div className="h-4 w-px bg-border/60 hidden sm:block" />
						<div>
							<div className="flex items-center gap-2 flex-wrap">
								<h1 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
									{seriesCode} Practice Test
								</h1>
								<Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
									Passing: {passingPercentage}%
								</Badge>
								{paperTitle && (
									<Badge variant="secondary" className="text-[10px] hidden md:inline-flex">
										{paperTitle}
									</Badge>
								)}
							</div>
							<p className="text-[11px] text-muted-foreground truncate max-w-md hidden sm:block">
								{courseTitle}
							</p>
						</div>
					</div>

					{/* Right Status Controls */}
					<div className="flex items-center gap-3 flex-wrap">
						{/* Mode Badge / Timer */}
						{testType === "practice" ? (
							<Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-1 py-1 px-2.5">
								<Lightbulb className="h-3.5 w-3.5" />
								<span>Tutor Mode • Untimed</span>
							</Badge>
						) : (
							secondsRemaining !== null && !result && (
								<Badge
									variant="outline"
									className={`text-xs font-mono font-bold flex items-center gap-1.5 px-2.5 py-1 ${
										secondsRemaining < 60
											? "border-red-500/60 bg-red-500/15 text-red-400 animate-pulse"
											: secondsRemaining < 180
											? "border-amber-500/60 bg-amber-500/15 text-amber-400"
											: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
									}`}
								>
									<Clock className="h-3.5 w-3.5" />
									{formatTime(secondsRemaining)} Remaining
								</Badge>
							)
						)}

						{/* Instant Remarks Switch */}
						<div className="flex items-center gap-1.5 pl-2 border-l border-border/50">
							<Switch
								id="page-toggle-remarks"
								checked={showInstantRemarks}
								onCheckedChange={setShowInstantRemarks}
								className="scale-75 data-[state=checked]:bg-emerald-600"
							/>
							<Label
								htmlFor="page-toggle-remarks"
								className="text-[11px] text-muted-foreground cursor-pointer select-none hidden sm:inline"
							>
								Instant Remarks & Explanations
							</Label>
						</div>

						{/* Reset */}
						<Button
							variant="outline"
							size="sm"
							onClick={handleReset}
							className="h-8 text-xs border-border/60 hover:bg-muted/40 gap-1 px-2.5"
							title="Restart Session"
						>
							<RotateCcw className="h-3 w-3" />
							<span className="hidden sm:inline">Reset</span>
						</Button>
					</div>
				</div>
			</header>

			{/* Sub-header Scoreboard Strip */}
			{!result && (
				<div className="bg-muted/20 border-b border-border/40 py-2.5">
					<div className="container max-w-7xl mx-auto px-4 flex items-center justify-between gap-3 flex-wrap text-xs">
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground font-medium">Session Scoreboard:</span>
							<span className="text-emerald-400 font-bold flex items-center gap-1">
								<CheckCircle2 className="h-3.5 w-3.5 inline" /> {rightCount} Right
							</span>
							<span className="text-muted-foreground/40">•</span>
							<span className="text-rose-400 font-bold flex items-center gap-1">
								<XCircle className="h-3.5 w-3.5 inline" /> {wrongCount} Wrong
							</span>
							<span className="text-muted-foreground/40">•</span>
							<span className="text-amber-400 font-semibold">
								{answeredCount} of {totalQuestions} Attended ({currentAccuracy}% Accuracy)
							</span>
						</div>

						<div className="flex items-center gap-2">
							<span className="text-muted-foreground text-[11px]">View:</span>
							<div className="inline-flex rounded-md border border-border/50 p-0.5 bg-background">
								<button
									type="button"
									onClick={() => setViewMode("single")}
									className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
										viewMode === "single"
											? "bg-amber-500/20 text-amber-300 font-semibold"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									One by One
								</button>
								<button
									type="button"
									onClick={() => setViewMode("all")}
									className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
										viewMode === "all"
											? "bg-amber-500/20 text-amber-300 font-semibold"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									All Questions
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Main Content Area */}
			<main className="container max-w-7xl mx-auto px-4 py-6">
				{!result ? (
					<div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
						{/* Questions Area (3 columns on lg) */}
						<div className="lg:col-span-3 space-y-6">
							{viewMode === "single" ? (
								// Single Question Focus Mode
								(() => {
									const q = questions[activeQuestionIndex];
									if (!q) return null;
									const isAnswered = answers[q.id] !== undefined;
									const userAnswer = answers[q.id];
									const isCorrect = isAnswered && q.correctIndex !== undefined && userAnswer === q.correctIndex;
									const correctIndex = q.correctIndex ?? 0;
									const correctLetter = String.fromCharCode(65 + correctIndex);
									const correctOptionText = q.options[correctIndex] || "";
									const userLetter = userAnswer !== undefined ? String.fromCharCode(65 + userAnswer) : "";
									const userOptionText = userAnswer !== undefined ? q.options[userAnswer] : "";
									const isRemarkActive = showInstantRemarks && isAnswered;

									let cardBorderClass = "bg-card border-border shadow-sm";
									if (isRemarkActive) {
										cardBorderClass = isCorrect
											? "bg-emerald-950/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
											: "bg-rose-950/20 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.08)]";
									}

									return (
										<div className={`p-6 rounded-2xl border transition-all space-y-5 ${cardBorderClass}`}>
											{/* Question Header */}
											<div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
												<div className="flex items-center gap-2">
													<Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-2.5 py-0.5">
														Question {activeQuestionIndex + 1} of {totalQuestions}
													</Badge>
													{q.topic && (
														<Badge variant="outline" className="text-xs text-muted-foreground border-border/60">
															{q.topic}
														</Badge>
													)}
												</div>
												<span className="text-xs text-muted-foreground font-mono">
													ID: {q.id}
												</span>
											</div>

											{/* Question Text */}
											<h2 className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
												{q.question}
											</h2>

											{/* Options Radio List */}
											<RadioGroup
												value={answers[q.id]?.toString() ?? ""}
												onValueChange={(val) =>
													setAnswers((prev) => ({
														...prev,
														[q.id]: Number(val),
													}))
												}
												className="space-y-2.5 pt-1"
											>
												{q.options.map((opt, optIdx) => {
													const isSelected = userAnswer === optIdx;
													const isThisOptionCorrect = q.correctIndex !== undefined && optIdx === q.correctIndex;
													const optLetter = String.fromCharCode(65 + optIdx);

													let optContainerClass = "border border-border/60 hover:bg-muted/30 bg-muted/10";
													if (isRemarkActive) {
														if (isThisOptionCorrect) {
															optContainerClass = "bg-emerald-500/15 border-2 border-emerald-500 text-emerald-200 font-medium shadow-sm";
														} else if (isSelected && !isThisOptionCorrect) {
															optContainerClass = "bg-rose-500/15 border-2 border-rose-500 text-rose-200 font-medium shadow-sm";
														} else {
															optContainerClass = "opacity-50 border-border/30 hover:opacity-80";
														}
													} else if (isSelected) {
														optContainerClass = "bg-amber-500/15 border border-amber-500/50 text-amber-200 font-medium";
													}

													return (
														<div
															key={optIdx}
															className={`flex items-center space-x-3 py-3 px-4 rounded-xl transition-all ${optContainerClass}`}
														>
															<RadioGroupItem value={optIdx.toString()} id={`focus-q-${q.id}-${optIdx}`} />
															<Label
																htmlFor={`focus-q-${q.id}-${optIdx}`}
																className="text-foreground cursor-pointer text-sm flex-1 flex items-center justify-between gap-3 leading-snug"
															>
																<span className="flex items-center gap-3">
																	<span className="font-mono font-bold text-muted-foreground text-xs min-w-[20px]">
																		{optLetter}.
																	</span>
																	<span>{opt}</span>
																</span>
																{isRemarkActive && isThisOptionCorrect && (
																	<Badge className="bg-emerald-500/30 text-emerald-300 border-emerald-500/50 text-[11px] shrink-0 font-bold px-2 py-0.5">
																		✓ Right Answer
																	</Badge>
																)}
																{isRemarkActive && isSelected && !isThisOptionCorrect && (
																	<Badge className="bg-rose-500/30 text-rose-300 border-rose-500/50 text-[11px] shrink-0 font-bold px-2 py-0.5">
																		✗ Wrong Answer (Your Choice)
																	</Badge>
																)}
															</Label>
														</div>
													);
												})}
											</RadioGroup>

											{/* Immediate Right/Wrong Remark and Concept Explanation */}
											{isRemarkActive && (
												<div className="space-y-3 pt-3">
													{isCorrect ? (
														<div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-sm">
															<CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
															<div>
																<div className="font-bold text-sm uppercase tracking-wide flex items-center gap-1.5 text-emerald-300">
																	✓ Remark: Right Answer!
																</div>
																<p className="text-xs text-emerald-200/90 mt-0.5">
																	Excellent! You accurately selected Option {correctLetter} ({correctOptionText}).
																</p>
															</div>
														</div>
													) : (
														<div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 shadow-sm">
															<XCircle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
															<div>
																<div className="font-bold text-sm uppercase tracking-wide flex items-center gap-1.5 text-rose-400">
																	✗ Remark: Wrong Answer
																</div>
																<p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
																	You selected <span className="font-semibold text-rose-300">Option {userLetter}: {userOptionText}</span>.
																	<br />
																	The correct statutory answer is <span className="font-bold text-emerald-300 underline underline-offset-2">Option {correctLetter}: {correctOptionText}</span>.
																</p>
															</div>
														</div>
													)}

													{/* Concept Explanation Card */}
													<div className="p-5 rounded-xl border bg-gradient-to-br from-card via-card/90 to-amber-500/5 border-amber-500/30 text-xs leading-relaxed space-y-3 shadow-md">
														<div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 flex-wrap">
															<div className="flex items-center gap-2 font-semibold text-amber-300 text-sm">
																<Lightbulb className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
																<span>Concept Explanation & Regulatory Rationale</span>
															</div>
															{q.topic && (
																<Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px]">
																	{q.topic}
																</Badge>
															)}
														</div>
														<p className="text-foreground/90 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-normal">
															{q.explanation || `Option ${correctLetter} is the accredited regulatory answer according to official curriculum standards.`}
														</p>
														<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
															<GraduationCap className="h-3.5 w-3.5 text-blue-400 shrink-0" />
															<span>Core Concept: Understanding this rationale prepares you to answer variant questions in the final examination.</span>
														</div>
													</div>
												</div>
											)}

											{/* Bottom Question Navigation Controls */}
											<div className="flex items-center justify-between gap-3 pt-4 border-t border-border/40">
												<Button
													variant="outline"
													size="sm"
													onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
													disabled={activeQuestionIndex === 0}
													className="text-xs gap-1.5 border-border/60"
												>
													<ChevronLeft className="h-4 w-4" />
													Previous Question
												</Button>

												<div className="flex items-center gap-2">
													<Button
														size="sm"
														variant="outline"
														onClick={() => setViewMode("all")}
														className="text-xs text-muted-foreground hover:text-foreground"
													>
														View All Questions
													</Button>
													{activeQuestionIndex < totalQuestions - 1 ? (
														<Button
															size="sm"
															onClick={() => setActiveQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
															className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium"
														>
															Next Question
															<ChevronRight className="h-4 w-4" />
														</Button>
													) : (
														<Button
															size="sm"
															onClick={handleSubmit}
															disabled={submitMutation.isPending || answeredCount === 0}
															className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
														>
															{submitMutation.isPending ? "Evaluating Scorecard..." : "Submit Examination"}
														</Button>
													)}
												</div>
											</div>
										</div>
									);
								})()
							) : (
								// All Questions Continuous Scroll View
								<div className="space-y-6">
									{questions.map((q, idx) => {
										const isAnswered = answers[q.id] !== undefined;
										const userAnswer = answers[q.id];
										const isCorrect = isAnswered && q.correctIndex !== undefined && userAnswer === q.correctIndex;
										const correctIndex = q.correctIndex ?? 0;
										const correctLetter = String.fromCharCode(65 + correctIndex);
										const correctOptionText = q.options[correctIndex] || "";
										const userLetter = userAnswer !== undefined ? String.fromCharCode(65 + userAnswer) : "";
										const userOptionText = userAnswer !== undefined ? q.options[userAnswer] : "";
										const isRemarkActive = showInstantRemarks && isAnswered;

										let cardBorderClass = "bg-card border-border shadow-sm";
										if (isRemarkActive) {
											cardBorderClass = isCorrect
												? "bg-emerald-950/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
												: "bg-rose-950/20 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.08)]";
										}

										return (
											<div
												key={q.id}
												id={`q-card-${q.id}`}
												className={`p-5 rounded-2xl border transition-all space-y-4 ${cardBorderClass}`}
											>
												<div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2.5">
													<div className="flex items-center gap-2">
														<Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-2 py-0.5">
															Q{idx + 1}
														</Badge>
														{q.topic && (
															<Badge variant="outline" className="text-xs text-muted-foreground border-border/60">
																{q.topic}
															</Badge>
														)}
													</div>
													<button
														type="button"
														onClick={() => {
															setActiveQuestionIndex(idx);
															setViewMode("single");
															window.scrollTo({ top: 0, behavior: "smooth" });
														}}
														className="text-[11px] text-muted-foreground hover:text-amber-400 flex items-center gap-1"
													>
														<Eye className="h-3 w-3" /> Focus View
													</button>
												</div>

												<p className="font-semibold text-foreground text-sm sm:text-base leading-relaxed">
													{q.question}
												</p>

												<RadioGroup
													value={answers[q.id]?.toString() ?? ""}
													onValueChange={(val) =>
														setAnswers((prev) => ({
															...prev,
															[q.id]: Number(val),
														}))
													}
													className="space-y-2 pt-1"
												>
													{q.options.map((opt, optIdx) => {
														const isSelected = userAnswer === optIdx;
														const isThisOptionCorrect = q.correctIndex !== undefined && optIdx === q.correctIndex;
														const optLetter = String.fromCharCode(65 + optIdx);

														let optContainerClass = "border border-border/50 hover:bg-muted/30 bg-muted/10";
														if (isRemarkActive) {
															if (isThisOptionCorrect) {
																optContainerClass = "bg-emerald-500/15 border-2 border-emerald-500 text-emerald-200 font-medium shadow-sm";
															} else if (isSelected && !isThisOptionCorrect) {
																optContainerClass = "bg-rose-500/15 border-2 border-rose-500 text-rose-200 font-medium shadow-sm";
															} else {
																optContainerClass = "opacity-50 border-border/30 hover:opacity-80";
															}
														} else if (isSelected) {
															optContainerClass = "bg-amber-500/15 border border-amber-500/50 text-amber-200 font-medium";
														}

														return (
															<div
																key={optIdx}
																className={`flex items-center space-x-3 py-2.5 px-3.5 rounded-xl transition-all ${optContainerClass}`}
															>
																<RadioGroupItem value={optIdx.toString()} id={`all-q-${q.id}-${optIdx}`} />
																<Label
																	htmlFor={`all-q-${q.id}-${optIdx}`}
																	className="text-foreground cursor-pointer text-xs sm:text-sm flex-1 flex items-center justify-between gap-3 leading-snug"
																>
																	<span className="flex items-center gap-2.5">
																		<span className="font-mono font-bold text-muted-foreground text-xs min-w-[18px]">
																			{optLetter}.
																		</span>
																		<span>{opt}</span>
																	</span>
																	{isRemarkActive && isThisOptionCorrect && (
																		<Badge className="bg-emerald-500/30 text-emerald-300 border-emerald-500/50 text-[10px] shrink-0 font-bold px-2 py-0.5">
																			✓ Right Answer
																		</Badge>
																	)}
																	{isRemarkActive && isSelected && !isThisOptionCorrect && (
																		<Badge className="bg-rose-500/30 text-rose-300 border-rose-500/50 text-[10px] shrink-0 font-bold px-2 py-0.5">
																			✗ Wrong Answer (Your Choice)
																		</Badge>
																	)}
																</Label>
															</div>
														);
													})}
												</RadioGroup>

												{/* Immediate Remark and Concept Card */}
												{isRemarkActive && (
													<div className="space-y-2.5 pt-2">
														{isCorrect ? (
															<div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
																<CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
																<div>
																	<div className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 text-emerald-300">
																		✓ Remark: Right Answer!
																	</div>
																	<p className="text-xs text-emerald-200/90 mt-0.5">
																		Spot on! Option {correctLetter} ({correctOptionText}) is correct.
																	</p>
																</div>
															</div>
														) : (
															<div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300">
																<XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
																<div>
																	<div className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 text-rose-400">
																		✗ Remark: Wrong Answer
																	</div>
																	<p className="text-xs text-rose-200/90 mt-0.5 leading-relaxed">
																		You selected <span className="font-semibold text-rose-300">Option {userLetter}: {userOptionText}</span>.
																		<br />
																		The correct answer is <span className="font-bold text-emerald-300 underline underline-offset-2">Option {correctLetter}: {correctOptionText}</span>.
																	</p>
																</div>
															</div>
														)}

														<div className="p-4 rounded-xl border bg-gradient-to-br from-card via-card/90 to-amber-500/5 border-amber-500/30 text-xs leading-relaxed space-y-2 shadow-sm">
															<div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 flex-wrap">
																<div className="flex items-center gap-2 font-semibold text-amber-300">
																	<Lightbulb className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
																	<span>Concept Explanation & Regulatory Rationale</span>
																</div>
																{q.topic && (
																	<Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px]">
																		{q.topic}
																	</Badge>
																)}
															</div>
															<p className="text-foreground/90 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-normal">
																{q.explanation || `Option ${correctLetter} is the accredited regulatory answer according to official curriculum standards.`}
															</p>
															<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
																<GraduationCap className="h-3.5 w-3.5 text-blue-400 shrink-0" />
																<span>Core Concept: Understanding this rationale prepares you to answer variant questions in the final examination.</span>
															</div>
														</div>
													</div>
												)}
											</div>
										);
									})}

									{/* Bottom Submit Banner */}
									<div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between gap-4 flex-wrap">
										<div>
											<h3 className="font-semibold text-sm text-foreground">Completed Reviewing?</h3>
											<p className="text-xs text-muted-foreground">
												You have answered {answeredCount} of {totalQuestions} questions.
											</p>
										</div>
										<Button
											size="lg"
											onClick={handleSubmit}
											disabled={submitMutation.isPending || answeredCount === 0}
											className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6"
										>
											{submitMutation.isPending ? "Evaluating Scorecard..." : `Submit Exam (${answeredCount}/${totalQuestions})`}
										</Button>
									</div>
								</div>
							)}
						</div>

						{/* Right Sticky Sidebar / Palette */}
						<div className="lg:col-span-1 sticky top-24 space-y-4">
							<Card className="border-border/60 bg-card shadow-md">
								<CardHeader className="pb-3 border-b border-border/40">
									<CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
										<span>Question Palette</span>
										<Badge variant="outline" className="text-[11px] font-mono">
											{answeredCount}/{totalQuestions}
										</Badge>
									</CardTitle>
									<CardDescription className="text-[11px]">
										Click any question number to jump directly.
									</CardDescription>
								</CardHeader>
								<CardContent className="pt-3 space-y-3">
									<div className="grid grid-cols-5 gap-1.5 max-h-[300px] overflow-y-auto pr-1">
										{questions.map((q, qIdx) => {
											const isAnswered = answers[q.id] !== undefined;
											const isCorrect = isAnswered && q.correctIndex !== undefined && answers[q.id] === q.correctIndex;
											const isActive = activeQuestionIndex === qIdx;

											let paletteClass = "bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border/50";
											if (isAnswered) {
												if (showInstantRemarks) {
													paletteClass = isCorrect
														? "bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm ring-1 ring-emerald-400"
														: "bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-sm ring-1 ring-rose-400";
												} else {
													paletteClass = "bg-amber-600 text-white font-bold shadow-sm";
												}
											}

											if (isActive && viewMode === "single") {
												paletteClass += " ring-2 ring-primary ring-offset-2 ring-offset-background";
											}

											return (
												<button
													key={q.id}
													type="button"
													onClick={() => {
														setActiveQuestionIndex(qIdx);
														if (viewMode === "all") {
															const el = document.getElementById(`q-card-${q.id}`);
															if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
														}
													}}
													className={`h-8 rounded-lg text-xs font-mono font-medium transition-all ${paletteClass}`}
													title={`Q${qIdx + 1}: ${isAnswered ? (isCorrect ? "Right Answer" : "Wrong Answer") : "Unanswered"}`}
												>
													{qIdx + 1}
												</button>
											);
										})}
									</div>

									{/* Palette Legend */}
									<div className="pt-2 border-t border-border/30 space-y-1.5 text-[11px] text-muted-foreground">
										<div className="flex items-center justify-between">
											<span className="flex items-center gap-1.5">
												<span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
												Right Answer
											</span>
											<span className="font-mono font-semibold text-emerald-400">{rightCount}</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="flex items-center gap-1.5">
												<span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
												Wrong Answer
											</span>
											<span className="font-mono font-semibold text-rose-400">{wrongCount}</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="flex items-center gap-1.5">
												<span className="h-2.5 w-2.5 rounded-full bg-muted border border-border" />
												Unanswered
											</span>
											<span className="font-mono">{totalQuestions - answeredCount}</span>
										</div>
									</div>

									{/* Action Submission */}
									<Button
										className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-9 mt-2"
										onClick={handleSubmit}
										disabled={submitMutation.isPending || answeredCount === 0}
									>
										{submitMutation.isPending ? "Evaluating Scorecard..." : `Finish Test & View Score`}
									</Button>
								</CardContent>
							</Card>
						</div>
					</div>
				) : (
					// Full Diagnostic Scorecard & Question Review
					<div className="max-w-4xl mx-auto space-y-6">
						{/* Score Header Card */}
						<Card className="border-border/60 bg-card overflow-hidden shadow-xl text-center py-8 px-6">
							{result.passed ? (
								<div className="space-y-3">
									<Trophy className="h-16 w-16 text-amber-400 mx-auto animate-bounce" />
									<h2 className="text-2xl font-bold text-foreground">
										Benchmark Cleared! 🎉
									</h2>
									<p className="text-sm text-muted-foreground max-w-lg mx-auto">
										Congratulations! You scored <strong className="text-emerald-400">{result.scorePercentage}%</strong> against the official passing threshold of {result.passingPercentage}%.
									</p>
									<div className="flex items-center justify-center gap-2 pt-2">
										<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-3 py-1 font-semibold">
											✓ Empanelment Ready & Accredited
										</Badge>
										{result.certificateNumber && (
											<Badge variant="outline" className="border-border text-xs px-3 py-1 font-mono">
												Cert: {result.certificateNumber}
											</Badge>
										)}
									</div>
								</div>
							) : (
								<div className="space-y-3">
									<Target className="h-16 w-16 text-rose-400 mx-auto" />
									<h2 className="text-2xl font-bold text-foreground">
										Review Required
									</h2>
									<p className="text-sm text-muted-foreground max-w-lg mx-auto">
										You scored <strong className="text-rose-400">{result.scorePercentage}%</strong> (Passing requirement: {result.passingPercentage}%). Focus on the weak topics and concept rationales highlighted below.
									</p>
									<Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs px-3 py-1">
										Additional Revision Recommended
									</Badge>
								</div>
							)}

							{/* Key Score Breakdown */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/40 text-left">
								<div className="p-3 rounded-xl bg-muted/20 border border-border/50">
									<p className="text-[10px] text-muted-foreground uppercase font-semibold">Right Answers</p>
									<p className="text-lg font-bold text-emerald-400">{result.correctCount}</p>
								</div>
								<div className="p-3 rounded-xl bg-muted/20 border border-border/50">
									<p className="text-[10px] text-muted-foreground uppercase font-semibold">Wrong Answers</p>
									<p className="text-lg font-bold text-rose-400">{result.incorrectCount}</p>
								</div>
								<div className="p-3 rounded-xl bg-muted/20 border border-border/50">
									<p className="text-[10px] text-muted-foreground uppercase font-semibold">Penalty Deducted</p>
									<p className="text-lg font-bold text-amber-400">-{result.negativeMarksDeducted ?? 0}</p>
								</div>
								<div className="p-3 rounded-xl bg-muted/20 border border-border/50">
									<p className="text-[10px] text-muted-foreground uppercase font-semibold">Net Score</p>
									<p className="text-lg font-bold text-foreground">
										{result.netRawScore ?? result.correctCount} / {result.totalQuestions}
									</p>
								</div>
							</div>
						</Card>

						{/* Empanelment Auto-Sync Alert */}
						{result.passed && (
							<div className="p-4 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
								<div className="space-y-1">
									<div className="flex items-center gap-1.5 font-bold text-emerald-400 text-sm">
										<BadgeCheck className="h-4 w-4 text-emerald-400" />
										Empanelment Readiness Auto-Synced ✓
									</div>
									<p className="text-muted-foreground text-xs leading-relaxed">
										Your benchmark result ({result.scorePercentage}%) is officially recorded in your FintekPro agent profile. You can now book official NISM exam slots or proceed with distributor registration.
									</p>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<Button
										size="sm"
										className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-8"
										onClick={() => window.open("https://certifications.nism.ac.in/", "_blank")}
									>
										Book Exam Slot
										<ExternalLink className="h-3 w-3" />
									</Button>
								</div>
							</div>
						)}

						{/* FASP-AI High-Yield Remediation Capsule */}
						{result.aiCapsule && (
							<div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
								<div className="flex items-center justify-between gap-2 flex-wrap">
									<div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
										<Sparkles className="h-4 w-4" />
										FASP-AI High-Yield Remediation Capsule
									</div>
									<Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px]">
										AI Study Plan
									</Badge>
								</div>
								<div className="text-xs sm:text-sm text-foreground/90 whitespace-pre-line leading-relaxed bg-background/50 p-4 rounded-xl border border-border/40">
									{result.aiCapsule.summaryNotes}
								</div>
								{result.aiCapsule.recommendedAction && (
									<p className="text-xs text-emerald-300 font-medium">
										👉 <strong>Recommended Action:</strong> {result.aiCapsule.recommendedAction}
									</p>
								)}
							</div>
						)}

						{/* Chapter & Topic Diagnostics */}
						{result.topicDiagnostics && result.topicDiagnostics.length > 0 && (
							<Card className="border-border/60 bg-card p-5 space-y-4">
								<div className="flex items-center justify-between">
									<h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
										<Award className="h-4 w-4 text-blue-400" />
										Chapter & Topic Diagnostic Analytics
									</h4>
									<span className="text-xs text-muted-foreground font-mono">
										{result.topicDiagnostics.length} Modules Analyzed
									</span>
								</div>

								<div className="space-y-3">
									{result.topicDiagnostics.map((t) => (
										<div key={t.topic} className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-2 text-xs">
											<div className="flex items-center justify-between gap-2">
												<span className="font-semibold text-foreground">{t.topic}</span>
												<div className="flex items-center gap-2">
													<span className="text-muted-foreground font-mono text-[11px]">
														{t.correct}/{t.total} ({t.accuracyPercentage}%)
													</span>
													<Badge
														variant="outline"
														className={
															t.status === "Proficient"
																? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]"
																: t.status === "Satisfactory"
																? "border-amber-500/40 text-amber-400 bg-amber-500/10 text-[10px]"
																: "border-red-500/40 text-red-400 bg-red-500/10 text-[10px]"
														}
													>
														{t.status}
													</Badge>
												</div>
											</div>
											<Progress value={t.accuracyPercentage} className="h-1.5 bg-muted" />
										</div>
									))}
								</div>
							</Card>
						)}

						{/* Full Detailed Question Reviews */}
						<div className="space-y-4">
							<h3 className="text-sm font-bold text-foreground flex items-center justify-between uppercase tracking-wider">
								<span>Detailed Question Review & Explanations</span>
								<span className="text-xs text-muted-foreground font-normal lowercase">
									({result.correctCount} of {result.totalQuestions} correct)
								</span>
							</h3>

							{result.reviews.map((r, idx) => (
								<div
									key={r.id}
									className={`p-5 rounded-2xl border text-xs sm:text-sm space-y-3 ${
										r.isCorrect
											? "bg-emerald-500/5 border-emerald-500/30"
											: "bg-rose-500/5 border-rose-500/30"
									}`}
								>
									<div className="flex items-start justify-between gap-3">
										<p className="font-semibold text-foreground leading-relaxed">
											<span className="text-amber-400 font-mono mr-1.5">Q{idx + 1}.</span> {r.question}
										</p>
										<Badge
											className={
												r.isCorrect
													? "border-emerald-500/50 text-emerald-300 bg-emerald-500/20 text-[10px] font-semibold shrink-0"
													: "border-rose-500/50 text-rose-300 bg-rose-500/20 text-[10px] font-semibold shrink-0"
											}
										>
											{r.isCorrect ? "✓ Right Answer" : "✗ Wrong Answer"}
										</Badge>
									</div>

									<div className="space-y-1.5 pt-1 text-xs">
										<p className="text-muted-foreground">
											<strong className="text-foreground">Your answer:</strong>{" "}
											<span className={r.isCorrect ? "text-emerald-400 font-medium" : "text-rose-400 font-medium line-through"}>
												{r.selectedOptionIndex !== null ? r.options[r.selectedOptionIndex] : "Unanswered"}
											</span>
										</p>
										{!r.isCorrect && (
											<p className="text-emerald-400 font-medium">
												<strong>Correct answer:</strong> {r.options[r.correctOptionIndex]}
											</p>
										)}
									</div>

									{r.explanation && (
										<div className="p-3.5 rounded-xl bg-card border border-amber-500/30 text-xs text-muted-foreground space-y-1.5">
											<div className="flex items-center gap-1.5 font-semibold text-amber-400">
												<Lightbulb className="h-3.5 w-3.5 shrink-0" />
												<span>Concept Explanation & Rationale:</span>
											</div>
											<p className="text-foreground/90 leading-relaxed">{r.explanation}</p>
										</div>
									)}
								</div>
							))}
						</div>

						{/* Bottom Retake & Navigation Buttons */}
						<div className="flex items-center justify-between gap-3 pt-6 border-t border-border flex-wrap">
							<Button
								variant="outline"
								onClick={handleReset}
								className="text-xs gap-1.5 border-border/60"
							>
								<RotateCcw className="h-3.5 w-3.5" />
								Retake Practice Test
							</Button>
							<Button
								onClick={() => setLocation("/agent/knowledge-hub/certifications")}
								className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
							>
								Back to Certifications Hub
							</Button>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
