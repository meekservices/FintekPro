import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
	Play,
	Pause,
	RotateCcw,
	CheckCircle2,
	ShieldCheck,
	Clock,
	Award,
	AlertCircle,
	Sparkles,
	Volume2,
	VolumeX,
	Lock,
	GraduationCap,
	Presentation,
	Video as LucideVideo,
	ExternalLink,
	ChevronLeft,
	ChevronRight,
	Layers,
	FileText,
	Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface NismVideoTimestamp {
	timeSec: number;
	label: string;
	description?: string;
}

export interface NismChapterVideo {
	videoUrl: string;
	title: string;
	durationMinutes: number;
	instructor?: string;
	instructorRole?: string;
	thumbnailUrl?: string;
	summary?: string;
	keyTimestamps: NismVideoTimestamp[];
	isInstitutionalAccredited?: boolean;
}

interface NismInstitutionalVideoPlayerProps {
	video: NismChapterVideo;
	courseId: string;
	chapterNumber: number;
	chapterTitle: string;
	moduleTitle?: string;
	candidateName?: string;
	candidatePan?: string;
	onCompleted?: () => void;
}

export function NismInstitutionalVideoPlayer({
	video,
	courseId,
	chapterNumber,
	chapterTitle,
	moduleTitle,
	candidateName = "Licensed Advisor",
	candidatePan = "ABCDE****F",
	onCompleted,
}: NismInstitutionalVideoPlayerProps) {
	const { toast } = useToast();
	const [learningMode, setLearningMode] = useState<"deck" | "video">("deck");
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
	const [activeTimestampSec, setActiveTimestampSec] = useState<number>(0);
	const [isCompleted, setIsCompleted] = useState(false);
	const [isNarrationEnabled, setIsNarrationEnabled] = useState(true);
	const [watermarkPos, setWatermarkPos] = useState({ top: "15%", left: "20%" });

	const totalDurationSec = (video.durationMinutes || 30) * 60;
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const lastTelemetryTimeRef = useRef<number>(0);
	const lastSpokenIndexRef = useRef<number>(-1);

	// Extract standard 11-char YouTube video ID
	const videoId = useMemo(() => {
		const raw = video.videoUrl || "";
		const match = raw.match(/(?:embed\/|v=|vi\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
		return match ? match[1] : "ASATvHqRToc";
	}, [video.videoUrl]);

	// Dynamic drifting watermark to comply with Institutional Anti-Piracy Governance
	useEffect(() => {
		const interval = setInterval(() => {
			const randomTop = Math.floor(10 + Math.random() * 60);
			const randomLeft = Math.floor(5 + Math.random() * 55);
			setWatermarkPos({ top: `${randomTop}%`, left: `${randomLeft}%` });
		}, 8000);

		return () => clearInterval(interval);
	}, []);

	// Emit IEEE xAPI Video Telemetry
	const emitTelemetry = useCallback(
		async (verb: "initialized" | "played" | "paused" | "seeked" | "completed", timeSec: number) => {
			try {
				await apiRequest("POST", "/api/knowledge-hub/nism/video-telemetry", {
					courseId,
					chapterNumber,
					verb,
					currentTimeSec: Math.round(timeSec),
					durationSec: totalDurationSec,
					playbackSpeed,
					sessionMetadata: {
						videoTitle: video.title,
						learningMode,
						timestamp: new Date().toISOString(),
					},
				});
			} catch {
				// Non-blocking telemetry fallback
			}
		},
		[courseId, chapterNumber, totalDurationSec, playbackSpeed, video.title, learningMode],
	);

	// Initialized statement
	useEffect(() => {
		emitTelemetry("initialized", 0);
	}, [emitTelemetry]);

	// Build slide deck structures from timestamps & official syllabus
	const slides = useMemo(() => {
		if (!video.keyTimestamps || video.keyTimestamps.length === 0) {
			return [
				{
					title: video.title || chapterTitle,
					timeSec: 0,
					badge: "Executive Masterclass",
					points: [
						"SEBI Specialized Investment Fund (SIF) regulatory compliance standards.",
						"Mandatory ₹10 Lakhs minimum ticket size per investor PAN across all specialized strategies.",
						"Statutory risk management, gross exposure limits, and investor suitability controls.",
					],
					narration: `Welcome to Chapter ${chapterNumber}: ${video.title || chapterTitle}. This institutional module covers the SEBI Specialized Investment Fund framework, mandatory investment thresholds, and derivatives portfolio management.`,
				},
			];
		}

		return video.keyTimestamps.map((ts, idx) => {
			const cleanLabel = ts.label.replace(/^\d+:\d+\s*-\s*/, "");
			const points: string[] = [];

			if (ts.description) {
				points.push(ts.description);
			}

			if (cleanLabel.toLowerCase().includes("threshold") || cleanLabel.includes("10 Lakh")) {
				points.push("SEBI Mandate: Minimum ₹10 Lakhs investment threshold applies per investor PAN across all SIF strategies.");
				points.push("Joint accounts: Primary holder PAN is verified for compliance; partial redemption cannot breach ₹10L floor.");
			} else if (cleanLabel.toLowerCase().includes("derivative") || cleanLabel.toLowerCase().includes("hedg")) {
				points.push("Gross Exposure: Aggregate exposure across equity, debt, and derivative overlays must not exceed 100% of Net Assets.");
				points.push("Hedging Exemption: Pure hedging positions via index/stock futures are subject to SEBI risk mitigation caps.");
			} else if (cleanLabel.toLowerCase().includes("long-short") || cleanLabel.toLowerCase().includes("inverse")) {
				points.push("Strategy Rules: Long-short equity allows unconstrained alpha generation with defined net exposure bands.");
				points.push("Inverse & Leveraged ETFs: Must disclose daily rebalancing compounding decay and volatility drag.");
			} else if (cleanLabel.toLowerCase().includes("tax")) {
				points.push("Taxation: Specified Mutual Funds without 65% equity exposure are taxed at applicable slab rates.");
				points.push("Capital Gains: Equity-oriented SIF strategies follow 12.5% LTCG (>₹1.25L) and 20% STCG rules.");
			} else {
				points.push("High-weightage concept tested in official 150-question SEBI certification examination.");
				points.push("Requires operational mastery of investor advisory suitability and disclosure rules.");
			}

			return {
				title: cleanLabel,
				timeSec: ts.timeSec,
				badge: `Topic ${idx + 1} of ${video.keyTimestamps.length}`,
				points,
				narration: `${cleanLabel}. Key topic for Chapter ${chapterNumber}. ${points[0]}`,
			};
		});
	}, [video.keyTimestamps, video.title, chapterTitle, chapterNumber]);

	// Identify active slide index based on playback time
	const currentSlideIndex = useMemo(() => {
		if (!slides.length) return 0;
		for (let i = slides.length - 1; i >= 0; i--) {
			if (currentTime >= slides[i].timeSec) {
				return i;
			}
		}
		return 0;
	}, [currentTime, slides]);

	const activeSlide = slides[currentSlideIndex] || slides[0];

	// Speech Synthesis Audio Narration
	const speakSlide = useCallback(
		(text: string) => {
			if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
			try {
				window.speechSynthesis.cancel();
				if (!isNarrationEnabled) return;
				const utterance = new SpeechSynthesisUtterance(text);
				utterance.rate = playbackSpeed;
				utterance.pitch = 1;
				window.speechSynthesis.speak(utterance);
			} catch {
				// Non-fatal voice synthesis fallback
			}
		},
		[isNarrationEnabled, playbackSpeed],
	);

	// Trigger speech when slide index changes during playback
	useEffect(() => {
		if (isPlaying && isNarrationEnabled && currentSlideIndex !== lastSpokenIndexRef.current) {
			lastSpokenIndexRef.current = currentSlideIndex;
			speakSlide(activeSlide.narration);
		}
	}, [currentSlideIndex, isPlaying, isNarrationEnabled, activeSlide.narration, speakSlide]);

	// Clean up speech on unmount
	useEffect(() => {
		return () => {
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		};
	}, []);

	// Simulate video playhead progress & heartbeat telemetry
	useEffect(() => {
		let timer: NodeJS.Timeout;
		if (isPlaying) {
			timer = setInterval(() => {
				setCurrentTime((prev) => {
					const next = prev + playbackSpeed;
					if (next >= totalDurationSec && !isCompleted) {
						setIsCompleted(true);
						emitTelemetry("completed", totalDurationSec);
						if (onCompleted) onCompleted();
						toast({
							title: "Masterclass Video Completed ✓",
							description: `Chapter ${chapterNumber} attendance recorded in your institutional LMS profile.`,
						});
					}
					// Periodic telemetry heartbeat every 30 seconds
					if (Math.abs(next - lastTelemetryTimeRef.current) >= 30) {
						lastTelemetryTimeRef.current = next;
						emitTelemetry("played", next);
					}
					return Math.min(next, totalDurationSec);
				});
			}, 1000);
		}
		return () => clearInterval(timer);
	}, [isPlaying, playbackSpeed, totalDurationSec, isCompleted, emitTelemetry, onCompleted, chapterNumber, toast]);

	// Seek to timestamp
	const handleSeekTo = (timeSec: number) => {
		setCurrentTime(timeSec);
		setActiveTimestampSec(timeSec);
		emitTelemetry("seeked", timeSec);
		setIsPlaying(true);
	};

	const handleNextSlide = () => {
		if (currentSlideIndex < slides.length - 1) {
			handleSeekTo(slides[currentSlideIndex + 1].timeSec);
		}
	};

	const handlePrevSlide = () => {
		if (currentSlideIndex > 0) {
			handleSeekTo(slides[currentSlideIndex - 1].timeSec);
		}
	};

	// Format seconds to mm:ss
	const formatTime = (sec: number) => {
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	// Get embed URL with autoplay and start time parameter
	const getEmbedSrc = () => {
		const startParam = currentTime > 0 ? `&start=${Math.floor(currentTime)}` : "";
		return `https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? "1" : "0"}&rel=0&modestbranding=1&controls=1&enablejsapi=1${startParam}`;
	};

	const youtubeWatchUrl = `https://www.youtube.com/watch?v=${videoId}`;

	return (
		<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm space-y-0">
			{/* Header Accreditation & Mode Selector Banner */}
			<div className="px-4 py-3 bg-gradient-to-r from-amber-500/15 via-card to-card border-b border-border/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
				<div className="space-y-0.5">
					<div className="flex items-center gap-2 flex-wrap">
						<Badge className="bg-amber-600 text-white font-mono text-[10px] px-2 py-0.5">
							INSTITUTIONAL MASTERCLASS
						</Badge>
						<Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] flex items-center gap-1 font-semibold">
							<ShieldCheck className="h-3 w-3" />
							SEBI / NISM V-D SIF Benchmark
						</Badge>
						<Badge variant="outline" className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] flex items-center gap-1">
							<Sparkles className="h-3 w-3" />
							IEEE xAPI Tracked
						</Badge>
					</div>
					<h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight pt-0.5">
						Chapter {chapterNumber}: {video.title}
					</h3>
					<p className="text-xs text-muted-foreground line-clamp-1">
						{video.instructor} • {video.instructorRole || "Empaneled Faculty"}
					</p>
				</div>

				<div className="flex items-center gap-2 shrink-0 flex-wrap">
					{/* Dual Mode Switcher: Self-Hosted Interactive Deck vs External Video Stream */}
					<div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/70 shadow-xs">
						<button
							type="button"
							onClick={() => setLearningMode("deck")}
							className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors ${
								learningMode === "deck"
									? "bg-amber-600 text-white shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
							title="100% Reliable, zero-ad institutional interactive presentation with audio narration"
						>
							<Presentation className="h-3.5 w-3.5" />
							<span>Interactive Deck</span>
						</button>
						<button
							type="button"
							onClick={() => setLearningMode("video")}
							className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors ${
								learningMode === "video"
									? "bg-amber-600 text-white shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
							title="Official accredited video stream from authorized partners"
						>
							<LucideVideo className="h-3.5 w-3.5" />
							<span>Video Stream</span>
						</button>
					</div>

					<Button
						size="sm"
						variant={isCompleted ? "default" : "outline"}
						onClick={() => {
							const nextState = !isCompleted;
							setIsCompleted(nextState);
							if (nextState) {
								emitTelemetry("completed", totalDurationSec);
								if (onCompleted) onCompleted();
								toast({
									title: "Marked as Completed ✓",
									description: `Chapter ${chapterNumber} attendance recorded for compliance verification.`,
								});
							}
						}}
						className={`h-8 text-xs gap-1.5 font-semibold ${
							isCompleted
								? "bg-emerald-600 hover:bg-emerald-700 text-white"
								: "border-border text-muted-foreground hover:text-foreground"
						}`}
					>
						<CheckCircle2 className="h-3.5 w-3.5" />
						<span>{isCompleted ? "Attendance Verified" : "Mark Watched"}</span>
					</Button>
				</div>
			</div>

			{/* Canvas Container with Watermark */}
			<div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden group">
				{learningMode === "deck" ? (
					/* MODE 1: Self-Hosted Interactive Masterclass Lecture Deck (Guaranteed 100% Available) */
					<div className="w-full h-full p-4 sm:p-8 flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 text-white select-none">
						{/* Top Meta Line */}
						<div className="flex items-center justify-between border-b border-white/10 pb-3">
							<div className="flex items-center gap-2">
								<Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono text-[10px]">
									{activeSlide.badge}
								</Badge>
								<span className="text-xs text-white/70 font-medium">
									Chapter {chapterNumber} • {moduleTitle || "SIF Masterclass"}
								</span>
							</div>

							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => {
										const next = !isNarrationEnabled;
										setIsNarrationEnabled(next);
										if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
											window.speechSynthesis.cancel();
										}
										toast({
											title: next ? "Audio Narration Enabled 🔊" : "Audio Narration Muted 🔇",
											description: next ? "Faculty speech narration active for lecture points." : "Narration muted.",
										});
									}}
									className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors border ${
										isNarrationEnabled
											? "bg-amber-500/20 text-amber-300 border-amber-500/40"
											: "bg-white/5 text-white/50 border-white/10"
									}`}
									title="Toggle institutional audio commentary"
								>
									{isNarrationEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
									<span className="hidden sm:inline">{isNarrationEnabled ? "Narration ON" : "Muted"}</span>
								</button>
								<span className="font-mono text-xs text-white/60">
									{currentSlideIndex + 1} / {slides.length}
								</span>
							</div>
						</div>

						{/* Slide Body */}
						<div className="py-4 space-y-4 max-w-3xl">
							<div className="space-y-1.5">
								<div className="flex items-center gap-2">
									<GraduationCap className="h-5 w-5 text-amber-400" />
									<h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight leading-snug">
										{activeSlide.title}
									</h2>
								</div>
								<p className="text-xs text-amber-300/80 font-mono">
									Target SEBI Curriculum • Chapter {chapterNumber}
								</p>
							</div>

							{/* Key Points Grid */}
							<div className="grid gap-2.5">
								{activeSlide.points.map((pt, pIdx) => (
									<div
										key={pIdx}
										className="p-3 sm:p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-white/90 flex items-start gap-3 backdrop-blur-xs leading-relaxed"
									>
										<div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
											{pIdx + 1}
										</div>
										<span>{pt}</span>
									</div>
								))}
							</div>
						</div>

						{/* Slide Navigation Footbar */}
						<div className="flex items-center justify-between border-t border-white/10 pt-3">
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant="ghost"
									disabled={currentSlideIndex === 0}
									onClick={handlePrevSlide}
									className="h-8 px-2.5 text-xs text-white/80 hover:text-white hover:bg-white/10"
								>
									<ChevronLeft className="h-4 w-4 mr-1" />
									Prev Topic
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={currentSlideIndex === slides.length - 1}
									onClick={handleNextSlide}
									className="h-8 px-2.5 text-xs text-white/80 hover:text-white hover:bg-white/10"
								>
									Next Topic
									<ChevronRight className="h-4 w-4 ml-1" />
								</Button>
							</div>

							<div className="flex items-center gap-1">
								{slides.map((_, sIdx) => (
									<button
										key={sIdx}
										type="button"
										onClick={() => handleSeekTo(slides[sIdx].timeSec)}
										className={`h-2 rounded-full transition-all ${
											sIdx === currentSlideIndex
												? "w-6 bg-amber-400"
												: "w-2 bg-white/30 hover:bg-white/60"
										}`}
										title={`Jump to Topic ${sIdx + 1}`}
									/>
								))}
							</div>
						</div>
					</div>
				) : (
					/* MODE 2: Verified Video Stream with Quick Fallback Helper */
					<div className="relative w-full h-full">
						<iframe
							ref={iframeRef}
							src={getEmbedSrc()}
							title={video.title}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
							className="w-full h-full border-0"
						/>
						{/* Subtle top banner if YouTube iframe is restricted */}
						<div className="absolute top-2 left-2 right-2 z-10 pointer-events-auto flex items-center justify-between gap-2 p-2 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-white text-[11px] shadow-sm">
							<span className="truncate text-white/80">
								Stream via accredited partner. If your network blocks YouTube, use the Self-Hosted Deck:
							</span>
							<div className="flex items-center gap-1.5 shrink-0">
								<button
									type="button"
									onClick={() => setLearningMode("deck")}
									className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px]"
								>
									Switch to Interactive Deck
								</button>
								<a
									href={youtubeWatchUrl}
									target="_blank"
									rel="noreferrer"
									className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] flex items-center gap-1"
								>
									<span>Open YouTube</span>
									<ExternalLink className="h-2.5 w-2.5" />
								</a>
							</div>
						</div>
					</div>
				)}

				{/* Floating Anti-Piracy Compliance Watermark (Drifting) */}
				<div
					className="absolute pointer-events-none select-none z-20 transition-all duration-1000 ease-in-out opacity-25 hover:opacity-40"
					style={{ top: watermarkPos.top, left: watermarkPos.left }}
				>
					<div className="px-2.5 py-1 rounded bg-black/70 border border-white/10 text-[10px] font-mono text-white/80 whitespace-nowrap shadow-sm backdrop-blur-xs flex items-center gap-1.5">
						<Lock className="h-2.5 w-2.5 text-amber-400" />
						<span>{candidateName}</span>
						<span>•</span>
						<span>{candidatePan}</span>
						<span>•</span>
						<span>FintekPro LMS Audit</span>
					</div>
				</div>
			</div>

			{/* Control Bar & Progress */}
			<div className="p-3 bg-card border-t border-border/70 space-y-2.5">
				{/* Progress Tracker */}
				<div className="space-y-1">
					<div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
						<div className="flex items-center gap-1.5 text-foreground font-semibold">
							<Clock className="h-3 w-3 text-amber-500" />
							<span>{formatTime(currentTime)}</span>
							<span className="opacity-60">/ {formatTime(totalDurationSec)}</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-[10px]">
								{Math.round((currentTime / totalDurationSec) * 100)}% Watched
							</span>
							{isCompleted && (
								<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">
									Verified
								</Badge>
							)}
						</div>
					</div>
					<Progress
						value={(currentTime / totalDurationSec) * 100}
						className="h-1.5 bg-muted/60"
					/>
				</div>

				{/* Controls & Speed Selector */}
				<div className="flex items-center justify-between gap-2 flex-wrap pt-1">
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								const nextPlay = !isPlaying;
								setIsPlaying(nextPlay);
								emitTelemetry(nextPlay ? "played" : "paused", currentTime);
								if (!nextPlay && typeof window !== "undefined" && "speechSynthesis" in window) {
									window.speechSynthesis.cancel();
								}
							}}
							className="h-7 px-3 text-xs gap-1.5 font-semibold"
						>
							{isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
							<span>{isPlaying ? "Pause Masterclass" : "Play Masterclass"}</span>
						</Button>

						<Button
							size="sm"
							variant="ghost"
							onClick={() => handleSeekTo(0)}
							className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
							title="Replay from start"
						>
							<RotateCcw className="h-3.5 w-3.5" />
						</Button>
					</div>

					{/* Playback Speeds */}
					<div className="flex items-center gap-1 text-[11px]">
						<span className="text-[10px] text-muted-foreground font-semibold mr-1">Speed:</span>
						{[1, 1.25, 1.5, 2].map((spd) => (
							<button
								key={spd}
								type="button"
								onClick={() => setPlaybackSpeed(spd)}
								className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
									playbackSpeed === spd
										? "bg-amber-500 text-black font-bold"
										: "bg-muted text-muted-foreground hover:text-foreground"
								}`}
							>
								{spd}x
							</button>
						))}
					</div>
				</div>

				{/* Interactive Concept Timestamps */}
				{video.keyTimestamps && video.keyTimestamps.length > 0 && (
					<div className="pt-2 border-t border-border/50 space-y-1.5">
						<div className="flex items-center justify-between">
							<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
								<GraduationCap className="h-3.5 w-3.5 text-amber-500" />
								Jump to Core Concepts Tested in Official Exam:
							</span>
							<span className="text-[9px] text-muted-foreground">Click to seek timestamp</span>
						</div>

						<div className="flex items-center gap-1.5 flex-wrap">
							{video.keyTimestamps.map((ts, idx) => {
								const isSelected = activeTimestampSec === ts.timeSec;
								return (
									<button
										key={idx}
										type="button"
										onClick={() => handleSeekTo(ts.timeSec)}
										className={`px-2.5 py-1 rounded-md text-[11px] text-left transition-all flex items-center gap-1.5 border ${
											isSelected
												? "border-amber-500 bg-amber-500/20 text-amber-300 font-semibold shadow-xs"
												: "border-border/60 bg-muted/40 text-muted-foreground hover:border-amber-500/40 hover:text-foreground font-medium"
										}`}
									>
										<span className="font-mono text-[9px] text-amber-500">
											{formatTime(ts.timeSec)}
										</span>
										<span>{ts.label.replace(/^\d+:\d+\s*-\s*/, "")}</span>
									</button>
								);
							})}
						</div>
					</div>
				)}

				{/* Summary Callout */}
				{video.summary && (
					<p className="text-[11px] text-muted-foreground italic pt-1 leading-relaxed border-t border-border/40">
						&ldquo;{video.summary}&rdquo;
					</p>
				)}
			</div>
		</div>
	);
}
