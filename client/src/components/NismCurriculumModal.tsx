import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	BookOpen,
	Award,
	CheckCircle,
	AlertCircle,
	Search,
	Calculator,
	Sparkles,
	Layers,
	Clock,
	ShieldCheck,
	ChevronRight,
	ExternalLink,
	Play,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";

export interface NismFormulaItem {
	name: string;
	formula: string;
	explanation: string;
}

export interface NismCurriculumChapter {
	chapterNumber: number;
	title: string;
	moduleNumber: number;
	moduleTitle: string;
	weightage: string;
	overview: string;
	keyConcepts: string[];
	formulas?: NismFormulaItem[];
	highYieldTips: string[];
}

export interface NismCurriculumModule {
	moduleNumber: number;
	title: string;
	weightagePercentage: number;
	chapters: NismCurriculumChapter[];
}

export interface NismCourseCurriculum {
	courseId: string;
	seriesCode: string;
	title: string;
	description: string;
	totalModules: number;
	totalChapters: number;
	totalQuestionsExam: number;
	examDurationMinutes: number;
	passingPercentage: number;
	negativeMarkingPercentage: number;
	modules: NismCurriculumModule[];
}

interface NismCurriculumModalProps {
	isOpen: boolean;
	onClose: () => void;
	courseId: string;
	onStartMock?: (paperId: string) => void;
}

