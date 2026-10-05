import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
	BookOpen,
	ArrowLeft,
	Search,
	Calculator,
	Sparkles,
	Layers,
	Clock,
	ShieldCheck,
	AlertCircle,
	CheckCircle,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Play,
	Printer,
	Share2,
	GraduationCap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
	NismCourseCurriculum,
	NismCurriculumChapter,
} from "@/components/NismCurriculumModal";

const SUPPORTED_COURSES = [
	{
		id: "nism-vd",
		seriesCode: "NISM Series V-D",
		title: "Specialized Investment Funds (SIF) Distributors Certification",
	},
	{
		id: "nism-va",
		seriesCode: "NISM Series V-A",
		title: "Mutual Fund Distributors Certification",
	},
	{
		id: "nism-viii",
		seriesCode: "NISM Series VIII",
		title: "Equity Derivatives Certification Examination",
	},
];

export default function AgentStudyNotesPage() {
	const [location, setLocation] = useLocation();
	const { toast } = useToast();

	// Parse search parameters
	const searchParams = useMemo(() => {
		if (typeof window === "undefined") return new URLSearchParams();
		return new URLSearchParams(window.location.search);
	}, [location]);

	const initialCourseId = searchParams.get("courseId") || "nism-vd";
	const initialChapter = parseInt(searchParams.get("chapter") || "1", 10);

	const [courseId, setCourseId] = useState<string>(initialCourseId);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedModule, setSelectedModule] = useState<number | "all">("all");
	const [activeChapterNumber, setActiveChapterNumber] = useState<number>(
		Number.isNaN(initialChapter) ? 1 : initialChapter,
	);

	// Persist completed/reviewed chapters in local storage
	const [completedChapters, setCompletedChapters] = useState<Set<number>>(() => {
		try {
			const saved = localStorage.getItem(`study_notes_completed_${courseId}`);
			return saved ? new Set(JSON.parse(saved)) : new Set();
		} catch {
			return new Set();
		}
	});

	// Synchronize when courseId changes
	useEffect(() => {
		try {
			const saved = localStorage.getItem(`study_notes_completed_${courseId}`);
			setCompletedChapters(saved ? new Set(JSON.parse(saved)) : new Set());
		} catch {
			setCompletedChapters(new Set());
		}
	}, [courseId]);

	const toggleChapterCompleted = (chNumber: number) => {
		setCompletedChapters((prev) => {
			const next = new Set(prev);
			if (next.has(chNumber)) {
				next.delete(chNumber);
			} else {
				next.add(chNumber);
				toast({
					title: "Chapter marked as reviewed",
					description: `Chapter ${chNumber} marked as completed in your study tracker.`,
				});
			}
			try {
				localStorage.setItem(
					`study_notes_completed_${courseId}`,
					JSON.stringify(Array.from(next)),
				);
			} catch {
				// ignore local storage error
			}
			return next;
		});
	};

	// Query course curriculum data
	const { data, isLoading } = useQuery<{
		success: boolean;
		curriculum: NismCourseCurriculum;
	}>({
		queryKey: [`/api/knowledge-hub/nism/courses/${courseId}/curriculum`],
		queryFn: async () => {
			const res = await apiRequest(
				"GET",
				`/api/knowledge-hub/nism/courses/${encodeURIComponent(courseId)}/curriculum`,
			);
			return typeof res?.json === "function" ? await res.json() : res;
		},
		staleTime: 1000 * 60 * 60, // 1 hour cache
	});

	const curriculum = data?.curriculum;

	// Flatten all chapters
	const allChapters = useMemo(() => {
		if (!curriculum?.modules) return [];
		return curriculum.modules.flatMap((m) => m.chapters);
	}, [curriculum]);

	// Filter chapters
	const filteredChapters = useMemo(() => {
		let list = allChapters;
		if (selectedModule !== "all") {
			list = list.filter((ch) => ch.moduleNumber === selectedModule);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(ch) =>
					ch.title.toLowerCase().includes(q) ||
					ch.overview.toLowerCase().includes(q) ||
					ch.keyConcepts.some((c) => c.toLowerCase().includes(q)) ||
					ch.highYieldTips.some((t) => t.toLowerCase().includes(q)) ||
					ch.formulas?.some(
						(f) =>
							f.name.toLowerCase().includes(q) ||
							f.formula.toLowerCase().includes(q),
					),
			);
		}
		return list;
	}, [allChapters, selectedModule, searchQuery]);

	// Active chapter
	const activeChapter: NismCurriculumChapter | undefined = useMemo(() => {
		return (
			allChapters.find((ch) => ch.chapterNumber === activeChapterNumber) ||
			filteredChapters[0] ||
			allChapters[0]
		);
	}, [allChapters, activeChapterNumber, filteredChapters]);

	// Current active chapter index among all chapters
	const currentChapterIndex = useMemo(() => {
		if (!activeChapter) return 0;
		return allChapters.findIndex(
			(ch) => ch.chapterNumber === activeChapter.chapterNumber,
		);
	}, [allChapters, activeChapter]);

	const prevChapter =
		currentChapterIndex > 0 ? allChapters[currentChapterIndex - 1] : null;
	const nextChapter =
		currentChapterIndex < allChapters.length - 1
			? allChapters[currentChapterIndex + 1]
			: null;

	const handleCourseChange = (newCourseId: string) => {
		setCourseId(newCourseId);
		setActiveChapterNumber(1);
		const newUrl = `${window.location.pathname}?courseId=${newCourseId}&chapter=1`;
		window.history.replaceState({}, "", newUrl);
	};

	const handleSelectChapter = (chNum: number) => {
		setActiveChapterNumber(chNum);
		const newUrl = `${window.location.pathname}?courseId=${courseId}&chapter=${chNum}`;
		window.history.replaceState({}, "", newUrl);
	};

	const handlePrint = () => {
		window.print();
	};

	const handleShare = () => {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(window.location.href);
			toast({
				title: "Link copied to clipboard",
				description: `Direct study link for Chapter ${activeChapter?.chapterNumber || 1} copied.`,
			});
		}
	};

	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Top Sticky Header */}
			<header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3 shadow-sm">
				<div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
					{/* Left: Back & Course Info */}
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setLocation("/agent/knowledge-hub/certifications")}
							className="h-8 px-2 text-muted-foreground hover:text-foreground -ml-2"
						>
							<ArrowLeft className="h-4 w-4 mr-1.5" />
							<span className="hidden sm:inline">Certifications</span>
						</Button>

						<div className="h-4 w-px bg-border/60" />

						<div className="flex items-center gap-2">
							<Select value={courseId} onValueChange={handleCourseChange}>
								<SelectTrigger className="h-8 text-xs font-semibold bg-card border-border/80 min-w-[200px] max-w-[280px]">
									<SelectValue placeholder="Select Course" />
								</SelectTrigger>
								<SelectContent>
									{SUPPORTED_COURSES.map((c) => (
										<SelectItem key={c.id} value={c.id} className="text-xs">
											<span className="font-bold text-amber-500 mr-1.5">
												{c.seriesCode}:
											</span>
											<span>{c.title}</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Badge
								variant="outline"
								className="hidden lg:inline-flex border-emerald-500/50 bg-emerald-500/10 text-emerald-400 text-[11px] px-2 py-0.5"
							>
								Official SEBI Blueprint
							</Badge>
						</div>
					</div>

					{/* Right: Exam Meta Specs & Actions */}
					<div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
						<div className="hidden sm:flex items-center gap-2">
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/50 border border-border/60 text-[11px]">
								<Clock className="h-3 w-3 text-amber-400" />
								<span>{curriculum?.examDurationMinutes || 180}m</span>
							</div>
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/50 border border-border/60 text-[11px]">
								<BookOpen className="h-3 w-3 text-blue-400" />
								<span>{curriculum?.totalQuestionsExam || 150} MCQs</span>
							</div>
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/50 border border-border/60 text-[11px]">
								<ShieldCheck className="h-3 w-3 text-emerald-400" />
								<span>Pass: {curriculum?.passingPercentage || 60}%</span>
							</div>
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/50 border border-border/60 text-[11px]">
								<AlertCircle className="h-3 w-3 text-red-400" />
								<span>Neg: {curriculum?.negativeMarkingPercentage || 10}%</span>
							</div>
						</div>

						<div className="flex items-center gap-1.5">
							<Button
								size="sm"
								variant="outline"
								onClick={handleShare}
								title="Copy Chapter Link"
								className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
							>
								<Share2 className="h-3.5 w-3.5" />
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={handlePrint}
								title="Print or Save PDF"
								className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hidden sm:flex"
							>
								<Printer className="h-3.5 w-3.5" />
							</Button>

							<Button
								size="sm"
								className="h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5 shadow-sm"
								onClick={() =>
									window.open(
										`/agent/knowledge-hub/practice-test?courseId=${courseId}&paper=paper-1`,
										"_blank",
									)
								}
							>
								<Play className="h-3.5 w-3.5 fill-current" />
								<span>Take Practice Mock</span>
								<ExternalLink className="h-3 w-3 ml-0.5 opacity-70" />
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Main Workspace Layout */}
			<div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row min-h-0">
				{/* Left Sidebar: Chapters Index & Filter */}
				<aside className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-border/70 bg-card/40 flex flex-col shrink-0">
					{/* Search & Module filter bar */}
					<div className="p-3.5 border-b border-border/60 space-y-2.5 bg-card/60">
						<div className="relative">
							<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
							<Input
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search concepts, formulas, SEBI rules..."
								className="pl-8 h-8 text-xs bg-background/80"
							/>
						</div>

						{/* Module Pills */}
						<div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
							<Button
								size="sm"
								variant={selectedModule === "all" ? "default" : "outline"}
								onClick={() => setSelectedModule("all")}
								className="h-6 text-[10px] px-2 shrink-0"
							>
								All ({allChapters.length})
							</Button>
							{curriculum?.modules.map((m) => (
								<Button
									key={m.moduleNumber}
									size="sm"
									variant={selectedModule === m.moduleNumber ? "default" : "outline"}
									onClick={() => setSelectedModule(m.moduleNumber)}
									className="h-6 text-[10px] px-2 shrink-0"
								>
									Mod {m.moduleNumber} ({m.weightagePercentage}%)
								</Button>
							))}
						</div>
					</div>

					{/* Chapter Counter & Progress */}
					<div className="px-3.5 py-2 bg-muted/30 border-b border-border/40 text-[11px] font-semibold text-muted-foreground flex justify-between items-center">
						<span>SYLLABUS CHAPTERS ({filteredChapters.length})</span>
						<span className="text-[10px] text-amber-500 font-mono">
							{completedChapters.size}/{allChapters.length} Reviewed
						</span>
					</div>

					{/* Chapter List */}
					<ScrollArea className="flex-1 p-2 md:h-[calc(100vh-180px)]">
						<div className="space-y-1.5">
							{filteredChapters.map((ch) => {
								const isSelected = ch.chapterNumber === activeChapter?.chapterNumber;
								const isDone = completedChapters.has(ch.chapterNumber);

								return (
									<button
										key={ch.chapterNumber}
										type="button"
										onClick={() => handleSelectChapter(ch.chapterNumber)}
										className={`w-full text-left p-2.5 rounded-lg transition-all text-xs flex flex-col gap-1 border ${
											isSelected
												? "bg-amber-500/15 border-amber-500/50 text-foreground font-medium shadow-sm ring-1 ring-amber-500/30"
												: "hover:bg-muted/50 border-transparent text-muted-foreground hover:text-foreground"
										}`}
									>
										<div className="flex items-center justify-between gap-1.5">
											<div className="flex items-center gap-1.5">
												<span className="font-mono text-[10px] font-bold text-amber-400">
													CH {ch.chapterNumber}
												</span>
												{isDone && (
													<CheckCircle2 className="h-3 w-3 text-emerald-400 inline" />
												)}
											</div>
											<span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/40 font-mono">
												{ch.weightage}
											</span>
										</div>
										<span className="line-clamp-2 leading-snug text-xs">
											{ch.title}
										</span>
									</button>
								);
							})}

							{filteredChapters.length === 0 && (
								<div className="p-6 text-center text-xs text-muted-foreground">
									No chapters found matching &ldquo;{searchQuery}&rdquo;.
								</div>
							)}
						</div>
					</ScrollArea>
				</aside>

				{/* Right: Chapter Content & Deep Dive */}
				<main className="flex-1 min-h-0 flex flex-col bg-background/50">
					{isLoading ? (
						<div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-3">
							<div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
							<p className="text-xs">Loading course curriculum and study notes...</p>
						</div>
					) : activeChapter ? (
						<ScrollArea className="flex-1 p-4 sm:p-8 md:h-[calc(100vh-110px)]">
							<div className="max-w-4xl mx-auto space-y-8 pb-12">
								{/* Chapter Header */}
								<div className="space-y-3 pb-5 border-b border-border/60">
									<div className="flex items-center justify-between gap-2 flex-wrap">
										<div className="flex items-center gap-2">
											<Badge className="bg-amber-600 text-white text-xs px-2.5 py-0.5">
												Module {activeChapter.moduleNumber}: {activeChapter.moduleTitle}
											</Badge>
											<Badge variant="outline" className="border-border text-xs px-2 py-0.5">
												Weightage: {activeChapter.weightage}
											</Badge>
										</div>

										<Button
											size="sm"
											variant={completedChapters.has(activeChapter.chapterNumber) ? "default" : "outline"}
											onClick={() => toggleChapterCompleted(activeChapter.chapterNumber)}
											className={`h-7 text-xs gap-1.5 ${
												completedChapters.has(activeChapter.chapterNumber)
													? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
													: "border-border text-muted-foreground hover:text-foreground"
											}`}
										>
											<CheckCircle className="h-3.5 w-3.5" />
											<span>
												{completedChapters.has(activeChapter.chapterNumber)
													? "Completed"
													: "Mark as Reviewed"}
											</span>
										</Button>
									</div>

									<h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
										Chapter {activeChapter.chapterNumber}: {activeChapter.title}
									</h1>
									<p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
										{activeChapter.overview}
									</p>
								</div>

								{/* Core Concepts */}
								<div className="space-y-4">
									<div className="flex items-center gap-2 border-b border-border/40 pb-2">
										<Layers className="h-5 w-5 text-amber-400" />
										<h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-amber-400">
											Core Concepts Tested in Official Exam
										</h2>
									</div>
									<div className="grid gap-3">
										{activeChapter.keyConcepts.map((concept, idx) => (
											<div
												key={idx}
												className="p-4 rounded-xl bg-card/70 border border-border/70 text-xs sm:text-sm flex items-start gap-3 leading-relaxed text-foreground shadow-sm hover:border-amber-500/40 transition-colors"
											>
												<CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
												<span>{concept}</span>
											</div>
										))}
									</div>
								</div>

								{/* Key Formulas Section */}
								{activeChapter.formulas && activeChapter.formulas.length > 0 && (
									<div className="space-y-4 pt-2">
										<div className="flex items-center gap-2 border-b border-border/40 pb-2">
											<Calculator className="h-5 w-5 text-blue-400" />
											<h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-blue-400">
												Key Formulas & Calculations
											</h2>
										</div>
										<div className="grid gap-4">
											{activeChapter.formulas.map((f, idx) => (
												<div
													key={idx}
													className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2 shadow-sm"
												>
													<div className="flex items-center justify-between">
														<span className="font-bold text-sm text-blue-300">
															{f.name}
														</span>
													</div>
													<div className="font-mono text-xs sm:text-sm p-3 rounded-lg bg-black/50 text-amber-300 border border-blue-500/25 overflow-x-auto">
														{f.formula}
													</div>
													<p className="text-xs text-muted-foreground leading-relaxed">
														{f.explanation}
													</p>
												</div>
											))}
										</div>
									</div>
								)}

								{/* High-Yield Examination Tips */}
								<div className="space-y-4 pt-2">
									<div className="flex items-center gap-2 border-b border-border/40 pb-2">
										<Sparkles className="h-5 w-5 text-emerald-400" />
										<h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-emerald-400">
											High-Yield NISM Exam Tips & Gotchas
										</h2>
									</div>
									<div className="grid gap-3">
										{activeChapter.highYieldTips.map((tip, idx) => (
											<div
												key={idx}
												className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs sm:text-sm flex items-start gap-3 leading-relaxed text-emerald-200 shadow-sm"
											>
												<AlertCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
												<span>{tip}</span>
											</div>
										))}
									</div>
								</div>

								{/* Chapter Navigation Footer */}
								<div className="pt-8 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-4">
									<div className="flex items-center gap-2 w-full sm:w-auto">
										{prevChapter ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleSelectChapter(prevChapter.chapterNumber)}
												className="h-9 text-xs gap-1.5 flex-1 sm:flex-initial"
											>
												<ChevronLeft className="h-4 w-4" />
												<span className="truncate max-w-[150px]">
													CH {prevChapter.chapterNumber}: {prevChapter.title}
												</span>
											</Button>
										) : (
											<div />
										)}
									</div>

									<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
										{nextChapter ? (
											<Button
												variant="default"
												size="sm"
												onClick={() => handleSelectChapter(nextChapter.chapterNumber)}
												className="h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 flex-1 sm:flex-initial"
											>
												<span className="truncate max-w-[150px]">
													CH {nextChapter.chapterNumber}: {nextChapter.title}
												</span>
												<ChevronRight className="h-4 w-4" />
											</Button>
										) : (
											<Button
												variant="default"
												size="sm"
												onClick={() =>
													window.open(
														`/agent/knowledge-hub/practice-test?courseId=${courseId}&paper=paper-1`,
														"_blank",
													)
												}
												className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 flex-1 sm:flex-initial"
											>
												<GraduationCap className="h-4 w-4" />
												<span>Ready for Final Mock Exam!</span>
											</Button>
										)}
									</div>
								</div>
							</div>
						</ScrollArea>
					) : (
						<div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
							Select a chapter from the left to view notes.
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
