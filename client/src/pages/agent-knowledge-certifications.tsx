import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
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
	Lock,
	Timer,
	FileCheck2,
	BadgeCheck,
	Printer,
	Layers,
	HelpCircle,
	RefreshCw,
	ChevronRight,
	Lightbulb,
	XCircle,
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
	passingPercentage?: number;
	examFeeInr?: number;
	syllabusUrl?: string;
	status: "unregistered" | "enrolled" | "in_progress" | "completed" | "certified";
	progressPercentage: number;
	lastScore?: number | null;
	cpeCreditsEarned: number;
	certificateUrl?: string | null;
	certificateNumber?: string | null;
	enrolledAt: string;
	completedAt?: string | null;
	availableMocksCount?: number;
	totalPracticeQuestions?: number;
	negativeMarking?: number;
}

interface NismSummary {
	totalEnrolled: number;
	totalCompleted: number;
	totalCpeCredits: number;
	certificationsCount: number;
}

interface AgentModuleProgress {
	moduleId: string;
	moduleNumber: number;
	title: string;
	category: string;
	requiredMinutes: number;
	minutesSpent: number;
	isCompleted: boolean;
	isUnlocked: boolean;
	lastEngagedAt?: string | null;
}

interface PospTrainingSummary {
	totalRequiredMinutes: number;
	totalMinutesSpent: number;
	hoursCompletedFormatted: string;
	percentageCompleted: number;
	isTrainingCompleted: boolean;
	isExamUnlocked: boolean;
	examStatus: "locked" | "eligible" | "passed" | "failed";
	examScore?: number | null;
	certificateNumber?: string | null;
	certifiedAt?: string | null;
}