export function NismCurriculumModal({
	isOpen,
	onClose,
	courseId,
	onStartMock,
}: NismCurriculumModalProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedModule, setSelectedModule] = useState<number | "all">("all");
	const [activeChapterNumber, setActiveChapterNumber] = useState<number>(1);

	const { data, isLoading } = useQuery<{ success: boolean; curriculum: NismCourseCurriculum }>({
		queryKey: [`/api/knowledge-hub/nism/courses/${courseId}/curriculum`],
		queryFn: async () => {
			const res = await apiRequest("GET", `/api/knowledge-hub/nism/courses/${encodeURIComponent(courseId)}/curriculum`);
			return typeof res?.json === "function" ? await res.json() : res;
		},
		enabled: isOpen && !!courseId,
		staleTime: 1000 * 60 * 60, // 1 hour
	});

	const curriculum = data?.curriculum;

	// All chapters flattened for quick lookup
	const allChapters = React.useMemo(() => {
		if (!curriculum?.modules) return [];
		return curriculum.modules.flatMap((m) => m.chapters);
	}, [curriculum]);

	// Filtered chapters
	const filteredChapters = React.useMemo(() => {
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
					(ch.formulas && ch.formulas.some((f) => f.name.toLowerCase().includes(q) || f.formula.toLowerCase().includes(q))),
			);
		}
		return list;
	}, [allChapters, selectedModule, searchQuery]);

	// Currently viewed chapter details
	const activeChapter = React.useMemo(() => {
		return (
			allChapters.find((ch) => ch.chapterNumber === activeChapterNumber) ||
			filteredChapters[0] ||
			allChapters[0]
		);
	}, [allChapters, activeChapterNumber, filteredChapters]);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-5xl h-[90vh] p-0 flex flex-col bg-background/95 backdrop-blur-md border border-border/80 shadow-2xl">
				{/* Header */}
				<DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-card/60">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div className="space-y-1">
							<div className="flex items-center gap-2">
								<Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-400 font-mono text-[11px] px-2 py-0.5">
									{curriculum?.seriesCode || courseId.toUpperCase()}
								</Badge>
								<Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-400 text-[11px] px-2 py-0.5">
									Official SEBI / NISM Blueprint
								</Badge>
							</div>
							<DialogTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight">
								{curriculum?.title || "NISM Course Curriculum & High-Yield Study Guide"}
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground line-clamp-1">
								{curriculum?.description || "Exhaustive chapter-by-chapter study notes, formulas, and examination tips."}
							</DialogDescription>
						</div>

						{/* Exam Meta Badges */}
						<div className="flex items-center gap-2 flex-wrap">
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/50 border border-border/60 text-[11px]">
								<Clock className="h-3 w-3 text-amber-400" />
								<span>{curriculum?.examDurationMinutes || 180} Mins</span>
							</div>
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/50 border border-border/60 text-[11px]">
								<BookOpen className="h-3 w-3 text-blue-400" />
								<span>{curriculum?.totalQuestionsExam || 150} MCQs</span>
							</div>
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/50 border border-border/60 text-[11px]">
								<ShieldCheck className="h-3 w-3 text-emerald-400" />
								<span>Passing: {curriculum?.passingPercentage || 60}%</span>
							</div>
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-muted/50 border border-border/60 text-[11px]">
								<AlertCircle className="h-3 w-3 text-red-400" />
								<span>Negative: {curriculum?.negativeMarkingPercentage || 10}%</span>
							</div>
							<Button
								size="sm"
								variant="outline"
								className="h-6 text-[11px] border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 gap-1 px-2 font-medium"
								onClick={() => {
									onClose();
									window.open(
										`/agent/knowledge-hub/study-notes?courseId=${encodeURIComponent(courseId)}&chapter=${activeChapterNumber}`,
										"_blank",
									);
								}}
							>
								<ExternalLink className="h-3 w-3" />
								Open Full Page
							</Button>
						</div>
					</div>

					{/* Search & Module filter tabs */}
					<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 pt-3 border-t border-border/40">
						<div className="relative flex-1">
							<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
							<Input
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search concepts, formulas, SEBI rules, Sharpe ratio, SIF ₹10L..."
								className="pl-8 h-8 text-xs bg-background/80"
							/>
						</div>
						<div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
							<Button
								size="sm"
								variant={selectedModule === "all" ? "default" : "outline"}
								onClick={() => setSelectedModule("all")}
								className="h-8 text-[11px] px-2.5 shrink-0"
							>
								All Chapters ({allChapters.length})
							</Button>
							{curriculum?.modules.map((m) => (
								<Button
									key={m.moduleNumber}
									size="sm"
									variant={selectedModule === m.moduleNumber ? "default" : "outline"}
									onClick={() => setSelectedModule(m.moduleNumber)}
									className="h-8 text-[11px] px-2.5 shrink-0"
								>
									Mod {m.moduleNumber} ({m.weightagePercentage}%)
								</Button>
							))}
						</div>
					</div>
				</DialogHeader>

				{/* Body: 2 Columns (Left: Chapter List, Right: Active Chapter Study Guide) */}
				<div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
					{/* Left: Chapter Index Sidebar */}
					<div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border/60 bg-card/30 flex flex-col shrink-0">
						<div className="p-2.5 bg-muted/30 border-b border-border/40 text-[11px] font-semibold text-muted-foreground flex justify-between items-center">
							<span>SYLLABUS CHAPTERS ({filteredChapters.length})</span>
							<span className="text-[10px] text-amber-400">Total 22 Chapters</span>
						</div>
						<ScrollArea className="flex-1 p-2">
							<div className="space-y-1">
								{filteredChapters.map((ch) => {
									const isSelected = ch.chapterNumber === activeChapter?.chapterNumber;
									return (
										<button
											key={ch.chapterNumber}
											type="button"
											onClick={() => setActiveChapterNumber(ch.chapterNumber)}
											className={`w-full text-left p-2 rounded-md transition-all text-xs flex flex-col gap-1 border ${
												isSelected
													? "bg-amber-500/15 border-amber-500/40 text-foreground font-medium shadow-sm"
													: "hover:bg-muted/50 border-transparent text-muted-foreground"
											}`}
										>
											<div className="flex items-center justify-between gap-1">
												<span className="font-mono text-[10px] font-semibold text-amber-400">
													CH {ch.chapterNumber}
												</span>
												<span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/40">
													{ch.weightage}
												</span>
											</div>
											<span className="line-clamp-2 leading-snug">{ch.title}</span>
										</button>
									);
								})}
								{filteredChapters.length === 0 && (
									<div className="p-4 text-center text-xs text-muted-foreground">
										No chapters match your query.
									</div>
								)}
							</div>
						</ScrollArea>
					</div>

					{/* Right: Active Chapter Deep-Dive Content */}
					<div className="flex-1 min-h-0 flex flex-col bg-background/50">
						{activeChapter ? (
							<ScrollArea className="flex-1 p-4 sm:p-6">
								<div className="max-w-3xl space-y-6">
									{/* Chapter Title Banner */}
									<div className="space-y-2 pb-4 border-b border-border/60">
										<div className="flex items-center gap-2 flex-wrap">
											<Badge className="bg-amber-600 text-white text-[11px]">
												Module {activeChapter.moduleNumber}: {activeChapter.moduleTitle}
											</Badge>
											<Badge variant="outline" className="border-border text-[11px]">
												Weightage: {activeChapter.weightage}
											</Badge>
										</div>
										<h2 className="text-xl sm:text-2xl font-bold text-foreground">
											Chapter {activeChapter.chapterNumber}: {activeChapter.title}
										</h2>
										<p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
											{activeChapter.overview}
										</p>
									</div>

									{/* Key Concepts Section */}
									<div className="space-y-3">
										<h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
											<Layers className="h-4 w-4" />
											Core Concepts Tested in Official Exam
										</h3>
										<div className="grid gap-2">
											{activeChapter.keyConcepts.map((concept, idx) => (
												<div
													key={idx}
													className="p-3 rounded-lg bg-card/60 border border-border/60 text-xs sm:text-sm flex items-start gap-2.5 leading-relaxed text-foreground/90 shadow-sm"
												>
													<CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
													<span>{concept}</span>
												</div>
											))}
										</div>
									</div>

									{/* Key Formulas Section (if applicable) */}
									{activeChapter.formulas && activeChapter.formulas.length > 0 && (
										<div className="space-y-3 pt-2">
											<h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
												<Calculator className="h-4 w-4" />
												Key Formulas & Calculations
											</h3>
											<div className="grid gap-3">
												{activeChapter.formulas.map((f, idx) => (
													<div
														key={idx}
														className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-500/30 space-y-1.5"
													>
														<div className="flex items-center justify-between">
															<span className="font-semibold text-xs text-blue-300">
																{f.name}
															</span>
														</div>
														<div className="font-mono text-xs sm:text-sm p-2 rounded bg-black/40 text-amber-300 border border-blue-500/20">
															{f.formula}
														</div>
														<p className="text-[11px] text-muted-foreground">
															{f.explanation}
														</p>
													</div>
												))}
											</div>
										</div>
									)}

									{/* High-Yield Examination Tips */}
									<div className="space-y-3 pt-2">
										<h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
											<Sparkles className="h-4 w-4" />
											High-Yield NISM Exam Tips & Gotchas
										</h3>
										<div className="grid gap-2">
											{activeChapter.highYieldTips.map((tip, idx) => (
												<div
													key={idx}
													className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs sm:text-sm flex items-start gap-2.5 leading-relaxed text-emerald-200"
												>
													<AlertCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
													<span>{tip}</span>
												</div>
											))}
										</div>
									</div>

									{/* Action Footer */}
									<div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
										<div className="text-xs text-muted-foreground">
											Studying Chapter {activeChapter.chapterNumber} of {allChapters.length}
										</div>
										<div className="flex items-center gap-2">
											{onStartMock && (
												<Button
													size="sm"
													className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
													onClick={() => {
														onClose();
														onStartMock("paper-1");
													}}
												>
													<Play className="h-3.5 w-3.5 fill-current" />
													Attempt 150-Q Mock Paper 1
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
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
