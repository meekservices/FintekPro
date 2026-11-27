import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	Play,
	Pause,
	RotateCcw,
	FastForward,
	CheckCircle2,
	ShieldCheck,
	Clock,
	Award,
	AlertCircle,
	Sparkles,
	Volume2,
	Lock,
	Check,
	GraduationCap,
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
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
	const [activeTimestampSec, setActiveTimestampSec] = useState<number>(0);
	const [isCompleted, setIsCompleted] = useState(false);
	const [watermarkPos, setWatermarkPos] = useState({ top: "15%", left: "20%" });

	const totalDurationSec = (video.durationMinutes || 30) * 60;
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const lastTelemetryTimeRef = useRef<number>(0);

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
						timestamp: new Date().toISOString(),
					},
				});
			} catch {
				// Non-blocking telemetry fallback
			}
		},
		[courseId, chapterNumber, totalDurationSec, playbackSpeed, video.title],
	);

	// Initialized statement
	useEffect(() => {
		emitTelemetry("initialized", 0);
	}, [emitTelemetry]);

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
							description: `Chapter ${chapterNumber} video watched. Progress updated to institutional LMS record.`,
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

	// Format seconds to mm:ss
	const formatTime = (sec: number) => {
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	// Get embed URL with autoplay and start time parameter
	const getEmbedSrc = () => {
		const url = video.videoUrl || "https://www.youtube-nocookie.com/embed/Pj1_3i0b4Wc";
		const separator = url.includes("?") ? "&" : "?";
		const startParam = currentTime > 0 ? `start=${Math.floor(currentTime)}&` : "";
		return `${url}${separator}${startParam}autoplay=${isPlaying ? "1" : "0"}&rel=0&modestbranding=1&controls=1`;
	};

	return (
		<div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm space-y-0">
			{/* Header Accreditation Banner */}
			<div className="px-4 py-3 bg-gradient-to-r from-amber-500/15 via-card to-card border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
				<div className="space-y-0.5">
					<div className="flex items-center gap-2 flex-wrap">
						<Badge className="bg-amber-600 text-white font-mono text-[10px] px-2 py-0.5">
							INSTITUTIONAL MASTERCLASS
						</Badge>
						<Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-400 text-[10px] flex items-center gap-1">
							<ShieldCheck className="h-3 w-3" />
							SEBI / NISM V-D SIF Benchmark
						</Badge>
						<Badge variant="outline" className="border-blue-500/50 bg-blue-500/10 text-blue-400 text-[10px] flex items-center gap-1">
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

				<div className="flex items-center gap-2 shrink-0">
					<Button
						size="sm"
						variant={isCompleted ? "default" : "outline"}
						onClick={() => {
							setIsCompleted(!isCompleted);
							if (!isCompleted) {
								emitTelemetry("completed", totalDurationSec);
								if (onCompleted) onCompleted();
								toast({
									title: "Marked as Completed ✓",
									description: `Chapter ${chapterNumber} video attendance recorded for compliance verification.`,
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

			{/* Video Canvas Container with Watermark */}
			<div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden group">
				{/* The Embedded Video */}
				<iframe
					ref={iframeRef}
					src={getEmbedSrc()}
					title={video.title}
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen
					className="w-full h-full border-0"
				/>

				{/* Floating Anti-Piracy Compliance Watermark (Drifting) */}
				<div
					className="absolute pointer-events-none select-none z-20 transition-all duration-1000 ease-in-out opacity-25 hover:opacity-40"
					style={{ top: watermarkPos.top, left: watermarkPos.left }}
				>
					<div className="px-2.5 py-1 rounded bg-black/60 border border-white/10 text-[10px] font-mono text-white/80 whitespace-nowrap shadow-sm backdrop-blur-xs flex items-center gap-1.5">
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
							}}
							className="h-7 px-3 text-xs gap-1.5 font-semibold"
						>
							{isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
							<span>{isPlaying ? "Pause" : "Play Masterclass"}</span>
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
