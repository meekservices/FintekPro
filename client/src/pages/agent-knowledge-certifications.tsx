import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
	Shield as LucideShield,
	ChevronLeft,
	Award,
	BookOpen,
	CheckCircle2,
	Clock,
	Play,
	Trophy,
	Target,
	Info,
	GraduationCap,
	ExternalLink,
	Sparkles,
	FileText,
	RotateCw,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
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

interface NismCourseProgress {
	courseId: string;
	seriesCode: string;
	title: string;
	category: string;
	cpeCredits: number;
	durationHours: number;
	status: "unregistered" | "enrolled" | "in_progress" | "completed" | "certified";
	progressPercentage: number;
	lastScore?: number | null;
	cpeCreditsEarned: number;
	certificateUrl?: string | null;
	certificateNumber?: string | null;
	enrolledAt: string;
	completedAt?: string | null;
}

interface NismSummary {
	totalEnrolled: number;
	totalCompleted: number;
	totalCpeCredits: number;
	certificationsCount: number;
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
			return "bg-muted/20 text-muted-foreground border-border/30";
		case 1:
			return "bg-blue-500/20 text-blue-400 border-blue-500/30";
		case 2:
			return "bg-purple-500/20 text-purple-400 border-purple-500/30";
		case 3:
			return "bg-amber-500/20 text-amber-400 border-amber-500/30";
		default:
			return "bg-muted/20 text-muted-foreground border-border/30";
	}
};