interface PospExamQuestion {
	id: string;
	question: string;
	options: string[];
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

/**
 * Bulletproof external window opening helper.
 * Handles popup blocker restrictions (especially in Safari, Chrome & embedded webviews)
 * by falling back to synthetic anchor click if window.open returns null or fails.
 */
const safeOpenUrl = (url?: string, target = "_blank") => {
	if (!url) return;
	try {
		const newWindow = window.open(url, target, "noopener,noreferrer");
		if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
			// Window open was suppressed or blocked by popup blocker; fallback to DOM anchor dispatch
			const link = document.createElement("a");
			link.href = url;
			link.target = target;
			link.rel = "noopener noreferrer";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	} catch {
		// Fallback for strict iframe or security policies
		window.location.assign(url);
	}
};

export default function AgentKnowledgeCertifications() {
	const [, setLocation] = useLocation();
	const [activeTab, setActiveTab] = useState("nism");
	const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [quizResult, setQuizResult] = useState<{
		passed: boolean;
		score: number;
	} | null>(null);
	const [launchingCourseId, setLaunchingCourseId] = useState<string | null>(null);

	// NISM SSO Launch Gateway state
	const [nismLaunchModal, setNismLaunchModal] = useState<{
		isOpen: boolean;
		course: NismCourseProgress | null;
		launchData: {
			launchUrl: string;
			portalUrl: string;
			certificationsUrl: string;
			syllabusUrl?: string;
			idToken?: string;
			state?: string;
			courseId?: string;
			courseTitle?: string;
			seriesCode?: string;
			agentName?: string;
			agentEmail?: string;
			passingPercentage?: number;
			examFeeInr?: number;
			cpeCredits?: number;
		} | null;
	}>({
		isOpen: false,
		course: null,
		launchData: null,
	});

	// NISM Practice Test simulation configuration (150 Qs papers, 100/50/25 Qs modes & Test vs Practice modes)
	const [nismSelectedPaper, setNismSelectedPaper] = useState<string>("paper-1");
	const [nismTestType, setNismTestType] = useState<"exam" | "practice">("practice");

	// IRDAI Exam state
	const [pospExamOpen, setPospExamOpen] = useState(false);
	const [pospQuestions, setPospQuestions] = useState<PospExamQuestion[]>([]);
	const [pospAnswers, setPospAnswers] = useState<Record<string, number>>({});
	const [pospResult, setPospResult] = useState<{
		passed: boolean;
		scorePercentage: number;
		certificateNumber?: string;
		message: string;
	} | null>(null);

	// Spaced Repetition Flashcards state
	const [certFlashcardCategory, setCertFlashcardCategory] = useState("all");
	const [certCardIndex, setCertCardIndex] = useState(0);
	const [certCardFlipped, setCertCardFlipped] = useState(false);

	// NISM Practice Test state
	const [practiceTestModal, setPracticeTestModal] = useState<{
		isOpen: boolean;
		loading: boolean;
		courseId: string | null;
		courseTitle: string;
		seriesCode: string;
		paperId?: string;
		paperTitle?: string;
		testType: "exam" | "practice";
		showInstantRemarks: boolean;
		passingPercentage: number;
		durationMinutes: number;
		secondsRemaining: number | null;
		isTimerRunning: boolean;
		activeQuestionIndex: number;
		questions: Array<{
			id: string;
			question: string;
			options: string[];
			topic: string;
			correctIndex?: number;
			explanation?: string;
		}>;
		answers: Record<string, number>;
		result: {
			success: boolean;
			courseId: string;
			courseTitle?: string;
			seriesCode?: string;
			scorePercentage: number;
			totalQuestions: number;
			correctCount: number;
			incorrectCount: number;
			unansweredCount: number;
			penaltyPerWrong: number;
			negativeMarksDeducted: number;
			grossScore: number;
			netRawScore: number;
			passingPercentage: number;
			passed: boolean;
			empanelmentSynced?: boolean;
			topicDiagnostics: Array<{
				topic: string;
				total: number;
				correct: number;
				incorrect: number;
				unanswered: number;
				accuracyPercentage: number;
				status: "Proficient" | "Satisfactory" | "Needs Review";
			}>;
			aiCapsule: {
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
		} | null;
	}>({
		isOpen: false,
		loading: false,
		courseId: null,
		courseTitle: "",
		seriesCode: "",
		testType: "practice",
		showInstantRemarks: true,
		passingPercentage: 60,
		durationMinutes: 15,
		secondsRemaining: null,
		isTimerRunning: false,
		activeQuestionIndex: 0,
		questions: [],
		answers: {},
		result: null,
	});

	const { toast } = useToast();
	const queryClient = useQueryClient();

	const formatTimeRemaining = (seconds: number | null) => {
		if (seconds === null || seconds === undefined) return "--:--";
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

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

	// IRDAI POSP 15-Hour Modules & Summary
	const { data: irdaiData } = useQuery<{
		success: boolean;
		modules: AgentModuleProgress[];
		summary: PospTrainingSummary;
	}>({
		queryKey: ["/api/knowledge-hub/irdai/modules"],
	});

	// Flashcards query for Revision tab
	const { data: certFlashcardsData } = useQuery<{ success: boolean; flashcards: any[] }>({
		queryKey: ["/api/knowledge-hub/flashcards", certFlashcardCategory],
		queryFn: async () => {
			const res = await apiRequest("GET", `/api/knowledge-hub/flashcards?category=${encodeURIComponent(certFlashcardCategory)}`);
			return typeof res?.json === "function" ? await res.json() : res;
		},
		enabled: activeTab === "flashcards",
	});

	const nismCourses = nismCoursesData?.courses || [];
	const nismSummary = nismSummaryData?.summary || {
		totalEnrolled: 0,
		totalCompleted: 0,
		totalCpeCredits: 0,
		certificationsCount: 0,
	};

	const irdaiModules = irdaiData?.modules || [];
	const irdaiSummary = irdaiData?.summary || {
		totalRequiredMinutes: 900,
		totalMinutesSpent: 0,
		hoursCompletedFormatted: "0.0 / 15.0 hrs",
		percentageCompleted: 0,
		isTrainingCompleted: false,
		isExamUnlocked: false,
		examStatus: "locked" as const,
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
			return typeof response?.json === "function" ? await response.json() : response;
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

	const recordHeartbeatMutation = useMutation({
		mutationFn: async (moduleId: string) => {
			const res = await apiRequest("POST", "/api/knowledge-hub/irdai/heartbeat", { moduleId });
			return typeof res?.json === "function" ? await res.json() : res;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/irdai/modules"] });
			toast({
				title: "Training Time Recorded ✓",
				description: data.message,
			});
		},
	});

	const submitPospExamMutation = useMutation({
		mutationFn: async (answers: Record<string, number>) => {
			const res = await apiRequest("POST", "/api/knowledge-hub/irdai/exam/submit", { answers });
			return typeof res?.json === "function" ? await res.json() : res;
		},
		onSuccess: (data) => {
			setPospResult(data);
			queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/irdai/modules"] });
			queryClient.invalidateQueries({ queryKey: ["/api/agent/empanelment"] });
			if (data.passed) {
				toast({
					title: "POSP Certified! 🎉",
					description: `Certificate ${data.certificateNumber} issued!`,
				});
			} else {
				toast({
					title: "Score Under 35%",
					description: data.message,
					variant: "destructive",
				});
			}
		},
	});

	const handleLaunchNismCourse = async (courseId: string) => {
		try {
			setLaunchingCourseId(courseId);
			const matched = nismCourses.find((c) => c.courseId === courseId);
			const res = await apiRequest("POST", `/api/knowledge-hub/nism/courses/${courseId}/launch`);
			const data = typeof res?.json === "function" ? await res.json() : res;
			if (data?.success) {
				toast({
					title: "NISM Gateway Ready ✓",
					description: "Session prepared. Choose: Training, Practice Test, or Exam Booking.",
				});

				setNismLaunchModal({
					isOpen: true,
					course: matched || null,
					launchData: data,
				});

				// Note: Does NOT open external page directly, showing dialog box so user can choose action

				queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/nism/courses"] });
				queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/nism/summary"] });
			} else {
				toast({
					title: "Launch Failed",
					description: data?.message || "Could not generate LTI session.",
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

	const handleStartNismPracticeTest = (
		courseId: string,
		paper: string = nismSelectedPaper,
		testType: "exam" | "practice" = nismTestType,
		openInNewTab: boolean = false,
	) => {
		setNismLaunchModal((prev) => ({ ...prev, isOpen: false }));
		const targetUrl = `/agent/knowledge-hub/practice-test?courseId=${encodeURIComponent(courseId)}&paper=${encodeURIComponent(paper)}&testType=${encodeURIComponent(testType)}`;
		if (openInNewTab) {
			window.open(targetUrl, "_blank");
		} else {
			setLocation(targetUrl);
		}
	};

	const submitPracticeTestMutation = useMutation({
		mutationFn: async ({
			courseId,
			answers,
			questionIds,
		}: {
			courseId: string;
			answers: Record<string, number>;
			questionIds?: string[];
		}) => {
			const url =
				courseId === "irdai-posp"
					? "/api/knowledge-hub/irdai/practice-test/submit"
					: `/api/knowledge-hub/nism/courses/${courseId}/practice-test/submit`;
			const res = await apiRequest("POST", url, { answers, questionIds });
			return typeof res?.json === "function" ? await res.json() : res;
		},
		onSuccess: (data) => {
			setPracticeTestModal((prev) => ({
				...prev,
				result: data,
				isTimerRunning: false,
			}));
			if (data.passed) {
				toast({
					title: "Practice Test Cleared! 🎉",
					description: `You scored ${data.scorePercentage}% (Passing benchmark: ${data.passingPercentage}%). Performance recorded!`,
				});
				queryClient.invalidateQueries({ queryKey: ["/api/agent-empanelment/me"] });
				queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/nism/courses"] });
				queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/irdai/modules"] });
			} else {
				toast({
					title: "Score Below Benchmark",
					description: `You scored ${data.scorePercentage}%. Review the answer rationales below!`,
					variant: "destructive",
				});
			}
		},
		onError: (err: any) => {
			toast({
				title: "Submission Error",
				description: err.message || "Failed to evaluate practice test.",
				variant: "destructive",
			});
		},
	});

	const handlePrintScorecard = () => {
		const res: any = practiceTestModal.result;
		if (!res) return;

		const printWindow = window.open("", "_blank", "width=850,height=950");
		if (!printWindow) {
			window.print();
			return;
		}

		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<title>FintekPro Regulatory Assessment Scorecard - ${practiceTestModal.seriesCode}</title>
				<style>
					body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #111; line-height: 1.5; }
					.header { border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
					.logo { font-size: 22px; font-weight: 800; color: #059669; letter-spacing: -0.5px; }
					.badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
					.badge-pass { background: #d1fae5; color: #065f46; }
					.badge-fail { background: #fee2e2; color: #991b1b; }
					.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
					.stat-box { border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; background: #f9fafb; text-align: center; }
					.stat-title { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
					.stat-val { font-size: 18px; font-weight: 800; color: #111827; }
					.section { margin-top: 25px; border-top: 1px solid #e5e7eb; padding-top: 15px; }
					.section-title { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
					table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
					th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
					th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; color: #4b5563; }
					.capsule { background: #ecfdf5; border-left: 4px solid #059669; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #064e3b; margin-top: 12px; }
					.footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 15px; }
				</style>
			</head>
			<body>
				<div class="header">
					<div>
						<div class="logo">FINTEKPRO ACADEMY</div>
						<div style="font-size: 13px; color: #4b5563;">Official Regulatory Diagnostics & Performance Scorecard</div>
					</div>
					<div style="text-align: right;">
						<span class="badge ${res.passed ? "badge-pass" : "badge-fail"}">
							${res.passed ? "BENCHMARK CLEARED" : "NEEDS REVISION"}
						</span>
						<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Date: ${new Date().toLocaleDateString("en-IN")}</div>
					</div>
				</div>

				<div style="margin-bottom: 15px;">
					<h2 style="margin: 0 0 4px 0; font-size: 18px;">${practiceTestModal.courseTitle}</h2>
					<div style="font-size: 12px; color: #6b7280;">Curriculum Code: <strong>${practiceTestModal.seriesCode}</strong> • Passing Benchmark: <strong>${res.passingPercentage}%</strong></div>
				</div>

				<div class="grid">
					<div class="stat-box">
						<div class="stat-title">Correct Answers</div>
						<div class="stat-val" style="color: #059669;">+${res.correctCount}</div>
					</div>
					<div class="stat-box">
						<div class="stat-title">Incorrect Penalty</div>
						<div class="stat-val" style="color: #dc2626;">-${res.negativeMarksDeducted ?? 0}</div>
					</div>
					<div class="stat-box">
						<div class="stat-title">Net Raw Score</div>
						<div class="stat-val">${res.netRawScore ?? res.correctCount} / ${res.totalQuestions}</div>
					</div>
					<div class="stat-box">
						<div class="stat-title">Final Percentage</div>
						<div class="stat-val" style="color: ${res.passed ? "#059669" : "#d97706"};">${res.scorePercentage}%</div>
					</div>
				</div>

				${res.aiCapsule || res.aiRemediation ? `
					<div class="section">
						<div class="section-title">FASP-AI Remediation Capsule</div>
						<div class="capsule">
							${res.aiCapsule?.summaryNotes || res.aiRemediation?.summary || "Review targeted weak chapters before official examination."}
						</div>
					</div>
				` : ""}

				${res.topicDiagnostics || res.chapterDiagnostics ? `
					<div class="section">
						<div class="section-title">Chapter Proficiency Breakdown</div>
						<table>
							<thead>
								<tr>
									<th>Chapter / Topic</th>
									<th>Score</th>
									<th>Accuracy</th>
									<th>Proficiency</th>
								</tr>
							</thead>
							<tbody>
								${(res.topicDiagnostics || res.chapterDiagnostics).map((t: any) => `
									<tr>
										<td><strong>${t.topic || t.chapter}</strong></td>
										<td>${t.correct ?? t.score} / ${t.total}</td>
										<td>${t.accuracyPercentage ?? t.percentage}%</td>
										<td>${t.status}</td>
									</tr>
								`).join("")}
							</tbody>
						</table>
					</div>
				` : ""}

				<div class="footer">
					Generated by FintekPro Capital Advisory System (FASP-AI v1.0) • Compliance & Advisory Record.
				</div>
				<script>
					window.onload = function() { window.print(); }
				</script>
			</body>
			</html>
		`;

		printWindow.document.write(html);
		printWindow.document.close();
	};

	// Countdown Timer Hook with Auto-Submission for Practice Test
	useEffect(() => {
		if (!practiceTestModal.isOpen || practiceTestModal.result || !practiceTestModal.isTimerRunning) {
			return;
		}

		if (practiceTestModal.secondsRemaining === null || practiceTestModal.secondsRemaining <= 0) {
			return;
		}

		const timer = setInterval(() => {
			setPracticeTestModal((prev) => {
				if (!prev.isOpen || prev.result || !prev.isTimerRunning || prev.secondsRemaining === null) {
					return prev;
				}

				if (prev.secondsRemaining <= 1) {
					if (prev.courseId && !submitPracticeTestMutation.isPending) {
						submitPracticeTestMutation.mutate({
							courseId: prev.courseId,
							answers: prev.answers,
							questionIds: prev.questions.map((q) => q.id),
						});
						toast({
							title: "Time Expired! Auto-Submitting",
							description: "Your official examination duration has elapsed. Answers submitted automatically.",
						});
					}
					return {
						...prev,
						secondsRemaining: 0,
						isTimerRunning: false,
					};
				}

				return {
					...prev,
					secondsRemaining: prev.secondsRemaining - 1,
				};
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [
		practiceTestModal.isOpen,
		practiceTestModal.result,
		practiceTestModal.isTimerRunning,
		practiceTestModal.courseId,
		submitPracticeTestMutation,
	]);

	const handleStartPospExam = async () => {
		try {
			const res = await apiRequest("GET", "/api/knowledge-hub/irdai/exam/questions");
			const data = typeof res?.json === "function" ? await res.json() : res;
			if (!data.unlocked) {
				toast({
					title: "Exam Locked",
					description: data.message,
					variant: "destructive",
				});
				return;
			}
			setPospQuestions(data.questions || []);
			setPospAnswers({});
			setPospResult(null);
			setPospExamOpen(true);
		} catch (err: any) {
			toast({
				title: "Exam Error",
				description: err.message,
				variant: "destructive",
			});
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

	const handleSubmitPospExam = () => {
		submitPospExamMutation.mutate(pospAnswers);
	};

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between flex-wrap gap-4">
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
							Learning & Regulatory Certifications
						</h1>
						<p className="text-muted-foreground mt-1">
							SEBI (NISM), IRDAI (POSP), and FintekPro Platform Competency Modules
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 px-3 py-1 flex items-center gap-1.5 text-xs">
						<Sparkles className="h-3.5 w-3.5" />
						LTI 1.3 LMS Active
					</Badge>
					<Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 px-3 py-1 flex items-center gap-1.5 text-xs">
						<LucideShield className="h-3.5 w-3.5" />
						IRDAI Compliant
					</Badge>
				</div>
			</div>

			{/* KPI Metrics Banner */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
				<Card className="bg-card/70 border-border">
					<CardContent className="pt-4 pb-4">
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground uppercase font-medium">NISM Enrolled</p>
							<BookOpen className="h-4 w-4 text-blue-400" />
						</div>
						<p className="text-2xl font-bold text-foreground mt-1">{nismSummary.totalEnrolled}</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">Accredited exams</p>
					</CardContent>
				</Card>

				<Card className="bg-card/70 border-border">
					<CardContent className="pt-4 pb-4">
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground uppercase font-medium">IRDAI POSP Hours</p>
							<Timer className="h-4 w-4 text-amber-400" />
						</div>
						<p className="text-2xl font-bold text-amber-400 mt-1">{irdaiSummary.hoursCompletedFormatted.split(" ")[0]} hrs</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">Mandatory 15 hrs</p>
					</CardContent>
				</Card>

				<Card className="bg-card/70 border-border">
					<CardContent className="pt-4 pb-4">
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground uppercase font-medium">CPE Credits</p>
							<Award className="h-4 w-4 text-emerald-400" />
						</div>
						<p className="text-2xl font-bold text-emerald-400 mt-1">{nismSummary.totalCpeCredits} hrs</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">Continuous education</p>
					</CardContent>
				</Card>

				<Card className="bg-card/70 border-border">
					<CardContent className="pt-4 pb-4">
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground uppercase font-medium">Mock Tests Ready</p>
							<Target className="h-4 w-4 text-amber-500" />
						</div>
						<p className="text-2xl font-bold text-amber-500 mt-1">
							{nismCourses.reduce((acc, c) => acc + (c.availableMocksCount || 3), 0)} Mocks
						</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">3 Full papers / subject</p>
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
				<TabsList className="bg-card border border-border p-1 w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4">
					<TabsTrigger value="nism" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex items-center gap-1.5 text-xs sm:text-sm">
						<GraduationCap className="h-4 w-4" />
						NISM Academy
					</TabsTrigger>
					<TabsTrigger value="irdai" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white flex items-center gap-1.5 text-xs sm:text-sm">
						<LucideShield className="h-4 w-4" />
						IRDAI POSP (15-Hr)
					</TabsTrigger>
					<TabsTrigger value="internal" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white flex items-center gap-1.5 text-xs sm:text-sm">
						<Trophy className="h-4 w-4" />
						Platform (L0–L3)
					</TabsTrigger>
					<TabsTrigger value="flashcards" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white flex items-center gap-1.5 text-xs sm:text-sm">
						<Layers className="h-4 w-4" />
						Revision Flashcards
					</TabsTrigger>
				</TabsList>

				{/* TAB 1: NISM E-Learning Academy */}
				<TabsContent value="nism" className="space-y-6">
					<Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100">
						<Info className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
						<AlertTitle className="text-emerald-900 dark:text-emerald-300 font-bold">
							Official NISM E-Learning Partner Integration
						</AlertTitle>
						<AlertDescription className="text-emerald-800 dark:text-emerald-200 text-sm leading-relaxed">
							Launch official NISM courses directly from FintekPro using <strong className="font-semibold text-emerald-950 dark:text-emerald-100">LTI 1.3 Single Sign-On (SSO)</strong>. Course progress, mock quiz completion, and Continuing Professional Education (CPE) hours are synchronized automatically via real-time <strong className="font-semibold text-emerald-950 dark:text-emerald-100">xAPI webhooks</strong>.
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
									<Card key={course.courseId} className="bg-card border-border hover:border-emerald-500/40 transition-colors flex flex-col justify-between shadow-sm">
										<CardHeader className="pb-3">
											<div className="flex items-start justify-between gap-3">
												<div>
													<div className="flex items-center gap-2 mb-1.5 flex-wrap">
														<Badge variant="outline" className="text-xs font-mono font-bold bg-muted/30">
															{course.seriesCode}
														</Badge>
														<Badge className="text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
															{course.category}
														</Badge>
														{course.cpeCredits > 0 && (
															<Badge className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">
																{course.cpeCredits} CPE Credits
															</Badge>
														)}
														<Badge className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1 font-medium">
															<Target className="h-3 w-3 text-amber-600 dark:text-amber-400" />
															{course.availableMocksCount || 3} Mocks Available
														</Badge>
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
											{/* Quick Stats: Hours, Mock Papers, Passing Criteria */}
											<div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
												<div className="flex flex-col">
													<span className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
														<Clock className="h-3 w-3 text-muted-foreground" />
														Est. Study
													</span>
													<span className="font-semibold text-foreground mt-0.5 text-xs">
														{course.durationHours} hrs
													</span>
												</div>
												<div className="flex flex-col border-x border-border/50 px-2">
													<span className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
														<Target className="h-3 w-3 text-amber-500" />
														Mock Papers
													</span>
													<span className="font-semibold text-amber-700 dark:text-amber-400 mt-0.5 text-xs truncate">
														{course.availableMocksCount || 3} Papers ({course.totalPracticeQuestions || 450} Qs)
													</span>
												</div>
												<div className="flex flex-col pl-1">
													<span className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
														<CheckCircle2 className="h-3 w-3 text-emerald-500" />
														Passing
													</span>
													<span className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5 text-xs">
														{course.passingPercentage || 60}% (–0.25 neg)
													</span>
												</div>
											</div>

											<div className="space-y-1.5">
												<div className="flex justify-between text-xs">
													<span className="text-muted-foreground">Course Completion</span>
													<span className="font-semibold text-foreground">{course.progressPercentage}%</span>
												</div>
												<Progress value={course.progressPercentage} className="h-2 bg-muted/40" />
											</div>

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

											<div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
												<Button
													variant="ghost"
													size="sm"
													className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
													onClick={() => {
														safeOpenUrl(
															course.syllabusUrl || "https://www.nism.ac.in/certification-examinations/",
														);
													}}
												>
													<FileText className="h-3.5 w-3.5 mr-1" />
													Syllabus
												</Button>

												<Button
													size="sm"
													variant="outline"
													className="border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 h-8 flex items-center gap-1.5 text-xs font-semibold px-2.5"
													onClick={() => handleStartNismPracticeTest(course.courseId, "paper-1", "practice")}
												>
													<Target className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
													Practice Tests ({course.availableMocksCount || 3})
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

				{/* TAB 2: IRDAI POSP 15-Hour Mandatory Training */}
				<TabsContent value="irdai" className="space-y-6">
					<Alert className="bg-amber-500/10 border-amber-500/30">
						<LucideShield className="h-4 w-4 text-amber-400" />
						<AlertTitle className="text-amber-400">
							IRDAI Statutory 15-Hour POSP Training Guidelines
						</AlertTitle>
						<AlertDescription className="text-amber-200/90 text-sm">
							Per IRDAI Circular IRDA/INT/GDL/GLD/180/08/2015, Point of Sales Persons (POSP) must complete <strong>15 verified hours (900 minutes)</strong> of training before taking the certification examination. Anti-skipping time tracking logs your active learning heartbeat.
						</AlertDescription>
					</Alert>

					{/* Overall Progress Card */}
					<Card className="bg-card border-border">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between flex-wrap gap-2">
								<div>
									<CardTitle className="text-base text-foreground flex items-center gap-2">
										<Timer className="h-5 w-5 text-amber-400" />
										Mandatory 15-Hour POSP Training Progress
									</CardTitle>
									<CardDescription className="text-xs text-muted-foreground mt-1">
										Required: 900 minutes across 6 standardized modules
									</CardDescription>
								</div>

								{irdaiSummary.certificateNumber ? (
									<Badge className="bg-emerald-600 text-white font-mono text-xs px-3 py-1 flex items-center gap-1.5">
										<FileCheck2 className="h-3.5 w-3.5" />
										Cert: {irdaiSummary.certificateNumber}
									</Badge>
								) : irdaiSummary.isExamUnlocked ? (
									<Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-1">
										15 Hours Complete • Exam Unlocked
									</Badge>
								) : (
									<Badge variant="outline" className="text-muted-foreground text-xs">
										{irdaiSummary.hoursCompletedFormatted}
									</Badge>
								)}
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex justify-between text-xs font-medium">
								<span className="text-muted-foreground">Overall Completion</span>
								<span className="text-amber-400">{irdaiSummary.percentageCompleted}% ({irdaiSummary.totalMinutesSpent} / 900 mins)</span>
							</div>
							<Progress value={irdaiSummary.percentageCompleted} className="h-2.5 bg-muted/40" />

							<div className="flex items-center justify-between pt-2 flex-wrap gap-2">
								<p className="text-xs text-muted-foreground">
									{irdaiSummary.isExamUnlocked
										? "✓ You have met the statutory 15-hour requirement. You can now take the POSP Certification Exam."
										: `Complete ${Math.max(0, 900 - irdaiSummary.totalMinutesSpent)} more minutes across modules to unlock the certification exam.`}
								</p>

								<div className="flex items-center gap-2 flex-wrap">
									<Button
										size="sm"
										variant="outline"
										className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs flex items-center gap-1.5"
										onClick={() => handleStartNismPracticeTest("irdai-posp", "all", "practice")}
									>
										<Target className="h-3.5 w-3.5" />
										Take Practice Mock (20 MCQs)
									</Button>

									<Button
										size="sm"
										className={
											irdaiSummary.certificateNumber
												? "bg-emerald-600 hover:bg-emerald-700 text-white"
												: irdaiSummary.isExamUnlocked
													? "bg-amber-600 hover:bg-amber-700 text-white"
													: "bg-muted/40 text-muted-foreground cursor-not-allowed"
										}
										disabled={!irdaiSummary.isExamUnlocked && !irdaiSummary.certificateNumber}
										onClick={handleStartPospExam}
									>
										{irdaiSummary.certificateNumber ? (
											<>
												<CheckCircle2 className="h-4 w-4 mr-1.5" />
												View Certificate
											</>
										) : irdaiSummary.isExamUnlocked ? (
											<>
												<Play className="h-4 w-4 mr-1.5 fill-current" />
												Start POSP Exam (50 MCQs)
											</>
										) : (
											<>
												<Lock className="h-4 w-4 mr-1.5" />
												Exam Locked ({irdaiSummary.hoursCompletedFormatted})
											</>
										)}
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* 6 Modules Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{irdaiModules.map((mod) => (
							<Card key={mod.moduleId} className={`border-border ${mod.isUnlocked ? "bg-card" : "bg-card/40 opacity-70"}`}>
								<CardHeader className="pb-2">
									<div className="flex items-center justify-between gap-2">
										<Badge variant="outline" className="text-xs font-mono bg-muted/20">
											{mod.category}
										</Badge>
										{mod.isCompleted ? (
											<Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
												<CheckCircle2 className="h-3 w-3 mr-1" />
												Completed
											</Badge>
										) : mod.isUnlocked ? (
											<Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs">
												{Math.round((mod.minutesSpent / mod.requiredMinutes) * 100)}%
											</Badge>
										) : (
											<Badge variant="outline" className="text-muted-foreground text-xs flex items-center gap-1">
												<Lock className="h-3 w-3" />
												Locked
											</Badge>
										)}
									</div>
									<CardTitle className="text-sm font-semibold text-foreground mt-1">
										{mod.title}
									</CardTitle>
								</CardHeader>

								<CardContent className="space-y-3 pt-0">
									<div className="space-y-1">
										<div className="flex justify-between text-xs text-muted-foreground">
											<span>Time Logged</span>
											<span>{mod.minutesSpent} / {mod.requiredMinutes} mins ({(mod.requiredMinutes / 60).toFixed(1)} hrs)</span>
										</div>
										<Progress value={Math.min(100, (mod.minutesSpent / mod.requiredMinutes) * 100)} className="h-1.5" />
									</div>

									<div className="flex items-center justify-between pt-1">
										<Button
											size="sm"
											variant="outline"
											className="text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
											disabled={!mod.isUnlocked || recordHeartbeatMutation.isPending}
											onClick={() => recordHeartbeatMutation.mutate(mod.moduleId)}
										>
											<Play className="h-3.5 w-3.5 mr-1" />
											Log Study Hour (+1m)
										</Button>

										<span className="text-[11px] text-muted-foreground">
											{mod.isCompleted ? "Goal achieved" : `${mod.requiredMinutes - mod.minutesSpent}m remaining`}
										</span>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</TabsContent>

				{/* TAB 3: Internal Platform Levels */}
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

				{/* TAB 4: Revision Flashcards */}
				<TabsContent value="flashcards" className="space-y-6">
					<Alert className="bg-teal-500/10 border-teal-500/30">
						<Layers className="h-4 w-4 text-teal-400" />
						<AlertTitle className="text-teal-400">
							Spaced-Repetition Regulatory & Formula Drills
						</AlertTitle>
						<AlertDescription className="text-teal-200/90 text-sm">
							Master high-frequency SEBI mathematical formulas, Budget 2024 taxation changes, and IRDAI statutory rules. Click any card to reveal the statutory rationale and calculation methodology.
						</AlertDescription>
					</Alert>

					<div className="flex flex-wrap gap-2">
						{[
							{ id: "all", label: "All Topics" },
							{ id: "Formulas & Quant", label: "Formulas & Quant" },
							{ id: "Budget 2024 Tax Laws", label: "Budget 2024 Tax" },
							{ id: "IRDAI Compliance", label: "IRDAI Compliance" },
							{ id: "SEBI Code of Conduct", label: "SEBI Conduct" },
						].map((cat) => (
							<Button
								key={cat.id}
								variant={certFlashcardCategory === cat.id ? "default" : "outline"}
								size="sm"
								className="text-xs h-8"
								onClick={() => {
									setCertFlashcardCategory(cat.id);
									setCertCardIndex(0);
									setCertCardFlipped(false);
								}}
							>
								{cat.label}
							</Button>
						))}
					</div>

					{certFlashcardsData?.flashcards && certFlashcardsData.flashcards.length > 0 ? (
						<div className="max-w-2xl mx-auto space-y-4">
							{(() => {
								const card = certFlashcardsData.flashcards[certCardIndex] || certFlashcardsData.flashcards[0];
								return (
									<button
										type="button"
										onClick={() => setCertCardFlipped(!certCardFlipped)}
										className={`min-h-[260px] p-6 rounded-xl border cursor-pointer transition-all duration-300 flex flex-col justify-between select-none text-left w-full ${
											certCardFlipped
												? "bg-teal-950/20 border-teal-500/40 text-foreground shadow-lg shadow-teal-950/20"
												: "bg-card border-border hover:border-teal-500/30"
										}`}
									>
										<div className="flex items-center justify-between">
											<Badge variant="outline" className="text-xs font-semibold bg-muted/20">
												{card.category}
											</Badge>
											<span className="text-xs text-muted-foreground flex items-center gap-1">
												<HelpCircle className="h-3.5 w-3.5 text-teal-400" />
												{certCardFlipped ? "Showing Answer" : "Click card to flip"}
											</span>
										</div>

										<div className="my-6">
											{certCardFlipped ? (
												<div className="space-y-3">
													<p className="text-xs uppercase tracking-wider text-teal-400 font-semibold">
														Statutory Rationale & Solution
													</p>
													<p className="text-sm font-medium text-foreground whitespace-pre-line leading-relaxed">
														{card.answer}
													</p>
													{card.significance && (
														<div className="pt-2.5 border-t border-teal-500/20 text-xs text-muted-foreground">
															<span className="font-semibold text-teal-300">Exam Note: </span>
															{card.significance}
														</div>
													)}
												</div>
											) : (
												<div className="space-y-2">
													<p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
														Core Concept / Problem
													</p>
													<p className="text-base font-semibold text-foreground leading-snug">
														{card.question}
													</p>
												</div>
											)}
										</div>

										<div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/40">
											<span>Card {certCardIndex + 1} of {certFlashcardsData.flashcards.length}</span>
											<span className="text-teal-400 font-medium">Click to flip</span>
										</div>
									</button>
								);
							})()}

							<div className="flex items-center justify-between gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={certCardIndex === 0}
									onClick={() => {
										setCertCardFlipped(false);
										setCertCardIndex((prev) => Math.max(0, prev - 1));
									}}
								>
									<ChevronLeft className="h-4 w-4 mr-1" />
									Previous
								</Button>

								<Button
									variant="secondary"
									size="sm"
									onClick={() => setCertCardFlipped(!certCardFlipped)}
								>
									<RefreshCw className="h-4 w-4 mr-1" />
									{certCardFlipped ? "Show Question" : "Reveal Answer"}
								</Button>

								<Button
									variant="outline"
									size="sm"
									disabled={certCardIndex >= (certFlashcardsData.flashcards.length - 1)}
									onClick={() => {
										setCertCardFlipped(false);
										setCertCardIndex((prev) => Math.min(certFlashcardsData.flashcards.length - 1, prev + 1));
									}}
								>
									Next
									<ChevronRight className="h-4 w-4 ml-1" />
								</Button>
							</div>
						</div>
					) : (
						<div className="py-12 text-center text-sm text-muted-foreground">
							Loading flashcards...
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* IRDAI POSP Exam Dialog */}
			<Dialog open={pospExamOpen} onOpenChange={setPospExamOpen}>
				<DialogContent className="max-w-3xl bg-card border-border">
					<DialogHeader>
						<DialogTitle className="text-foreground flex items-center gap-2">
							<LucideShield className="h-5 w-5 text-amber-400" />
							IRDAI POSP Certification Examination (35% Required)
						</DialogTitle>
						<DialogDescription className="text-muted-foreground">
							IRDA/INT/GDL/GLD/180/08/2015 Guidelines • FintekPro Principal Officer Digital Evaluation
						</DialogDescription>
					</DialogHeader>

					{!pospResult && (
						<div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
							{pospQuestions.map((q, idx) => (
								<div key={q.id} className="p-4 rounded-lg bg-background/50 border border-border">
									<p className="font-medium text-foreground mb-3">
										{idx + 1}. {q.question}
									</p>
									<RadioGroup
										value={pospAnswers[q.id]?.toString() ?? ""}
										onValueChange={(val) =>
											setPospAnswers((prev) => ({ ...prev, [q.id]: Number(val) }))
										}
									>
										{q.options.map((opt, optIdx) => (
											<div key={optIdx} className="flex items-center space-x-2 py-1">
												<RadioGroupItem value={optIdx.toString()} id={`posp-${q.id}-${optIdx}`} />
												<Label htmlFor={`posp-${q.id}-${optIdx}`} className="text-muted-foreground cursor-pointer text-sm">
													{opt}
												</Label>
											</div>
										))}
									</RadioGroup>
								</div>
							))}

							<Button
								className="w-full bg-amber-600 hover:bg-amber-700 text-white"
								disabled={
									Object.keys(pospAnswers).length === 0 ||
									submitPospExamMutation.isPending
								}
								onClick={handleSubmitPospExam}
							>
								{submitPospExamMutation.isPending ? "Evaluating Score..." : "Submit Examination"}
							</Button>
						</div>
					)}

					{pospResult && (
						<div className="text-center py-6">
							{pospResult.passed ? (
								<>
									<Trophy className="h-14 w-14 text-amber-500 mx-auto mb-3" />
									<h3 className="text-2xl font-bold text-foreground mb-1">
										IRDAI POSP Certified! 🎉
									</h3>
									<p className="text-muted-foreground mb-3 text-sm">
										You scored {pospResult.scorePercentage}% (Passing criteria: 35%).
									</p>
									<div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg max-w-md mx-auto mb-4">
										<p className="text-xs text-muted-foreground">Issued Certificate Number:</p>
										<p className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
											{pospResult.certificateNumber}
										</p>
										<p className="text-[11px] text-muted-foreground mt-1">
											Authorized by Principal Officer • Automatically synced to Empanelment Step 3
										</p>
									</div>
								</>
							) : (
								<>
									<Target className="h-14 w-14 text-muted-foreground mx-auto mb-3" />
									<h3 className="text-xl font-bold text-foreground mb-1">
										Examination Not Cleared
									</h3>
									<p className="text-muted-foreground mb-3 text-sm">
										You scored {pospResult.scorePercentage}%. Minimum 35% required to pass.
									</p>
								</>
							)}
							<Button
								variant="outline"
								onClick={() => {
									setPospExamOpen(false);
									setPospResult(null);
								}}
							>
								Close
							</Button>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Internal Quiz Dialog */}
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

			{/* NISM SSO Launch Gateway Dialog */}
			<Dialog
				open={nismLaunchModal.isOpen}
				onOpenChange={(open) =>
					setNismLaunchModal((prev) => ({ ...prev, isOpen: open }))
				}
			>
				<DialogContent className="sm:max-w-2xl bg-card border-border shadow-2xl p-6">
					<DialogHeader className="pb-3 border-b border-border/50">
						<div className="flex items-center gap-2 mb-1">
							<div className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400">
								<GraduationCap className="h-5 w-5" />
							</div>
							<DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
								NISM E-Learning LMS Gateway
								<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-semibold">
									LTI 1.3 SSO
								</Badge>
							</DialogTitle>
						</div>
						<DialogDescription className="text-xs text-muted-foreground">
							Direct Single Sign-On integration with National Institute of Securities Markets (SEBI Mandated)
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						{/* Course Info Banner */}
						<div className="p-3.5 rounded-lg bg-muted/30 border border-border/60 flex flex-col gap-2">
							<div className="flex items-center justify-between gap-2 flex-wrap">
								<Badge variant="outline" className="font-mono font-bold text-xs bg-card">
									{nismLaunchModal.launchData?.seriesCode || nismLaunchModal.course?.seriesCode || "NISM"}
								</Badge>
								<div className="flex items-center gap-2">
									<Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
										{nismLaunchModal.course?.category || "Certification"}
									</Badge>
									{(nismLaunchModal.launchData?.cpeCredits || nismLaunchModal.course?.cpeCredits) && (
										<Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
											{nismLaunchModal.launchData?.cpeCredits || nismLaunchModal.course?.cpeCredits} CPE Credits
										</Badge>
									)}
								</div>
							</div>
							<h4 className="text-sm font-semibold text-foreground">
								{nismLaunchModal.launchData?.courseTitle || nismLaunchModal.course?.title}
							</h4>
							<div className="flex items-center gap-2 text-xs text-emerald-400 font-medium pt-1 border-t border-border/40">
								<CheckCircle2 className="h-3.5 w-3.5" />
								<span>
									Candidate authenticated as {nismLaunchModal.launchData?.agentName || "Advisor"} ({nismLaunchModal.launchData?.agentEmail || "Registered Advisor"})
								</span>
							</div>
						</div>

						{/* Action Portals: 1. Training LMS | 2. Practice Mock Test | 3. Exam Booking */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
							{/* 1. LMS Portal */}
							<div className="p-3.5 rounded-lg bg-card border border-emerald-500/30 flex flex-col justify-between hover:border-emerald-500 transition-colors">
								<div className="space-y-1 mb-3">
									<div className="flex items-center justify-between">
										<span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
											<BookOpen className="h-3.5 w-3.5" />
											eLearning Training
										</span>
										<Badge className="text-[10px] bg-emerald-500/20 text-emerald-300">Live LMS</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										Access official video lectures, slides & syllabus modules in NISM LMS.
									</p>
								</div>
								<Button
									size="sm"
									className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 flex items-center justify-center gap-1.5"
									onClick={() => {
										safeOpenUrl(
											nismLaunchModal.launchData?.portalUrl ||
												"https://online.nism.ac.in/nismlms/",
										);
									}}
								>
									Open Training Portal
									<ExternalLink className="h-3.5 w-3.5" />
								</Button>
							</div>

							{/* 2. Practice Mock Test */}
							<div className="p-3.5 rounded-lg bg-card border border-amber-500/30 flex flex-col justify-between hover:border-amber-500 transition-colors">
								<div className="space-y-2 mb-3">
									<div className="flex items-center justify-between">
										<span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
											<Target className="h-3.5 w-3.5" />
											NISM Practice Examination
										</span>
										<Badge className="text-[10px] bg-amber-500/20 text-amber-300">In-App Simulation</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										Real exam simulation with SEBI 0.25 negative marking or interactive tutor study mode with instant rationales.
									</p>

									{/* Mode Switch (Test Mode vs Practice Mode) */}
									<div className="pt-1">
										<span className="text-[10px] text-muted-foreground font-semibold block mb-1">
											Choose Mode:
										</span>
										<div className="grid grid-cols-2 gap-1.5 text-[11px]">
											<button
												type="button"
												onClick={() => setNismTestType("exam")}
												className={`px-2 py-1.5 rounded border text-left flex flex-col transition-all ${
													nismTestType === "exam"
														? "border-amber-500 bg-amber-500/20 text-amber-300 font-semibold"
														: "border-border/60 hover:border-border text-muted-foreground"
												}`}
											>
												<span className="flex items-center gap-1">
													<Clock className="h-3 w-3" />
													⏱️ Timed Test Mode
												</span>
												<span className="text-[9px] opacity-80">180m • 0.25 Neg Marking</span>
											</button>
											<button
												type="button"
												onClick={() => setNismTestType("practice")}
												className={`px-2 py-1.5 rounded border text-left flex flex-col transition-all ${
													nismTestType === "practice"
														? "border-emerald-500 bg-emerald-500/20 text-emerald-300 font-semibold"
														: "border-border/60 hover:border-border text-muted-foreground"
												}`}
											>
												<span className="flex items-center gap-1">
													<Lightbulb className="h-3 w-3" />
													💡 Practice / Tutor Mode
												</span>
												<span className="text-[9px] opacity-80">Untimed • Instant Rationales</span>
											</button>
										</div>
									</div>

									{/* Question Paper Selection */}
									<div className="pt-1">
										<span className="text-[10px] text-muted-foreground font-semibold block mb-1">
											Select Question Paper (150 Qs Standard):
										</span>
										<div className="grid grid-cols-2 gap-1.5 text-[11px]">
											<button
												type="button"
												onClick={() => setNismSelectedPaper("paper-1")}
												className={`px-2 py-1.5 rounded border text-left flex flex-col transition-all ${
													nismSelectedPaper === "paper-1"
														? "border-amber-500 bg-amber-500/20 text-amber-300 font-semibold"
														: "border-border/60 hover:border-border text-muted-foreground"
												}`}
											>
												<span>📄 Mock Paper 1 (150 Qs)</span>
												<span className="text-[9px] opacity-80">180m • Full Curriculum</span>
											</button>
											<button
												type="button"
												onClick={() => setNismSelectedPaper("paper-2")}
												className={`px-2 py-1.5 rounded border text-left flex flex-col transition-all ${
													nismSelectedPaper === "paper-2"
														? "border-amber-500 bg-amber-500/20 text-amber-300 font-semibold"
														: "border-border/60 hover:border-border text-muted-foreground"
												}`}
											>
												<span>📄 Mock Paper 2 (150 Qs)</span>
												<span className="text-[9px] opacity-80">180m • Case Studies & Calc</span>
											</button>
											<button
												type="button"
												onClick={() => setNismSelectedPaper("paper-3")}
												className={`px-2 py-1.5 rounded border text-left flex flex-col transition-all ${
													nismSelectedPaper === "paper-3"
														? "border-amber-500 bg-amber-500/20 text-amber-300 font-semibold"
														: "border-border/60 hover:border-border text-muted-foreground"
												}`}
											>
												<span>📄 Mock Paper 3 (150 Qs)</span>
												<span className="text-[9px] opacity-80">180m • Tax & Regulatory</span>
											</button>
											<button
												type="button"
												onClick={() => setNismSelectedPaper("100")}
												className={`px-2 py-1.5 rounded border text-left flex flex-col transition-all ${
													nismSelectedPaper === "100"
														? "border-amber-500 bg-amber-500/20 text-amber-300 font-semibold"
														: "border-border/60 hover:border-border text-muted-foreground"
												}`}
											>
												<span>🏆 100 Qs Standard Mock</span>
												<span className="text-[9px] opacity-80">120m • Real Exam Benchmark</span>
											</button>
											<button
												type="button"
												onClick={() => setNismSelectedPaper("50")}
												className={`px-2 py-1.5 rounded border text-left flex flex-col transition-all ${
													nismSelectedPaper === "50"
														? "border-amber-500 bg-amber-500/20 text-amber-300 font-semibold"
														: "border-border/60 hover:border-border text-muted-foreground"
												}`}
											>
												<span>🎯 50 Qs Diagnostic</span>
												<span className="text-[9px] opacity-80">60m • Readiness Check</span>
											</button>
											<button
												type="button"
												onClick={() => setNismSelectedPaper("all")}
												className={`px-2 py-1.5 rounded border text-left flex flex-col transition-all ${
													nismSelectedPaper === "all"
														? "border-amber-500 bg-amber-500/20 text-amber-300 font-semibold"
														: "border-border/60 hover:border-border text-muted-foreground"
												}`}
											>
												<span>📚 Full Question Bank</span>
												<span className="text-[9px] opacity-80">All Accredited Questions</span>
											</button>
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2 mt-1">
									<Button
										size="sm"
										className={`flex-1 text-white text-xs h-9 flex items-center justify-center gap-1.5 ${
											nismTestType === "practice"
												? "bg-emerald-600 hover:bg-emerald-700"
												: "bg-amber-600 hover:bg-amber-700"
										}`}
										onClick={() => {
											const targetCourseId =
												nismLaunchModal.launchData?.courseId ||
												nismLaunchModal.course?.courseId ||
												(nismLaunchModal.course as any)?.id ||
												nismLaunchModal.launchData?.seriesCode?.toLowerCase() ||
												"nism-va";
											handleStartNismPracticeTest(targetCourseId, nismSelectedPaper, nismTestType, false);
										}}
									>
										<Play className="h-3.5 w-3.5 fill-current" />
										Open Full Test Page ({nismSelectedPaper.startsWith("paper-") ? "150 Qs " + nismSelectedPaper.toUpperCase() : nismSelectedPaper + " Qs"})
									</Button>
									<Button
										size="sm"
										variant="outline"
										className="border-border text-xs h-9 px-2.5 flex items-center gap-1 text-muted-foreground hover:text-foreground"
										title="Open in New Tab"
										onClick={() => {
											const targetCourseId =
												nismLaunchModal.launchData?.courseId ||
												nismLaunchModal.course?.courseId ||
												(nismLaunchModal.course as any)?.id ||
												nismLaunchModal.launchData?.seriesCode?.toLowerCase() ||
												"nism-va";
											handleStartNismPracticeTest(targetCourseId, nismSelectedPaper, nismTestType, true);
										}}
									>
										<ExternalLink className="h-3.5 w-3.5" />
										<span className="hidden sm:inline">New Tab</span>
									</Button>
								</div>
							</div>

							{/* 3. Exam Registration */}
							<div className="p-3.5 rounded-lg bg-card border border-blue-500/30 flex flex-col justify-between hover:border-blue-500 transition-colors">
								<div className="space-y-1 mb-3">
									<div className="flex items-center justify-between">
										<span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
											<LucideShield className="h-3.5 w-3.5" />
											Exam Slot Booking
										</span>
										<span className="text-[10px] text-muted-foreground font-mono">
											₹{nismLaunchModal.launchData?.examFeeInr || nismLaunchModal.course?.examFeeInr || 1500}
										</span>
									</div>
									<p className="text-xs text-muted-foreground">
										Register for official examination slot, select test center city & download hall tickets.
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									className="w-full border-blue-500/40 text-blue-400 hover:bg-blue-500/10 text-xs h-8 flex items-center justify-center gap-1.5"
									onClick={() => {
										safeOpenUrl(
											nismLaunchModal.launchData?.certificationsUrl ||
												"https://certifications.nism.ac.in/",
										);
									}}
								>
									NISM Booking Page
									<ExternalLink className="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>

						{/* Syllabus & Assistance */}
						<div className="p-3 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-between gap-3 text-xs">
							<div className="space-y-0.5">
								<p className="font-medium text-foreground">Official Examination Curriculum</p>
								<p className="text-[11px] text-muted-foreground">
									Passing score: {nismLaunchModal.launchData?.passingPercentage || nismLaunchModal.course?.passingPercentage || 60}% • Negative marking: 25% (on select segments)
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 shrink-0 flex items-center gap-1"
								onClick={() => {
									safeOpenUrl(
										nismLaunchModal.course?.syllabusUrl ||
											nismLaunchModal.launchData?.syllabusUrl ||
											"https://www.nism.ac.in/certification-examinations/",
									);
								}}
							>
								<FileText className="h-3.5 w-3.5" />
								View Syllabus
							</Button>
						</div>

						<Alert className="bg-muted/30 border-border/50 py-2.5">
							<Info className="h-3.5 w-3.5 text-muted-foreground" />
							<AlertDescription className="text-[11px] text-muted-foreground">
								<strong>Candidate Note:</strong> If NISM's portal prompts for candidate credentials, log in with your registered NISM email/PAN. Upon course completion, Continuing Professional Education (CPE) credits and test completions are synchronized with FintekPro automatically via xAPI.
							</AlertDescription>
						</Alert>
					</div>

					<div className="flex justify-end pt-2 border-t border-border/40">
						<Button
							variant="outline"
							size="sm"
							className="text-xs border-border"
							onClick={() =>
								setNismLaunchModal((prev) => ({ ...prev, isOpen: false }))
							}
						>
							Close Gateway
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* NISM In-App Practice Test Dialog */}
			<Dialog
				open={practiceTestModal.isOpen}
				onOpenChange={(open) =>
					setPracticeTestModal((prev) => ({ ...prev, isOpen: open }))
				}
			>
				<DialogContent className="sm:max-w-3xl bg-card border-border shadow-2xl p-6 max-h-[90vh] flex flex-col">
					<DialogHeader className="pb-3 border-b border-border/50 shrink-0">
						<div className="flex items-center justify-between flex-wrap gap-2">
							<div className="flex items-center gap-2">
								<div className={`p-1.5 rounded-md ${
									practiceTestModal.testType === "practice"
										? "bg-emerald-500/20 text-emerald-400"
										: "bg-amber-500/20 text-amber-400"
								}`}>
									{practiceTestModal.testType === "practice" ? (
										<BookOpen className="h-5 w-5" />
									) : (
										<Target className="h-5 w-5" />
									)}
								</div>
								<div>
									<DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
										{practiceTestModal.seriesCode} {practiceTestModal.testType === "practice" ? "Practice / Tutor Session" : "Exam Simulation"}
										<Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
											Passing: {practiceTestModal.passingPercentage}%
										</Badge>
										{practiceTestModal.paperTitle && (
											<Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
												{practiceTestModal.paperTitle}
											</Badge>
										)}
									</DialogTitle>
									<DialogDescription className="text-xs text-muted-foreground">
										{practiceTestModal.courseTitle}
									</DialogDescription>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{practiceTestModal.testType === "practice" ? (
									<Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-1">
										<Lightbulb className="h-3.5 w-3.5" />
										Practice Mode • Untimed
									</Badge>
								) : (
									<>
										{!practiceTestModal.result && practiceTestModal.secondsRemaining !== null && (
											<Badge
												variant="outline"
												className={`text-xs font-mono font-bold flex items-center gap-1.5 px-2.5 py-1 ${
													practiceTestModal.secondsRemaining < 60
														? "border-red-500/60 bg-red-500/15 text-red-400 animate-pulse"
														: practiceTestModal.secondsRemaining < 180
														? "border-amber-500/60 bg-amber-500/15 text-amber-400"
														: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
												}`}
											>
												<Clock className="h-3.5 w-3.5" />
												{formatTimeRemaining(practiceTestModal.secondsRemaining)} Left
											</Badge>
										)}
										<Badge variant="outline" className="border-border text-xs flex items-center gap-1">
											{practiceTestModal.durationMinutes} Min Exam
										</Badge>
									</>
								)}
							</div>
						</div>
					</DialogHeader>

					{/* Content Area */}
					<div className="space-y-4 py-3 overflow-y-auto pr-1 flex-1">
						{!practiceTestModal.result ? (
							<>
								{(() => {
									const answeredCount = Object.keys(practiceTestModal.answers).length;
									const totalCount = practiceTestModal.questions.length;
									const rightCount = practiceTestModal.questions.filter(
										(q) =>
											practiceTestModal.answers[q.id] !== undefined &&
											q.correctIndex !== undefined &&
											practiceTestModal.answers[q.id] === q.correctIndex,
									).length;
									const wrongCount = answeredCount - rightCount;
									const isPractice = practiceTestModal.testType === "practice";
									const showInstantRemarks = practiceTestModal.showInstantRemarks ?? true;

									return (
										<>
											<div className="p-3 bg-muted/20 border border-border/40 rounded-lg space-y-2.5">
												<div className="flex items-center justify-between text-xs flex-wrap gap-2">
													<span className="text-muted-foreground flex items-center gap-1.5">
														<span className={`h-2 w-2 rounded-full ${isPractice ? "bg-emerald-400" : "bg-amber-400"}`}></span>
														{totalCount} MCQs • {isPractice ? "Untimed Tutor Session with Immediate Explanations" : "Timed Exam Simulation"}
													</span>
													<div className="flex items-center gap-3 flex-wrap">
														<div className="flex items-center gap-1.5 text-xs font-medium">
															<span className="text-muted-foreground">Score:</span>
															<span className="text-emerald-400 font-bold flex items-center gap-0.5">
																<CheckCircle2 className="h-3 w-3 inline" /> {rightCount} Right
															</span>
															<span className="text-muted-foreground/40">•</span>
															<span className="text-rose-400 font-bold flex items-center gap-0.5">
																<XCircle className="h-3 w-3 inline" /> {wrongCount} Wrong
															</span>
															<span className="text-muted-foreground/40">•</span>
															<span className="text-amber-400">
																{answeredCount}/{totalCount} Attended
															</span>
														</div>
														<div className="flex items-center gap-1.5 pl-2 border-l border-border/40">
															<Switch
																id="toggle-instant-remarks"
																checked={showInstantRemarks}
																onCheckedChange={(checked) =>
																	setPracticeTestModal((prev) => ({
																		...prev,
																		showInstantRemarks: checked,
																	}))
																}
																className="scale-75 data-[state=checked]:bg-emerald-600"
															/>
															<Label
																htmlFor="toggle-instant-remarks"
																className="text-[11px] text-muted-foreground cursor-pointer select-none"
															>
																Instant Remarks & Explanations
															</Label>
														</div>
													</div>
												</div>

												{/* Question Palette */}
												<div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/30">
													<span className="text-[10px] text-muted-foreground mr-1 uppercase tracking-wider font-semibold">Palette:</span>
													{practiceTestModal.questions.map((q, qIdx) => {
														const isAnswered = practiceTestModal.answers[q.id] !== undefined;
														const isCorrect = isAnswered && q.correctIndex !== undefined && practiceTestModal.answers[q.id] === q.correctIndex;

														let paletteClass = "bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border/50";
														if (isAnswered) {
															if (showInstantRemarks || isPractice) {
																paletteClass = isCorrect
																	? "bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm ring-1 ring-emerald-400/50"
																	: "bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-sm ring-1 ring-rose-400/50";
															} else {
																paletteClass = "bg-amber-600 text-white font-bold shadow-sm";
															}
														}

														return (
															<button
																key={q.id}
																type="button"
																onClick={() => {
																	const el = document.getElementById(`q-card-${q.id}`);
																	if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
																}}
																className={`w-6 h-6 rounded text-[11px] font-mono font-medium transition-all ${paletteClass}`}
																title={`Q${qIdx + 1}: ${isAnswered ? (isCorrect ? "Right Answer" : "Wrong Answer") : "Unanswered"}`}
															>
																{qIdx + 1}
															</button>
														);
													})}
												</div>
											</div>

											<div className="space-y-4">
												{practiceTestModal.questions.map((q, idx) => {
													const isAnswered = practiceTestModal.answers[q.id] !== undefined;
													const userAnswer = practiceTestModal.answers[q.id];
													const isRemarkActive = (showInstantRemarks || isPractice) && isAnswered;
													const isCorrect = isAnswered && q.correctIndex !== undefined && userAnswer === q.correctIndex;
													const correctIndex = q.correctIndex ?? 0;
													const correctLetter = String.fromCharCode(65 + correctIndex);
													const correctOptionText = q.options[correctIndex] || "";
													const userLetter = userAnswer !== undefined ? String.fromCharCode(65 + userAnswer) : "";
													const userOptionText = userAnswer !== undefined ? q.options[userAnswer] : "";

													let cardBorderClass = "bg-background/50 border-border";
													if (isRemarkActive) {
														cardBorderClass = isCorrect
															? "bg-emerald-950/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
															: "bg-rose-950/20 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.08)]";
													}

													return (
														<div
															key={q.id}
															id={`q-card-${q.id}`}
															className={`p-4 rounded-xl border transition-all space-y-3 ${cardBorderClass}`}
														>
															<div className="flex items-start justify-between gap-2">
																<p className="font-semibold text-foreground text-sm leading-relaxed">
																	<span className="text-amber-400 font-mono mr-1.5">Q{idx + 1}.</span> {q.question}
																</p>
																{q.topic && (
																	<Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground border-border/60">
																		{q.topic}
																	</Badge>
																)}
															</div>

															<RadioGroup
																value={practiceTestModal.answers[q.id]?.toString() ?? ""}
																onValueChange={(val) =>
																	setPracticeTestModal((prev) => ({
																		...prev,
																		answers: { ...prev.answers, [q.id]: Number(val) },
																	}))
																}
																className="space-y-1.5"
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
																			className={`flex items-center space-x-2 py-2 px-3 rounded-lg transition-all ${optContainerClass}`}
																		>
																			<RadioGroupItem value={optIdx.toString()} id={`nism-prac-${q.id}-${optIdx}`} />
																			<Label
																				htmlFor={`nism-prac-${q.id}-${optIdx}`}
																				className="text-foreground cursor-pointer text-xs flex-1 flex items-center justify-between gap-2"
																			>
																				<span className="flex items-center gap-2">
																					<span className="font-mono font-bold text-muted-foreground text-[11px] min-w-[18px]">
																						{optLetter}.
																					</span>
																					<span className="leading-snug">{opt}</span>
																				</span>
																				{isRemarkActive && isThisOptionCorrect && (
																					<Badge className="bg-emerald-500/30 text-emerald-300 border-emerald-500/50 text-[10px] shrink-0 font-bold">
																						✓ Right Answer
																					</Badge>
																				)}
																				{isRemarkActive && isSelected && !isThisOptionCorrect && (
																					<Badge className="bg-rose-500/30 text-rose-300 border-rose-500/50 text-[10px] shrink-0 font-bold">
																						✗ Wrong Answer (Your Choice)
																					</Badge>
																				)}
																			</Label>
																		</div>
																	);
																})}
															</RadioGroup>

															{/* Immediate Remark (Right or Wrong) & Comprehensive Concept Explanation */}
															{isRemarkActive && (
																<div className="space-y-2.5 pt-1">
																	{/* Status Remark Callout */}
																	{isCorrect ? (
																		<div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
																			<CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
																			<div>
																				<div className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-emerald-300">
																					✓ Remark: Right Answer!
																				</div>
																				<p className="text-xs text-emerald-200/90 mt-0.5">
																					Spot on! You selected Option {correctLetter} ({correctOptionText}).
																				</p>
																			</div>
																		</div>
																	) : (
																		<div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300">
																			<XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
																			<div>
																				<div className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-rose-400">
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

																	{/* Concept Explanation Card */}
																	<div className="p-4 rounded-xl border bg-gradient-to-br from-card via-card/90 to-amber-500/5 border-amber-500/30 text-xs leading-relaxed space-y-2.5 shadow-sm">
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
																		<p className="text-foreground/90 text-xs leading-relaxed whitespace-pre-line">
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
											</div>
										</>
									);
								})()}

								<Button
									className={`w-full text-white mt-4 ${
										practiceTestModal.testType === "practice"
											? "bg-emerald-600 hover:bg-emerald-700"
											: "bg-amber-600 hover:bg-amber-700"
									}`}
									disabled={
										Object.keys(practiceTestModal.answers).length === 0 ||
										submitPracticeTestMutation.isPending
									}
									onClick={() => {
										if (!practiceTestModal.courseId) return;
										submitPracticeTestMutation.mutate({
											courseId: practiceTestModal.courseId,
											answers: practiceTestModal.answers,
											questionIds: practiceTestModal.questions.map((q) => q.id),
										});
									}}
								>
									{submitPracticeTestMutation.isPending
										? "Evaluating Scorecard..."
										: practiceTestModal.testType === "practice"
										? `Complete Practice Session & View Full Diagnostics (${Object.keys(practiceTestModal.answers).length}/${practiceTestModal.questions.length})`
										: `Submit Official Exam Simulation (${Object.keys(practiceTestModal.answers).length}/${practiceTestModal.questions.length})`}
								</Button>
							</>
						) : (
							<div className="space-y-6">
								{/* Score Banner */}
								<div className="text-center py-4 bg-muted/20 border border-border rounded-lg">
									{practiceTestModal.result.passed ? (
										<>
											<Trophy className="h-12 w-12 text-amber-500 mx-auto mb-2" />
											<h3 className="text-xl font-bold text-foreground mb-1">
												Benchmark Cleared! 🎉
											</h3>
											<p className="text-muted-foreground text-xs mb-3">
												You scored {practiceTestModal.result.scorePercentage}% (Passing criteria: {practiceTestModal.result.passingPercentage}%).
											</p>
											<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-3 py-1">
												Ready for Official NISM Exam Booking
											</Badge>
										</>
									) : (
										<>
											<Target className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
											<h3 className="text-xl font-bold text-foreground mb-1">
												Review Required
											</h3>
											<p className="text-muted-foreground text-xs mb-3">
												You scored {practiceTestModal.result.scorePercentage}%. Minimum {practiceTestModal.result.passingPercentage}% required to clear benchmark.
											</p>
											<Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs px-3 py-1">
												Review AI Capsule & Chapter Explanations Below
											</Badge>
										</>
									)}

									{/* SEBI 0.25 Negative Marking Metrics Strip */}
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-border/40 text-left px-3">
										<div className="p-2 rounded bg-card/60 border border-border/50">
											<p className="text-[10px] text-muted-foreground uppercase">Gross Correct</p>
											<p className="text-sm font-bold text-emerald-400">+{practiceTestModal.result.correctCount}</p>
										</div>
										<div className="p-2 rounded bg-card/60 border border-border/50">
											<p className="text-[10px] text-muted-foreground uppercase">Incorrect (Penalty)</p>
											<p className="text-sm font-bold text-red-400">
												{practiceTestModal.result.incorrectCount} <span className="text-[10px] font-normal text-muted-foreground">(-0.25 ea)</span>
											</p>
										</div>
										<div className="p-2 rounded bg-card/60 border border-border/50">
											<p className="text-[10px] text-muted-foreground uppercase">Penalty Deducted</p>
											<p className="text-sm font-bold text-amber-400">-{practiceTestModal.result.negativeMarksDeducted ?? 0}</p>
										</div>
										<div className="p-2 rounded bg-card/60 border border-border/50">
											<p className="text-[10px] text-muted-foreground uppercase">Net Raw Score</p>
											<p className="text-sm font-bold text-foreground">
												{practiceTestModal.result.netRawScore ?? practiceTestModal.result.correctCount} / {practiceTestModal.result.totalQuestions}
											</p>
										</div>
									</div>
								</div>

								{/* Empanelment Readiness Auto-Sync Alert */}
								{practiceTestModal.result.passed && (
									<div className="p-3.5 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
										<div className="space-y-1">
											<div className="flex items-center gap-1.5 font-bold text-emerald-400">
												<BadgeCheck className="h-4 w-4 text-emerald-400" />
												Empanelment Readiness Auto-Synced ✓
											</div>
											<p className="text-muted-foreground text-[11px] leading-relaxed">
												Your benchmark score ({practiceTestModal.result.scorePercentage}%) has been linked to your FintekPro distributor profile. You are cleared to proceed with official NISM slot booking.
											</p>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<Button
												size="sm"
												className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-8"
												onClick={() => safeOpenUrl("https://cert.nism.ac.in/action/login")}
											>
												Book Exam Slot
												<ExternalLink className="h-3 w-3" />
											</Button>
											<Button
												size="sm"
												variant="outline"
												className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs h-8"
												onClick={() => {
													setPracticeTestModal((prev) => ({ ...prev, isOpen: false }));
													window.location.href = "/agent/kyc-empanelment";
												}}
											>
												View Empanelment
											</Button>
										</div>
									</div>
								)}

								{/* FASP-AI Exam Remediation Capsule */}
								{practiceTestModal.result.aiCapsule && (
									<div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
										<div className="flex items-center justify-between gap-2 flex-wrap">
											<div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
												<Sparkles className="h-4 w-4" />
												FASP-AI High-Yield Remediation Capsule
											</div>
											<Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px]">
												AI Tutor Insights
											</Badge>
										</div>
										<div className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed font-sans bg-background/40 p-3 rounded border border-border/40">
											{practiceTestModal.result.aiCapsule.summaryNotes}
										</div>
										{practiceTestModal.result.aiCapsule.recommendedAction && (
											<p className="text-[11px] text-emerald-300 font-medium">
												👉 <strong>Recommended Action:</strong> {practiceTestModal.result.aiCapsule.recommendedAction}
											</p>
										)}
									</div>
								)}

								{/* Chapter-Wise Diagnostic Analytics */}
								{practiceTestModal.result.topicDiagnostics && practiceTestModal.result.topicDiagnostics.length > 0 && (
									<div className="p-4 rounded-lg bg-card border border-border space-y-3">
										<div className="flex items-center justify-between">
											<h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
												<Award className="h-3.5 w-3.5 text-blue-400" />
												Chapter & Topic Diagnostic Analytics
											</h4>
											<span className="text-[11px] text-muted-foreground">
												{practiceTestModal.result.topicDiagnostics.length} Syllabus Units
											</span>
										</div>

										<div className="space-y-2.5">
											{practiceTestModal.result.topicDiagnostics.map((t) => (
												<div key={t.topic} className="p-2.5 rounded bg-muted/20 border border-border/50 space-y-1.5 text-xs">
													<div className="flex items-center justify-between gap-2">
														<span className="font-medium text-foreground">{t.topic}</span>
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
													<Progress
														value={t.accuracyPercentage}
														className="h-1.5 bg-muted"
													/>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Detailed Review of Answers */}
								<div className="space-y-3">
									<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Detailed Question Review & Explanations ({practiceTestModal.result.correctCount}/{practiceTestModal.result.totalQuestions} Correct)
									</h4>
									{practiceTestModal.result.reviews.map((r, idx) => (
										<div
											key={r.id}
											className={`p-3.5 rounded-lg border text-xs space-y-2 ${
												r.isCorrect
													? "bg-emerald-500/5 border-emerald-500/30"
													: "bg-red-500/5 border-red-500/30"
											}`}
										>
											<div className="flex items-start justify-between gap-2">
												<p className="font-semibold text-foreground">
													{idx + 1}. {r.question}
												</p>
												<Badge
													className={
														r.isCorrect
															? "border-emerald-500/50 text-emerald-300 bg-emerald-500/20 text-[10px] font-semibold"
															: "border-rose-500/50 text-rose-300 bg-rose-500/20 text-[10px] font-semibold"
													}
												>
													{r.isCorrect ? "✓ Right Answer" : "✗ Wrong Answer"}
												</Badge>
											</div>

											<div className="space-y-1 pt-1">
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
												<div className="p-3 rounded-lg bg-card border border-amber-500/30 text-[11px] text-muted-foreground space-y-1">
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

								<div className="flex items-center justify-between gap-3 pt-3 border-t border-border flex-wrap">
									<Button
										variant="outline"
										size="sm"
										className="text-xs border-border"
										onClick={() => {
											setPracticeTestModal((prev) => ({
												...prev,
												answers: {},
												result: null,
											}));
										}}
									>
										Retake Practice Test
									</Button>
									<div className="flex items-center gap-2 flex-wrap">
										<Button
											size="sm"
											variant="outline"
											className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs flex items-center gap-1.5"
											onClick={handlePrintScorecard}
										>
											<Printer className="h-3.5 w-3.5" />
											Print Scorecard (PDF)
										</Button>
										<Button
											size="sm"
											className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1.5"
											onClick={() => {
												safeOpenUrl("https://cert.nism.ac.in/dashboard");
											}}
										>
											Book Exam Slot at NISM
											<ExternalLink className="h-3.5 w-3.5" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="text-xs"
											onClick={() => setPracticeTestModal((prev) => ({ ...prev, isOpen: false }))}
										>
											Close
										</Button>
									</div>
								</div>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