export default function AgentKnowledgeCertifications() {
	const [activeTab, setActiveTab] = useState("nism");
	const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [quizResult, setQuizResult] = useState<{
		passed: boolean;
		score: number;
	} | null>(null);
	const [launchingCourseId, setLaunchingCourseId] = useState<string | null>(null);
	const { toast } = useToast();

	// Internal Certifications
	const { data: myCerts, isLoading: certsLoading } = useQuery<AgentCertification[]>({
		queryKey: ["/api/knowledge-hub/certifications/my"],
	});

	const { data: quizzes } = useQuery<Quiz[]>({
		queryKey: ["/api/knowledge-hub/quizzes"],
	});

	// NISM LMS Courses & Summary
	const { data: nismCoursesData, isLoading: nismLoading } = useQuery<{ success: boolean; courses: NismCourseProgress[] }>({
		queryKey: ["/api/knowledge-hub/nism/courses"],
	});

	const { data: nismSummaryData } = useQuery<{ success: boolean; summary: NismSummary }>({
		queryKey: ["/api/knowledge-hub/nism/summary"],
	});

	const nismCourses = nismCoursesData?.courses || [];
	const nismSummary = nismSummaryData?.summary || {
		totalEnrolled: 0,
		totalCompleted: 0,
		totalCpeCredits: 0,
		certificationsCount: 0,
	};

	const submitQuizMutation = useMutation({
		mutationFn: async ({
			quizId,
			answers,
		}: { quizId: string; answers: Record<string, string> }) => {
			const response = await apiRequest(
				"POST",
				`/api/knowledge-hub/quizzes/${quizId}/submit`,
				{ answers },
			);
			return response.json();
		},
		onSuccess: (data) => {
			setQuizResult(data);
			queryClient.invalidateQueries({
				queryKey: ["/api/knowledge-hub/certifications/my"],
			});
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

	const handleLaunchNismCourse = async (courseId: string) => {
		try {
			setLaunchingCourseId(courseId);
			const res = await apiRequest("POST", `/api/knowledge-hub/nism/courses/${courseId}/launch`);
			const data = await res.json();
			if (data.success && data.launchUrl) {
				toast({
					title: "Launching NISM LMS...",
					description: "Redirecting via authenticated LTI 1.3 Single Sign-On (SSO).",
				});
				window.open(data.launchUrl, "_blank", "noopener,noreferrer");
				queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/nism/courses"] });
				queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/nism/summary"] });
			} else {
				toast({
					title: "Launch Failed",
					description: data.message || "Could not generate LTI session.",
					variant: "destructive",
				});
			}
		} catch (err: any) {
			toast({
				title: "Launch Error",
				description: err.message,
				variant: "destructive",
			});
		} finally {
			setLaunchingCourseId(null);
		}
	};

	const currentLevel =
		myCerts?.reduce(
			(max, cert) => Math.max(max, cert.certificationLevel),
			-1,
		) ?? -1;

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
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link href="/agent/knowledge-hub">
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground"
						>
							<ChevronLeft className="h-4 w-4 mr-1" />
							Back
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
							<GraduationCap className="h-7 w-7 text-emerald-500" />
							Learning & Certifications
						</h1>
						<p className="text-muted-foreground mt-1">
							SEBI & NISM Accredited E-Learning, Continuing Education (CPE), and Platform Competency
						</p>
					</div>
				</div>

				<Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 px-3 py-1 flex items-center gap-1.5 text-xs">
					<Sparkles className="h-3.5 w-3.5" />
					LTI 1.3 / xAPI LMS Integrated
				</Badge>
			</div>

			{/* NISM KPI Metrics Banner */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card className="bg-card/70 border-border">
					<CardContent className="pt-4 pb-4">
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground uppercase font-medium">Courses Enrolled</p>
							<BookOpen className="h-4 w-4 text-blue-400" />
						</div>
						<p className="text-2xl font-bold text-foreground mt-1">{nismSummary.totalEnrolled}</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">Active LMS modules</p>
					</CardContent>
				</Card>

				<Card className="bg-card/70 border-border">
					<CardContent className="pt-4 pb-4">
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground uppercase font-medium">Completed / Certified</p>
							<CheckCircle2 className="h-4 w-4 text-emerald-400" />
						</div>
						<p className="text-2xl font-bold text-emerald-400 mt-1">{nismSummary.totalCompleted}</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">Examinations cleared</p>
					</CardContent>
				</Card>

				<Card className="bg-card/70 border-border">
					<CardContent className="pt-4 pb-4">
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground uppercase font-medium">CPE Credits</p>
							<Award className="h-4 w-4 text-amber-400" />
						</div>
						<p className="text-2xl font-bold text-amber-400 mt-1">{nismSummary.totalCpeCredits} hrs</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">Continuous education</p>
					</CardContent>
				</Card>

				<Card className="bg-card/70 border-border">
					<CardContent className="pt-4 pb-4">
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground uppercase font-medium">Platform Level</p>
							<LucideShield className="h-4 w-4 text-purple-400" />
						</div>
						<p className="text-2xl font-bold text-purple-400 mt-1">
							{currentLevel >= 0 ? `L${currentLevel}` : "L0"}
						</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">FintekPro Tier</p>
					</CardContent>
				</Card>
			</div>

			{/* Main Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
				<TabsList className="bg-card border border-border p-1 w-full max-w-md grid grid-cols-2">
					<TabsTrigger value="nism" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex items-center gap-2">
						<GraduationCap className="h-4 w-4" />
						NISM E-Learning Academy
					</TabsTrigger>
					<TabsTrigger value="internal" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white flex items-center gap-2">
						<LucideShield className="h-4 w-4" />
						Platform Quizzes (L0–L3)
					</TabsTrigger>
				</TabsList>

				{/* TAB 1: NISM E-Learning Academy */}
				<TabsContent value="nism" className="space-y-6">
					<Alert className="bg-emerald-500/10 border-emerald-500/30">
						<Info className="h-4 w-4 text-emerald-400" />
						<AlertTitle className="text-emerald-400">
							Official NISM E-Learning Partner Integration
						</AlertTitle>
						<AlertDescription className="text-emerald-200/90 text-sm">
							Launch official NISM courses directly from FintekPro using <strong>LTI 1.3 Single Sign-On (SSO)</strong>. Course progress, mock quiz completion, and Continuing Professional Education (CPE) hours are synchronized automatically via real-time <strong>xAPI webhooks</strong>.
						</AlertDescription>
					</Alert>

					{nismLoading ? (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{[1, 2, 3, 4].map((i) => (
								<Skeleton key={i} className="h-56 bg-card" />
							))}
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
							{nismCourses.map((course) => {
								const isCompleted = course.status === "completed" || course.status === "certified";
								const isInProgress = course.status === "in_progress" || course.status === "enrolled";

								return (
									<Card key={course.courseId} className="bg-card border-border hover:border-emerald-500/40 transition-colors flex flex-col justify-between">
										<CardHeader className="pb-3">
											<div className="flex items-start justify-between gap-3">
												<div>
													<div className="flex items-center gap-2 mb-1.5 flex-wrap">
														<Badge variant="outline" className="text-xs font-mono font-bold bg-muted/30">
															{course.seriesCode}
														</Badge>
														<Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
															{course.category}
														</Badge>
														{course.cpeCredits > 0 && (
															<Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
																{course.cpeCredits} CPE Credits
															</Badge>
														)}
													</div>
													<CardTitle className="text-base font-semibold text-foreground leading-snug">
														{course.title}
													</CardTitle>
												</div>

												{isCompleted && (
													<Badge className="bg-emerald-600 text-white flex items-center gap-1 shrink-0">
														<CheckCircle2 className="h-3.5 w-3.5" />
														Passed
													</Badge>
												)}
											</div>
											<CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-2">
												Duration: {course.durationHours} hrs estimated. Required for regulatory distributor and advisory compliance.
											</CardDescription>
										</CardHeader>

										<CardContent className="space-y-4 pt-0">
											{/* Progress bar */}
											<div className="space-y-1.5">
												<div className="flex justify-between text-xs">
													<span className="text-muted-foreground">Course Completion</span>
													<span className="font-semibold text-foreground">{course.progressPercentage}%</span>
												</div>
												<Progress value={course.progressPercentage} className="h-2 bg-muted/40" />
											</div>

											{/* Certificate indicator if completed */}
											{course.certificateNumber && (
												<div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
													<span className="text-emerald-300 font-mono">
														Cert: {course.certificateNumber}
													</span>
													<Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
														Verified
													</Badge>
												</div>
											)}

											{/* Action row */}
											<div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
												<Button
													variant="ghost"
													size="sm"
													className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
													onClick={() => {
														window.open(
															"https://www.nism.ac.in/certification-examinations/",
															"_blank",
															"noopener,noreferrer",
														);
													}}
												>
													<FileText className="h-3.5 w-3.5 mr-1" />
													Syllabus
												</Button>

												<Button
													size="sm"
													className={
														isCompleted
															? "bg-muted/40 text-foreground hover:bg-muted/60 h-8"
															: "bg-emerald-600 hover:bg-emerald-700 text-white h-8"
													}
													disabled={launchingCourseId === course.courseId}
													onClick={() => handleLaunchNismCourse(course.courseId)}
												>
													{launchingCourseId === course.courseId ? (
														<>
															<RotateCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
															Connecting...
														</>
													) : isCompleted ? (
														<>
															<ExternalLink className="h-3.5 w-3.5 mr-1.5" />
															Review in LMS
														</>
													) : isInProgress ? (
														<>
															<Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
															Continue Course (SSO)
														</>
													) : (
														<>
															<Sparkles className="h-3.5 w-3.5 mr-1.5" />
															Enroll & Launch
														</>
													)}
												</Button>
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}
				</TabsContent>

				{/* TAB 2: Internal Platform Levels */}
				<TabsContent value="internal" className="space-y-6">
					<Alert className="bg-blue-500/10 border-blue-500/30">
						<Info className="h-4 w-4 text-blue-500" />
						<AlertTitle className="text-blue-400">
							Platform Competency Assessments (L0 to L3)
						</AlertTitle>
						<AlertDescription className="text-blue-200/80 text-sm">
							These optional internal evaluations assess your mastery of FintekPro tools, portfolio rebalancing algorithms, and client proposal generation.
						</AlertDescription>
					</Alert>

					<Card className="bg-background border-border">
						<CardHeader>
							<CardTitle className="text-foreground flex items-center gap-2">
								<Trophy className="h-5 w-5 text-amber-500" />
								Your Platform Level Progress
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-4 mb-4">
								<div className="flex-1">
									<div className="flex items-center justify-between mb-2">
										<span className="text-muted-foreground">Current Level</span>
										<Badge className={getLevelBadgeColor(currentLevel)}>
											{currentLevel >= 0
												? certificationLevels[currentLevel]?.name
												: "None"}
										</Badge>
									</div>
									<Progress
										value={((currentLevel + 1) / 4) * 100}
										className="h-2"
									/>
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
														: "bg-card/50 border border-border"
											}`}
										>
											{isCompleted ? (
												<CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
											) : (
												<Target className="h-5 w-5 text-muted-foreground mx-auto" />
											)}
											<p className="text-xs text-muted-foreground mt-1">
												L{level.level}
											</p>
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>

					{certsLoading ? (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{[1, 2, 3, 4].map((i) => (
								<Skeleton key={i} className="h-48 bg-card" />
							))}
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{certificationLevels.map((level) => {
								const cert = myCerts?.find(
									(c) => c.certificationLevel === level.level,
								);
								const isCompleted = !!cert;
								const canAttempt = currentLevel === level.level - 1;

								return (
									<Card
										key={level.level}
										className={`border-border ${
											isCompleted
												? "bg-emerald-500/5 border-emerald-500/30"
												: canAttempt
													? "bg-card border-blue-500/30"
													: "bg-card/50 opacity-60"
										}`}
									>
										<CardHeader className="pb-2">
											<div className="flex items-center justify-between">
												<Badge className={getLevelBadgeColor(level.level)}>
													Level {level.level}
												</Badge>
												{isCompleted && (
													<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
														<CheckCircle2 className="h-3 w-3 mr-1" />
														Completed
													</Badge>
												)}
											</div>
											<CardTitle className="text-foreground text-lg mt-2">
												{level.name}
											</CardTitle>
											<CardDescription className="text-muted-foreground">
												{level.description}
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											<div>
												<p className="text-xs font-medium text-muted-foreground uppercase mb-2">
													Requirements
												</p>
												<ul className="text-sm space-y-1">
													{level.requirements.map((req, idx) => (
														<li
															key={idx}
															className="flex items-center gap-2 text-muted-foreground"
														>
															<CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
															{req}
														</li>
													))}
												</ul>
											</div>

											{isCompleted && cert && (
												<div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
													{cert.completedAt && (
														<p>
															Completed:{" "}
															{new Date(cert.completedAt).toLocaleDateString()}
														</p>
													)}
													{cert.score && <p>Score: {cert.score}%</p>}
												</div>
											)}

											<div className="pt-2">
												{isCompleted ? (
													<Button
														variant="outline"
														size="sm"
														className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
														onClick={() => startQuiz(level.level)}
													>
														Retake Assessment
													</Button>
												) : canAttempt ? (
													<Button
														size="sm"
														className="w-full bg-blue-600 hover:bg-blue-700"
														onClick={() => startQuiz(level.level)}
													>
														<Play className="h-4 w-4 mr-1" />
														Start Assessment
													</Button>
												) : (
													<Button
														variant="ghost"
														size="sm"
														className="w-full text-muted-foreground"
														disabled
													>
														Complete L{level.level - 1} first
													</Button>
												)}
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* Quiz Dialog */}
			<Dialog
				open={!!selectedQuiz}
				onOpenChange={(open) => !open && setSelectedQuiz(null)}
			>
				<DialogContent className="max-w-2xl bg-card border-border">
					<DialogHeader>
						<DialogTitle className="text-foreground flex items-center gap-2">
							<BookOpen className="h-5 w-5 text-purple-500" />
							{selectedQuiz?.title}
						</DialogTitle>
						<DialogDescription className="text-muted-foreground">
							Passing score: {selectedQuiz?.passingScore}% • Time limit:{" "}
							{selectedQuiz?.timeLimit} minutes
						</DialogDescription>
					</DialogHeader>

					{selectedQuiz && !quizResult && (
						<>
							<div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
								{selectedQuiz.questions.map((q, idx) => (
									<div
										key={q.id}
										className="p-4 rounded-lg bg-background/50 border border-border"
									>
										<p className="font-medium text-foreground mb-3">
											{idx + 1}. {q.question}
										</p>
										<RadioGroup
											value={answers[q.id] || ""}
											onValueChange={(val) =>
												setAnswers((prev) => ({ ...prev, [q.id]: val }))
											}
										>
											{q.options.map((option, optIdx) => (
												<div
													key={optIdx}
													className="flex items-center space-x-2"
												>
													<RadioGroupItem
														value={option}
														id={`${q.id}-${optIdx}`}
													/>
													<Label
														htmlFor={`${q.id}-${optIdx}`}
														className="text-muted-foreground cursor-pointer"
													>
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
									Object.keys(answers).length !==
										selectedQuiz.questions.length ||
									submitQuizMutation.isPending
								}
								onClick={handleSubmitQuiz}
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
									<h3 className="text-2xl font-bold text-foreground mb-2">
										Congratulations! 🎉
									</h3>
									<p className="text-muted-foreground mb-4">
										You passed with a score of {quizResult.score}%
									</p>
									<Badge className="bg-emerald-500/20 text-emerald-400 text-lg px-4 py-2">
										Certification Earned!
									</Badge>
								</>
							) : (
								<>
									<Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
									<h3 className="text-2xl font-bold text-foreground mb-2">
										Keep Learning!
									</h3>
									<p className="text-muted-foreground mb-4">
										You scored {quizResult.score}%. Review the material and try
										again.
									</p>
								</>
							)}
							<Button
								variant="outline"
								className="mt-4 border-border"
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
