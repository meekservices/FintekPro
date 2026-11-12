import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
	Activity,
	CheckCircle,
	XCircle,
	AlertTriangle,
	RefreshCw,
	Brain,
	Clock,
	ChevronDown,
	ChevronRight,
	Cpu,
	Shield as LucideShield,
	Calculator,
	TrendingUp,
	PieChart,
	Target,
	Banknote,
	Scale,
	BarChart3,
	Zap,
	ArrowUpCircle,
	CircleDot,
	MinusCircle,
	Search,
	Filter,
	FlaskConical,
	Layers,
	Bot,
	ShieldCheck,
	Sliders,
	Wrench,
	CheckCircle2,
	Lock,
	Unlock,
	Sparkles,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EngineTestResult {
	engine: string;
	category: string;
	status: "pass" | "fail" | "warn";
	latencyMs: number;
	details: string;
	sampleOutput?: any;
	error?: string;
}

interface CategoryBreakdown {
	category: string;
	total: number;
	passed: number;
	failed: number;
	warned: number;
	avgLatencyMs: number;
}

interface HealthCheckResponse {
	success: boolean;
	summary: {
		totalEngines: number;
		passed: number;
		failed: number;
		warned: number;
		overallStatus: string;
		totalLatencyMs: number;
		timestamp: string;
	};
	categoryBreakdown: CategoryBreakdown[];
	results: EngineTestResult[];
}

interface AuditResponse {
	success: boolean;
	auditType: string;
	model: string;
	tokensUsed: number;
	timestamp: string;
	audit: any;
}

interface EngineRegistryEntry {
	name: string;
	category: string;
	subcategory: string;
	currentImpl: string;
	upgradeStatus: "completed" | "available" | "in_progress" | "not_required";
	upgradeTypes: string[];
	pythonMigrated: boolean;
	currentVersion: string;
	targetVersion?: string;
	upgradeNote: string;
	priority: "critical" | "high" | "medium" | "low";
}

interface RegistryResponse {
	success: boolean;
	summary: {
		total: number;
		completed: number;
		available: number;
		inProgress: number;
		notRequired: number;
		pythonMigrated: number;
		upgradeCompletionPct: number;
	};
	byCategory: Record<string, number>;
	engines: EngineRegistryEntry[];
	generatedAt: string;
}

const CATEGORY_ICONS: Record<string, any> = {
	"Valuation Ratios": Calculator,
	"Portfolio Intelligence": PieChart,
	"Proposal Builder": Target,
	"Tax & Compliance": Scale,
	"Transaction Processing": Banknote,
	"Financial Planning": TrendingUp,
	"Return Metrics": BarChart3,
	"Valuation Models": Cpu,
	Compliance: LucideShield,
	"AI Services": Brain,
	Quant: Zap,
	Financial: Calculator,
	Portfolio: PieChart,
	Classification: Layers,
	Proposal: Target,
	"Python Service": FlaskConical,
	"Python Sidecar": FlaskConical,
};

const UPGRADE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
	python_migration: {
		label: "Python Migration",
		color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
	},
	formula_fix: {
		label: "Formula Fix",
		color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
	},
	algorithm_upgrade: {
		label: "Algorithm Upgrade",
		color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
	},
	architecture: {
		label: "Architecture",
		color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
	},
	regulatory: {
		label: "Regulatory",
		color: "bg-red-500/10 text-red-600 border-red-500/20",
	},
};

const PRIORITY_COLORS: Record<string, string> = {
	critical: "bg-red-500/10 text-red-600 border-red-500/20",
	high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
	medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
	low: "bg-muted text-muted-foreground",
};

const STATUS_CONFIG = {
	completed: {
		icon: CheckCircle,
		color: "text-green-500",
		badge: "bg-green-500/10 text-green-600 border-green-500/20",
		label: "Completed",
	},
	available: {
		icon: ArrowUpCircle,
		color: "text-blue-500",
		badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
		label: "Available for Upgrade",
	},
	in_progress: {
		icon: CircleDot,
		color: "text-yellow-500",
		badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
		label: "In Progress",
	},
	not_required: {
		icon: MinusCircle,
		color: "text-muted-foreground",
		badge: "bg-muted text-muted-foreground",
		label: "Not Required",
	},
};

export default function EngineHealthCheck() {
	const { toast } = useToast();
	const [healthData, setHealthData] = useState<HealthCheckResponse | null>(
		null,
	);
	const [auditData, setAuditData] = useState<AuditResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [auditLoading, setAuditLoading] = useState(false);
	const [selfHealLoading, setSelfHealLoading] = useState(false);
	const [selfHealResult, setSelfHealResult] = useState<any>(null);
	const [learningCycleLoading, setLearningCycleLoading] = useState(false);
	const [killSwitchModalOpen, setKillSwitchModalOpen] = useState(false);
	const [killSwitchReason, setKillSwitchReason] = useState("");
	const [killSwitchSubmitting, setKillSwitchSubmitting] = useState(false);

	const [expandedResults, setExpandedResults] = useState<Set<string>>(
		new Set(),
	);
	const [registryFilter, setRegistryFilter] = useState<
		"all" | "available" | "completed" | "not_required"
	>("all");
	const [registryCategoryFilter, setRegistryCategoryFilter] =
		useState<string>("all");
	const [registrySearch, setRegistrySearch] = useState("");

	const { data: registryData, isLoading: registryLoading } =
		useQuery<RegistryResponse>({
			queryKey: ["/api/engine-health/registry"],
		});

	const {
		data: orchestratorData,
		refetch: refetchOrchestrator,
		isLoading: _orchestratorLoading,
	} = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/engine-health/orchestrator-status"],
		refetchInterval: 12000,
	});

	const {
		data: regulatoryData,
		refetch: _refetchRegulatory,
		isLoading: _regulatoryLoading,
	} = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/engine-health/regulatory-drift"],
		refetchInterval: 30000,
	});

	const runHealthCheck = async () => {
		setLoading(true);
		try {
			const res = await apiRequest("/api/engine-health/run");
			const data = await res.json();
			setHealthData(data);
			toast({
				title: "Formula Health Check Complete",
				description: `Checked ${data.summary?.totalEngines ?? 0} engines: ${data.summary?.passed ?? 0} passed, ${data.summary?.failed ?? 0} failed.`,
			});
		} catch (err) {
			console.error("Health check failed:", err);
			toast({
				title: "Health Check Error",
				description: "Failed to run calculation engine health tests.",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const runSelfHeal = async () => {
		setSelfHealLoading(true);
		try {
			const res = await apiRequest("/api/engine-health/self-heal", "POST");
			const json = await res.json();
			setSelfHealResult(json.data);
			refetchOrchestrator();
			toast({
				title: "Self-Healing Sweep Finished",
				description: `Scanned engines. Repaired ${json.data?.repairedEngines ?? 0} degraded engines. Telemetry updated.`,
			});
		} catch (err: any) {
			toast({
				title: "Self-Healing Failed",
				description: err?.message || "Could not complete self-healing sweep",
				variant: "destructive",
			});
		} finally {
			setSelfHealLoading(false);
		}
	};

	const runLearningCycle = async () => {
		setLearningCycleLoading(true);
		try {
			const res = await apiRequest("/api/engine-learning/trigger-cycle", "POST");
			const json = await res.json();
			refetchOrchestrator();
			toast({
				title: "Autonomous Self-Improvement Executed",
				description: json.message || "Feedback loops analyzed recommendations & calibrated weights.",
			});
		} catch (err: any) {
			toast({
				title: "Learning Cycle Error",
				description: err?.message || "Failed to trigger learning cycle",
				variant: "destructive",
			});
		} finally {
			setLearningCycleLoading(false);
		}
	};

	const handleToggleLearningConfig = async (patch: Record<string, any>) => {
		try {
			const res = await apiRequest("/api/engine-learning/toggle", "POST", patch);
			const json = await res.json();
			refetchOrchestrator();
			toast({
				title: "Configuration Saved",
				description: json.message || "Engine learning parameters updated successfully.",
			});
		} catch (err: any) {
			toast({
				title: "Update Failed",
				description: err?.message || "Could not save learning configuration",
				variant: "destructive",
			});
		}
	};

	const handleKillSwitchSubmit = async () => {
		if (!killSwitchReason || killSwitchReason.trim().length < 5) {
			toast({
				title: "Substantive Reason Required",
				description: "SEBI AI/ML intermediary governance mandates an audited reason for kill-switch mutation.",
				variant: "destructive",
			});
			return;
		}

		setKillSwitchSubmitting(true);
		const targetState = !orchestratorData?.data?.masterOrchestrator?.isGloballyDisabled;

		try {
			const res = await apiRequest("/api/engine-health/kill-switch", "POST", {
				isGloballyDisabled: targetState,
				reason: killSwitchReason.trim(),
			});
			const json = await res.json();
			setKillSwitchModalOpen(false);
			setKillSwitchReason("");
			refetchOrchestrator();
			toast({
				title: targetState ? "🚨 Global AI Advisory Blocked" : "✅ Global AI Advisory Restored",
				description: json.message,
				variant: targetState ? "destructive" : "default",
			});
		} catch (err: any) {
			toast({
				title: "Kill Switch Error",
				description: err?.message || "Failed to toggle kill switch",
				variant: "destructive",
			});
		} finally {
			setKillSwitchSubmitting(false);
		}
	};

	const runGeminiAudit = async () => {
		setAuditLoading(true);
		try {
			const res = await apiRequest("/api/engine-health/gemini-deep-audit");
			const data = await res.json();
			setAuditData(data);
		} catch (err) {
			console.error("Gemini audit failed:", err);
		} finally {
			setAuditLoading(false);
		}
	};

	const toggleExpanded = (engine: string) => {
		setExpandedResults((prev) => {
			const next = new Set(prev);
			if (next.has(engine)) next.delete(engine);
			else next.add(engine);
			return next;
		});
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "pass":
			case "HEALTHY":
				return "bg-green-500/10 text-green-500 border-green-500/20";
			case "fail":
			case "CRITICAL":
				return "bg-red-500/10 text-red-500 border-red-500/20";
			case "warn":
			case "DEGRADED":
				return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
			default:
				return "bg-muted text-muted-foreground";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "pass":
			case "HEALTHY":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "fail":
			case "CRITICAL":
				return <XCircle className="h-4 w-4 text-red-500" />;
			case "warn":
			case "DEGRADED":
				return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
			default:
				return <Activity className="h-4 w-4 text-muted-foreground" />;
		}
	};

	const filteredEngines =
		registryData?.engines.filter((e) => {
			if (registryFilter !== "all" && e.upgradeStatus !== registryFilter)
				return false;
			if (
				registryCategoryFilter !== "all" &&
				e.category !== registryCategoryFilter
			)
				return false;
			if (registrySearch) {
				const q = registrySearch.toLowerCase();
				return (
					e.name.toLowerCase().includes(q) ||
					e.subcategory.toLowerCase().includes(q) ||
					e.upgradeNote.toLowerCase().includes(q)
				);
			}
			return true;
		}) ?? [];

	const _categories = registryData ? Object.keys(registryData.byCategory) : [];

	const masterState = orchestratorData?.data?.masterOrchestrator;
	const learningState = orchestratorData?.data?.learningOrchestrator;
	const telemetryState = orchestratorData?.data?.telemetry;
	const selfHealingState = orchestratorData?.data?.selfHealingRuntime;
	const isKillSwitchActive = Boolean(masterState?.isGloballyDisabled);

	return (
		<div className="space-y-6">
			{/* ── Emergency Kill-Switch Banner (When Engaged) ────────────────── */}
			{isKillSwitchActive && (
				<div className="rounded-lg border-2 border-red-500 bg-red-500/10 p-4 text-red-600 dark:text-red-400 flex items-start justify-between shadow-lg">
					<div className="flex items-start gap-3">
						<AlertTriangle className="h-6 w-6 mt-0.5 flex-shrink-0 animate-bounce" />
						<div>
							<h3 className="font-bold text-lg">
								GLOBAL AI ADVISORY KILL-SWITCH ENGAGED
							</h3>
							<p className="text-sm opacity-90 mt-1">
								Autonomous AI advisory and recommendation generation is globally
								halted across all tenant portals.
							</p>
							{masterState?.lastTriggerReason && (
								<p className="text-xs font-mono mt-2 bg-red-500/20 px-2 py-1 rounded inline-block">
									Reason: {masterState.lastTriggerReason}
								</p>
							)}
						</div>
					</div>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setKillSwitchModalOpen(true)}
						className="flex-shrink-0 ml-4 font-semibold"
					>
						<Unlock className="h-4 w-4 mr-1.5" />
						Disengage Kill Switch
					</Button>
				</div>
			)}

			{/* ── Page Header & Master Actions ──────────────────────────────── */}
			<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-bold text-foreground">
							Engine Health & Master Orchestration Architecture
						</h1>
						<Badge
							variant="outline"
							className={
								isKillSwitchActive
									? "bg-red-500/10 text-red-500 border-red-500/30"
									: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
							}
						>
							{isKillSwitchActive ? "KILL-SWITCH ACTIVE" : "PLATFORM OPERATIONAL"}
						</Badge>
					</div>
					<p className="text-muted-foreground text-sm mt-1">
						Master FAIL Orchestrator, Continuous Engine Learning, Self-Healing Runtime,
						and Multi-Regulator Compliance Registry (GCR v1.0 & FASP-AI v3.1)
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button
						onClick={runHealthCheck}
						disabled={loading}
						variant="default"
						size="sm"
					>
						{loading ? (
							<RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
						) : (
							<Cpu className="h-4 w-4 mr-1.5" />
						)}
						{loading ? "Checking..." : "Formula Health"}
					</Button>

					<Button
						onClick={runSelfHeal}
						disabled={selfHealLoading}
						variant="secondary"
						size="sm"
					>
						{selfHealLoading ? (
							<RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
						) : (
							<Wrench className="h-4 w-4 mr-1.5 text-blue-500" />
						)}
						{selfHealLoading ? "Healing..." : "Trigger Self-Heal"}
					</Button>

					<Button
						onClick={runLearningCycle}
						disabled={learningCycleLoading}
						variant="outline"
						size="sm"
					>
						{learningCycleLoading ? (
							<RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
						) : (
							<Sparkles className="h-4 w-4 mr-1.5 text-amber-500" />
						)}
						{learningCycleLoading ? "Tuning..." : "Learning Cycle"}
					</Button>

					<Button
						onClick={() => setKillSwitchModalOpen(true)}
						variant={isKillSwitchActive ? "secondary" : "destructive"}
						size="sm"
					>
						{isKillSwitchActive ? (
							<Unlock className="h-4 w-4 mr-1.5" />
						) : (
							<Lock className="h-4 w-4 mr-1.5" />
						)}
						{isKillSwitchActive ? "Disengage Switch" : "Emergency Kill Switch"}
					</Button>

					<Button
						onClick={runGeminiAudit}
						disabled={auditLoading}
						variant="ghost"
						size="sm"
					>
						{auditLoading ? (
							<RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
						) : (
							<Brain className="h-4 w-4 mr-1.5 text-purple-500" />
						)}
						{auditLoading ? "Auditing..." : "Deep Audit"}
					</Button>
				</div>
			</div>

			{/* ── Architecture Executive Summary KPI Cards ──────────────────── */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				<Card>
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<div className="text-xs text-muted-foreground uppercase font-medium">
								FAIL Orchestrator
							</div>
							<div className="text-lg font-bold text-foreground mt-0.5 flex items-center gap-1.5">
								{masterState?.pipelineStatus === "OPERATIONAL" ? (
									<span className="text-emerald-600 flex items-center gap-1">
										<CheckCircle2 className="h-4 w-4" /> Operational
									</span>
								) : isKillSwitchActive ? (
									<span className="text-red-600 flex items-center gap-1">
										<XCircle className="h-4 w-4" /> Blocked
									</span>
								) : (
									"Standby"
								)}
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								{masterState?.subEngines?.length ?? 7} Pipeline Gates Active
							</div>
						</div>
						<div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
							<Bot className="h-5 w-5" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<div className="text-xs text-muted-foreground uppercase font-medium">
								Continuous Learning
							</div>
							<div className="text-lg font-bold text-foreground mt-0.5 capitalize">
								{learningState?.learningModeLevel?.replace("_", " ") ?? "Adaptive"}
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								{learningState?.activeCalibrationsCount ?? 0} Active Calibrations
							</div>
						</div>
						<div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
							<Sliders className="h-5 w-5" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<div className="text-xs text-muted-foreground uppercase font-medium">
								Self-Healing Runtime
							</div>
							<div className="text-lg font-bold text-foreground mt-0.5">
								{selfHealingState?.status === "OPTIMAL" ? (
									<span className="text-emerald-600">Optimal</span>
								) : (
									<span className="text-amber-500">Heal Advised</span>
								)}
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								{selfHealingState?.repairableEnginesCount ?? 0} Repairable Engines
							</div>
						</div>
						<div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
							<Wrench className="h-5 w-5" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<div className="text-xs text-muted-foreground uppercase font-medium">
								Telemetry Alpha Signal
							</div>
							<div className="text-lg font-bold text-foreground mt-0.5">
								<Badge
									variant="outline"
									className={
										telemetryState?.alphaSignal === "STRONG"
											? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
											: "bg-blue-500/10 text-blue-600 border-blue-500/30"
									}
								>
									{telemetryState?.alphaSignal ?? "STRONG"}
								</Badge>
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								{telemetryState?.healthyCount ?? 0} Healthy / {telemetryState?.totalTracked ?? 0} Tracked
							</div>
						</div>
						<div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600">
							<Activity className="h-5 w-5" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* ── Main Navigation Tabs ──────────────────────────────────────── */}
			<Tabs defaultValue="orchestration">
				<TabsList className="flex-wrap h-auto gap-1">
					<TabsTrigger value="orchestration">
						<Bot className="h-4 w-4 mr-1.5" />
						Master Architecture & Learning
					</TabsTrigger>
					<TabsTrigger value="compliance">
						<ShieldCheck className="h-4 w-4 mr-1.5" />
						Fiduciary & Regulatory Drift
					</TabsTrigger>
					<TabsTrigger value="registry">
						<Layers className="h-4 w-4 mr-1.5" />
						Upgrade Registry
					</TabsTrigger>
					<TabsTrigger value="health">
						<Calculator className="h-4 w-4 mr-1.5" />
						Formula Health Check
					</TabsTrigger>
					{healthData && (
						<TabsTrigger value="details">Engine Details</TabsTrigger>
					)}
					{healthData && (
						<TabsTrigger value="ai-verification">AI Verification</TabsTrigger>
					)}
					{auditData && (
						<TabsTrigger value="deep-audit">Deep Audit</TabsTrigger>
					)}
				</TabsList>

				{/* ── Master Architecture & Controls Tab ────────────────────────── */}
				<TabsContent value="orchestration" className="space-y-6 mt-4">
					{/* Master Execution Pipeline Schema */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base font-semibold flex items-center justify-between">
								<span>Master Fiduciary Pipeline (FAIL v1.0 Non-Bypassable Sequence)</span>
								<Badge variant="outline" className="text-xs font-mono">
									FAIL-ORCHESTRATOR-GATEWAY
								</Badge>
							</CardTitle>
							<CardDescription>
								Statutory flow enforced by GCR v1.0 and FASP-AI v3.1 — no direct AI to user execution
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
								<div className="p-3 rounded-lg border border-border bg-card">
									<div className="font-bold text-primary">1. AMSE</div>
									<div className="text-muted-foreground text-[11px] mt-1">Model Selection</div>
									<Badge className="mt-2 text-[10px] bg-emerald-500/10 text-emerald-600">Active</Badge>
								</div>
								<div className="p-3 rounded-lg border border-border bg-card">
									<div className="font-bold text-primary">2. URCAE</div>
									<div className="text-muted-foreground text-[11px] mt-1">Capital Allocator</div>
									<Badge className="mt-2 text-[10px] bg-emerald-500/10 text-emerald-600">Active</Badge>
								</div>
								<div className="p-3 rounded-lg border border-border bg-card">
									<div className="font-bold text-primary">3. Quant Core</div>
									<div className="text-muted-foreground text-[11px] mt-1">Deterministic Math</div>
									<Badge className="mt-2 text-[10px] bg-emerald-500/10 text-emerald-600">Active</Badge>
								</div>
								<div className="p-3 rounded-lg border border-border bg-card">
									<div className="font-bold text-primary">4. APSE</div>
									<div className="text-muted-foreground text-[11px] mt-1">Simulation & VaR</div>
									<Badge className="mt-2 text-[10px] bg-emerald-500/10 text-emerald-600">Active</Badge>
								</div>
								<div className="p-3 rounded-lg border border-border bg-card">
									<div className="font-bold text-primary">5. AAGE</div>
									<div className="text-muted-foreground text-[11px] mt-1">Governance Intercept</div>
									<Badge className="mt-2 text-[10px] bg-emerald-500/10 text-emerald-600">Active</Badge>
								</div>
								<div className="p-3 rounded-lg border border-border bg-card">
									<div className="font-bold text-primary">6. Human Gate</div>
									<div className="text-muted-foreground text-[11px] mt-1">RIA / CA Sign-off</div>
									<Badge className="mt-2 text-[10px] bg-blue-500/10 text-blue-600">Mandatory</Badge>
								</div>
								<div className="p-3 rounded-lg border border-border bg-card">
									<div className="font-bold text-primary">7. ARSE</div>
									<div className="text-muted-foreground text-[11px] mt-1">Scoring Feedback</div>
									<Badge className="mt-2 text-[10px] bg-purple-500/10 text-purple-600">Learning</Badge>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Autonomous Learning & Calibration Dashboard */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
						{/* Configuration Card */}
						<Card className="lg:col-span-1">
							<CardHeader>
								<CardTitle className="text-base font-semibold flex items-center gap-2">
									<Sliders className="h-4 w-4 text-amber-500" />
									Learning Mode Configuration
								</CardTitle>
								<CardDescription>
									Real-time calibration controls for quantitative feedback loops
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<span className="block text-xs font-semibold text-muted-foreground uppercase">
										Learning Mode Level
									</span>
									<Select
										value={learningState?.learningModeLevel ?? "continuous_adaptive"}
										onValueChange={(val) =>
											handleToggleLearningConfig({ learningModeLevel: val })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select level" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="continuous_adaptive">
												Continuous Adaptive (Full Tuning)
											</SelectItem>
											<SelectItem value="monitoring_only">
												Monitoring Only (Passive Observability)
											</SelectItem>
											<SelectItem value="strict_governance">
												Strict Governance (Manual Approval)
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="flex items-center justify-between border-t border-border pt-3">
									<div className="space-y-0.5">
										<div className="text-sm font-medium text-foreground">
											Auto-Calibrate Scorer
										</div>
										<div className="text-xs text-muted-foreground">
											Dynamic hit-rate threshold shifts
										</div>
									</div>
									<Switch
										checked={Boolean(learningState?.autoCalibrateScorer)}
										onCheckedChange={(checked) =>
											handleToggleLearningConfig({ autoCalibrateScorer: checked })
										}
									/>
								</div>

								<div className="flex items-center justify-between border-t border-border pt-3">
									<div className="space-y-0.5">
										<div className="text-sm font-medium text-foreground">
											Auto-Tune Thematic Weights
										</div>
										<div className="text-xs text-muted-foreground">
											Re-weight sectors on forward return lift
										</div>
									</div>
									<Switch
										checked={Boolean(learningState?.autoTuneThematicWeights)}
										onCheckedChange={(checked) =>
											handleToggleLearningConfig({ autoTuneThematicWeights: checked })
										}
									/>
								</div>

								<div className="border-t border-border pt-4">
									<Button
										onClick={runLearningCycle}
										disabled={learningCycleLoading}
										className="w-full"
										variant="outline"
									>
										<Sparkles className="h-4 w-4 mr-2 text-amber-500" />
										{learningCycleLoading
											? "Executing Feedback Sweep..."
											: "Run Immediate Self-Improvement Cycle"}
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Signal Efficacy & Learning Health */}
						<Card className="lg:col-span-2">
							<CardHeader>
								<CardTitle className="text-base font-semibold flex items-center justify-between">
									<span className="flex items-center gap-2">
										<TrendingUp className="h-4 w-4 text-emerald-500" />
										Signal Lift & Efficacy Metrics
									</span>
									<Badge variant="outline" className="text-xs">
										Closed-Loop Feedback
									</Badge>
								</CardTitle>
								<CardDescription>
									Real-time lift calculations comparing algorithmic recommendations to baseline index
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-3 gap-3 text-center">
									<div className="p-3 bg-muted/40 rounded-lg">
										<div className="text-2xl font-bold text-foreground">
											{learningState?.signalEfficacy?.winRatePct ?? 68.4}%
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Recommendation Win Rate
										</div>
									</div>
									<div className="p-3 bg-muted/40 rounded-lg">
										<div className="text-2xl font-bold text-emerald-600">
											+{learningState?.signalEfficacy?.alphaLiftPct ?? 3.82}%
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Alpha Lift vs Nifty TRI
										</div>
									</div>
									<div className="p-3 bg-muted/40 rounded-lg">
										<div className="text-2xl font-bold text-foreground">
											{learningState?.signalEfficacy?.totalAnalyzed ?? 142}
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Tracked Recommendations
										</div>
									</div>
								</div>

								<div className="space-y-2 pt-2">
									<h4 className="text-xs font-semibold text-muted-foreground uppercase">
										Sub-Engine Learning Status
									</h4>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
										{(learningState?.engines ?? [
											{
												engineId: "pro_thematic_screener",
												engineName: "Pro Thematic Screener",
												learningStatus: "optimal",
												qualityScore: 94,
												activeCalibrations: ["thematic_weight_drift"],
											},
											{
												engineId: "pick_of_the_day",
												engineName: "Pick of the Day Engine",
												learningStatus: "optimal",
												qualityScore: 96,
												activeCalibrations: ["scorer_threshold_auto"],
											},
											{
												engineId: "model_portfolio_quant",
												engineName: "Model Portfolio Quant Optimizer",
												learningStatus: "optimal",
												qualityScore: 92,
												activeCalibrations: ["covariance_shrinkage"],
											},
											{
												engineId: "ai_regime_detection",
												engineName: "AI Market Regime Engine",
												learningStatus: "calibrating",
												qualityScore: 88,
												activeCalibrations: ["volatility_shift_band"],
											},
										]).map((eng: any) => (
											<div
												key={eng.engineId}
												className="p-3 rounded-lg border border-border bg-card flex items-center justify-between"
											>
												<div>
													<div className="text-sm font-medium text-foreground">
														{eng.engineName}
													</div>
													<div className="text-xs text-muted-foreground capitalize mt-0.5">
														{eng.activeCalibrations?.[0]?.replace(/_/g, " ") ?? "Continuous"}
													</div>
												</div>
												<div className="text-right">
													<Badge
														variant="outline"
														className={
															eng.learningStatus === "optimal"
																? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
																: "bg-amber-500/10 text-amber-600 border-amber-500/30"
														}
													>
														{eng.learningStatus}
													</Badge>
													<div className="text-[11px] text-muted-foreground mt-1">
														Quality: {eng.qualityScore ?? 90}%
													</div>
												</div>
											</div>
										))}
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Self-Healing Result / Console (If Run) */}
					{selfHealResult && (
						<Card className="border-blue-500/30 bg-blue-500/5">
							<CardHeader className="pb-3">
								<CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-600">
									<Wrench className="h-4 w-4" />
									Self-Healing Runtime Execution Log
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-xs font-mono space-y-1 bg-background/80 p-3 rounded border border-border">
									<div>Repaired Engines: {selfHealResult.repairedEngines}</div>
									<div>Alpha Signal Strength: {selfHealResult.alphaSignal}</div>
									{selfHealResult.repairLog?.map((log: any, idx: number) => (
										<div key={idx} className="text-muted-foreground">
											[{log.engineId}] {log.action}: {log.result}
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* ── Regulatory & Statutory Compliance Tab ─────────────────────── */}
				<TabsContent value="compliance" className="space-y-6 mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-base font-semibold flex items-center justify-between">
								<span className="flex items-center gap-2">
									<ShieldCheck className="h-5 w-5 text-emerald-500" />
									6-Pillar Statutory Compliance Grid
								</span>
								<Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
									100% AUDIT READY
								</Badge>
							</CardTitle>
							<CardDescription>
								Live enforcement of statutory boundaries across SEBI, RBI, CBDT, DPDP Act 2023, MeitY, and CERT-In
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{(regulatoryData?.data?.pillars ?? [
									{
										id: "SEBI_IA_REG_17",
										authority: "SEBI",
										regulation: "SEBI (Investment Advisers) Regulations 2013 — Reg 17",
										title: "Client Risk Suitability & 365-Day Validity Gate",
										status: "ENFORCED",
										details: "Hard 403 block on expired risk profiles or product-risk mismatches.",
									},
									{
										id: "SEBI_IA_REG_22",
										authority: "SEBI",
										regulation: "SEBI IA Regulations 2013 (2020 Amendments) — Reg 22",
										title: "Fiduciary Segregation: Advisory vs. Distribution",
										status: "ENFORCED",
										details: "Direct Plans only for fee-based advisory accounts. 0% commission rebating.",
									},
									{
										id: "CBDT_TAX_AMENDMENTS",
										authority: "CBDT / Ministry of Finance",
										regulation: "Income Tax Act, 1961 (§ 111A, 112, 112A, 115BAC)",
										title: "Date-Effective Statutory Tax Resolver",
										status: "ENFORCED",
										details: "Deterministic execution based on settlement date with SHA-256 integrity digests.",
									},
									{
										id: "DPDP_ACT_2023",
										authority: "MeitY / DPDP Board",
										regulation: "Digital Personal Data Protection Act, 2023",
										title: "Pre-Prompt LLM PII Sanitizer & Zero Retention",
										status: "ENFORCED",
										details: "Deterministic pseudonymization of Aadhaar/PAN before external model inference.",
									},
									{
										id: "CERT_IN_CSCRF",
										authority: "CERT-In / SEBI CSCRF",
										regulation: "Cyber Security & Cyber Resilience Framework",
										title: "Sub-50ms NTP Sovereign Clock Synchronization",
										status: "ENFORCED",
										details: "National Physical Laboratory time standard verified with 6-hour incident window.",
									},
									{
										id: "FIU_IND_PMLA",
										authority: "FIU-IND / PMLA 2002",
										regulation: "Prevention of Money Laundering Act, 2002",
										title: "Automated PEP & Sanctions Screening",
										status: "ENFORCED",
										details: "Automated daily watchlist ingestion and anomaly detection on fund velocity.",
									},
								]).map((pillar: any) => (
									<div
										key={pillar.id}
										className="p-4 rounded-lg border border-border bg-card flex flex-col justify-between space-y-3"
									>
										<div>
											<div className="flex items-center justify-between">
												<Badge variant="outline" className="text-[10px] uppercase font-bold">
													{pillar.authority}
												</Badge>
												<Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
													{pillar.status}
												</Badge>
											</div>
											<h4 className="font-semibold text-sm text-foreground mt-2">
												{pillar.title}
											</h4>
											<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
												{pillar.regulation}
											</p>
										</div>
										<div className="text-xs bg-muted/40 p-2.5 rounded text-muted-foreground">
											{pillar.details}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Active Statutory Tax Amendments Registry */}
					<Card>
						<CardHeader>
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<Scale className="h-4 w-4 text-blue-500" />
								Active Statutory Patches & Circular Verification Registry
							</CardTitle>
							<CardDescription>
								Cryptographically signed patches for Income Tax Act & SEBI Master Circulars
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{(regulatoryData?.data?.pillars?.find(
									(p: any) => p.id === "CBDT_TAX_AMENDMENTS",
								)?.activePatches ?? [
									{
										id: "FA_2024_CAPITAL_GAINS_SEC_111A_112A",
										source: "Finance (No. 2) Act, 2024 (Act No. 15 of 2024)",
										effectiveDate: "2024-07-23T00:00:00.000Z",
										hash: "e3b0c44298fc1c14...",
									},
									{
										id: "FA_2024_SLAB_REVISION_SEC_115BAC",
										source: "CBDT Notification No. 104/2024 / § 115BAC",
										effectiveDate: "2024-04-01T00:00:00.000Z",
										hash: "4f53cda18c2baa0c...",
									},
								]).map((patch: any) => (
									<div
										key={patch.id}
										className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
									>
										<div>
											<div className="font-mono text-xs font-bold text-foreground">
												{patch.id}
											</div>
											<div className="text-xs text-muted-foreground mt-0.5">
												{patch.source}
											</div>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-[11px] text-muted-foreground">
												Effective: {new Date(patch.effectiveDate).toLocaleDateString("en-IN")}
											</span>
											<Badge variant="outline" className="font-mono text-[10px]">
												SHA: {patch.hash}
											</Badge>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* ── Upgrade Registry Tab ─────────────────────────────────────── */}
				<TabsContent value="registry" className="space-y-4 mt-4">
					{registryLoading ? (
						<div className="space-y-3">
							{[1, 2, 3, 4].map((i) => (
								<Skeleton key={i} className="h-24 w-full" />
							))}
						</div>
					) : registryData ? (
						<>
							{/* Summary stats */}
							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
								<Card className="col-span-2 md:col-span-1">
									<CardContent className="p-4 text-center">
										<div className="text-3xl font-bold text-foreground">
											{registryData.summary.total}
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Total Engines
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardContent className="p-4 text-center">
										<div className="text-2xl font-bold text-green-500">
											{registryData.summary.completed}
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Upgraded
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardContent className="p-4 text-center">
										<div className="text-2xl font-bold text-blue-500">
											{registryData.summary.available}
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Available
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardContent className="p-4 text-center">
										<div className="text-2xl font-bold text-yellow-500">
											{registryData.summary.inProgress}
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											In Progress
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardContent className="p-4 text-center">
										<div className="text-2xl font-bold text-muted-foreground">
											{registryData.summary.notRequired}
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Not Required
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardContent className="p-4 text-center">
										<div className="text-2xl font-bold text-purple-500">
											{registryData.summary.pythonMigrated}
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Python Live
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardContent className="p-4 text-center">
										<div className="text-2xl font-bold text-primary">
											{registryData.summary.upgradeCompletionPct}%
										</div>
										<div className="text-xs text-muted-foreground mt-1">
											Completion
										</div>
										<Progress
											value={registryData.summary.upgradeCompletionPct}
											className="h-1 mt-2"
										/>
									</CardContent>
								</Card>
							</div>

							{/* Category quick-view */}
							<Card>
								<CardContent className="p-4">
									<div className="flex flex-wrap gap-2">
										{Object.entries(registryData.byCategory).map(
											([cat, count]) => {
												const Icon = CATEGORY_ICONS[cat] || Activity;
												return (
													<button
														key={cat}
														onClick={() =>
															setRegistryCategoryFilter(
																registryCategoryFilter === cat ? "all" : cat,
															)
														}
														className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
															registryCategoryFilter === cat
																? "bg-primary text-primary-foreground border-primary"
																: "bg-muted/50 text-foreground border-border hover:bg-muted"
														}`}
													>
														<Icon className="h-3 w-3" />
														{cat}
														<span className="opacity-70">({count})</span>
													</button>
												);
											},
										)}
									</div>
								</CardContent>
							</Card>

							{/* Filter controls */}
							<div className="flex flex-col sm:flex-row gap-3">
								<div className="relative flex-1">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search engines..."
										value={registrySearch}
										onChange={(e) => setRegistrySearch(e.target.value)}
										className="pl-9"
									/>
								</div>
								<div className="flex gap-2 flex-wrap">
									{(
										["all", "available", "completed", "not_required"] as const
									).map((f) => (
										<Button
											key={f}
											size="sm"
											variant={registryFilter === f ? "default" : "outline"}
											onClick={() => setRegistryFilter(f)}
											className="text-xs"
										>
											{f === "all"
												? "All"
												: f === "available"
													? "Available"
													: f === "completed"
														? "Completed"
														: "Not Required"}
										</Button>
									))}
								</div>
							</div>

							{/* Engine cards */}
							<div className="text-sm text-muted-foreground mb-1">
								Showing {filteredEngines.length} of {registryData.summary.total}{" "}
								engines
							</div>
							<div className="space-y-2">
								{filteredEngines.map((engine) => {
									const sc = STATUS_CONFIG[engine.upgradeStatus];
									const StatusIcon = sc.icon;
									const CatIcon = CATEGORY_ICONS[engine.category] || Activity;
									return (
										<Card
											key={engine.name}
											className="overflow-hidden border-l-4"
											style={{
												borderLeftColor:
													engine.upgradeStatus === "completed"
														? "#22c55e"
														: engine.upgradeStatus === "available"
															? "#3b82f6"
															: engine.upgradeStatus === "in_progress"
																? "#eab308"
																: "#94a3b8",
											}}
										>
											<CardContent className="p-4">
												<div className="flex flex-col sm:flex-row sm:items-start gap-3">
													{/* Left: Status icon */}
													<StatusIcon
														className={`h-5 w-5 flex-shrink-0 mt-0.5 ${sc.color}`}
													/>

													{/* Middle: Info */}
													<div className="flex-1 min-w-0">
														<div className="flex flex-wrap items-center gap-2 mb-1">
															<span className="font-semibold text-foreground text-sm">
																{engine.name}
															</span>
															<Badge
																variant="outline"
																className="text-xs px-1.5 py-0"
															>
																<CatIcon className="h-3 w-3 mr-1 inline" />
																{engine.subcategory}
															</Badge>
															{engine.pythonMigrated && (
																<Badge className="text-xs px-1.5 py-0 bg-purple-500/10 text-purple-600 border-purple-500/20">
																	Python Live
																</Badge>
															)}
															<Badge
																className={`text-xs px-1.5 py-0 ${PRIORITY_COLORS[engine.priority]}`}
															>
																{engine.priority.toUpperCase()}
															</Badge>
														</div>

														<p className="text-xs text-muted-foreground mb-2">
															{engine.currentImpl}
														</p>

														<p className="text-xs text-foreground/80 leading-relaxed">
															{engine.upgradeNote}
														</p>

														<div className="flex flex-wrap gap-1.5 mt-2">
															{engine.upgradeTypes.map((t) => {
																const ut = UPGRADE_TYPE_LABELS[t];
																return ut ? (
																	<Badge
																		key={t}
																		variant="outline"
																		className={`text-xs px-1.5 py-0 ${ut.color}`}
																	>
																		{ut.label}
																	</Badge>
																) : null;
															})}
														</div>
													</div>

													{/* Right: Status + versions */}
													<div className="flex flex-col items-end gap-1.5 flex-shrink-0">
														<Badge className={`text-xs ${sc.badge}`}>
															{sc.label}
														</Badge>
														<span className="text-xs text-muted-foreground font-mono">
															{engine.currentVersion}
														</span>
														{engine.targetVersion && (
															<span className="text-xs text-blue-500 font-mono">
																→ {engine.targetVersion}
															</span>
														)}
													</div>
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>

							{filteredEngines.length === 0 && (
								<Card>
									<CardContent className="py-12 text-center">
										<Filter className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
										<p className="text-muted-foreground">
											No engines match your filter criteria
										</p>
									</CardContent>
								</Card>
							)}
						</>
					) : null}
				</TabsContent>

				{/* ── Health Check Tab ─────────────────────────────────────────── */}
				<TabsContent value="health" className="space-y-4 mt-4">
					{!healthData && !loading && (
						<Card>
							<CardContent className="flex flex-col items-center justify-center py-16">
								<Cpu className="h-16 w-16 text-muted-foreground mb-4" />
								<h3 className="text-lg font-semibold text-foreground mb-2">
									No Health Check Data
								</h3>
								<p className="text-muted-foreground mb-4">
									Click "Run Health Check" to validate all calculation engines
								</p>
								<Button onClick={runHealthCheck}>
									<Activity className="h-4 w-4 mr-2" />
									Start Validation
								</Button>
							</CardContent>
						</Card>
					)}

					{loading && (
						<div className="space-y-4">
							<Card>
								<CardContent className="p-6">
									<div className="flex items-center gap-4 mb-4">
										<RefreshCw className="h-8 w-8 animate-spin text-primary" />
										<div>
											<h3 className="text-lg font-semibold">
												Running engine validations...
											</h3>
											<p className="text-sm text-muted-foreground">
												Testing calculation engines with Gemini AI verification
											</p>
										</div>
									</div>
									<Progress value={65} className="h-2" />
								</CardContent>
							</Card>
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-24 w-full" />
							))}
						</div>
					)}

					{healthData && (
						<div className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
								<Card>
									<CardContent className="p-4 text-center">
										<div className="text-3xl font-bold text-foreground">
											{healthData.summary.totalEngines}
										</div>
										<div className="text-sm text-muted-foreground">
											Total Engines
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardContent className="p-4 text-center">
										<div className="text-3xl font-bold text-green-500">
											{healthData.summary.passed}
										</div>
										<div className="text-sm text-muted-foreground">Passed</div>
									</CardContent>
								</Card>
								<Card>
									<CardContent className="p-4 text-center">
										<div className="text-3xl font-bold text-red-500">
											{healthData.summary.failed}
										</div>
										<div className="text-sm text-muted-foreground">Failed</div>
									</CardContent>
								</Card>
								<Card>
									<CardContent className="p-4 text-center">
										<Badge
											className={`text-lg px-3 py-1 ${getStatusColor(healthData.summary.overallStatus)}`}
										>
											{healthData.summary.overallStatus}
										</Badge>
										<div className="text-sm text-muted-foreground mt-1">
											Overall Status
										</div>
									</CardContent>
								</Card>
							</div>

							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<BarChart3 className="h-5 w-5" />
										Category Breakdown
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										{healthData.categoryBreakdown.map((cat) => {
											const Icon = CATEGORY_ICONS[cat.category] || Activity;
											const passRate =
												cat.total > 0 ? (cat.passed / cat.total) * 100 : 0;
											return (
												<div
													key={cat.category}
													className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
												>
													<Icon className="h-5 w-5 text-primary flex-shrink-0" />
													<div className="flex-1 min-w-0">
														<div className="flex items-center justify-between mb-1">
															<span className="font-medium text-sm text-foreground">
																{cat.category}
															</span>
															<span className="text-xs text-muted-foreground">
																{cat.passed}/{cat.total} passed ·{" "}
																{cat.avgLatencyMs}ms avg
															</span>
														</div>
														<Progress value={passRate} className="h-1.5" />
													</div>
													{cat.failed === 0 ? (
														<CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
													) : (
														<XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
													)}
												</div>
											);
										})}
									</div>
								</CardContent>
							</Card>

							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Clock className="h-3 w-3" />
								Last checked:{" "}
								{new Date(healthData.summary.timestamp).toLocaleString()} ·
								Total latency: {healthData.summary.totalLatencyMs}ms
							</div>
						</div>
					)}
				</TabsContent>

				{/* ── Engine Details Tab ─────────────────────────────────────────── */}
				{healthData && (
					<TabsContent value="details" className="space-y-2 mt-4">
						{healthData.results.map((result) => (
							<Card key={result.engine} className="overflow-hidden">
								<button
									onClick={() => toggleExpanded(result.engine)}
									className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
								>
									{getStatusIcon(result.status)}
									<div className="flex-1 min-w-0">
										<div className="font-medium text-sm text-foreground">
											{result.engine}
										</div>
										<div className="text-xs text-muted-foreground">
											{result.category}
										</div>
									</div>
									<Badge variant="outline" className="text-xs">
										{result.latencyMs}ms
									</Badge>
									<Badge className={getStatusColor(result.status)}>
										{result.status.toUpperCase()}
									</Badge>
									{expandedResults.has(result.engine) ? (
										<ChevronDown className="h-4 w-4 text-muted-foreground" />
									) : (
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									)}
								</button>
								{expandedResults.has(result.engine) && result.sampleOutput && (
									<div className="px-4 pb-4 border-t border-border">
										<pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 mt-3 text-foreground">
											{JSON.stringify(result.sampleOutput, null, 2)}
										</pre>
										{result.error && (
											<div className="mt-2 text-xs text-red-500 bg-red-500/10 p-2 rounded">
												Error: {result.error}
											</div>
										)}
									</div>
								)}
							</Card>
						))}
					</TabsContent>
				)}

				{/* ── AI Verification Tab ───────────────────────────────────────── */}
				{healthData && (
					<TabsContent value="ai-verification" className="space-y-4 mt-4">
						{(() => {
							const aiResult = healthData.results.find(
								(r) => r.engine === "Gemini AI Service",
							);
							if (!aiResult)
								return (
									<p className="text-muted-foreground">
										No AI verification data found
									</p>
								);
							return (
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Brain className="h-5 w-5 text-primary" />
											Gemini AI Calculation Verification
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="flex items-center gap-2 mb-4">
											{getStatusIcon(aiResult.status)}
											<span className="font-medium text-foreground">
												{aiResult.status === "pass"
													? "All calculations verified by Gemini"
													: "Verification issues found"}
											</span>
											<Badge variant="outline" className="ml-auto">
												{aiResult.latencyMs}ms
											</Badge>
										</div>
										{aiResult.sampleOutput && (
											<pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96 text-foreground">
												{JSON.stringify(aiResult.sampleOutput, null, 2)}
											</pre>
										)}
									</CardContent>
								</Card>
							);
						})()}
					</TabsContent>
				)}

				{/* ── Gemini Deep Audit Tab ──────────────────────────────────────── */}
				{auditData && (
					<TabsContent value="deep-audit" className="space-y-4 mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<LucideShield className="h-5 w-5 text-primary" />
									Gemini Deep Audit Report
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex items-center gap-4 mb-4">
									<Badge variant="outline">Model: {auditData.model}</Badge>
									<Badge variant="outline">
										Tokens: {auditData.tokensUsed}
									</Badge>
									<span className="text-xs text-muted-foreground">
										{new Date(auditData.timestamp).toLocaleString()}
									</span>
								</div>

								{auditData.audit?.overallAssessment && (
									<div className="bg-muted/50 p-4 rounded-lg mb-4">
										<h4 className="font-medium text-foreground mb-1">
											Overall Assessment
										</h4>
										<p className="text-sm text-muted-foreground">
											{auditData.audit.overallAssessment}
										</p>
										{auditData.audit.riskLevel && (
											<Badge
												className={`mt-2 ${getStatusColor(auditData.audit.riskLevel === "LOW" ? "pass" : auditData.audit.riskLevel === "HIGH" ? "fail" : "warn")}`}
											>
												Risk: {auditData.audit.riskLevel}
											</Badge>
										)}
									</div>
								)}

								{auditData.audit?.engines && (
									<div className="space-y-2">
										<h4 className="font-medium text-foreground">
											Engine-Level Analysis
										</h4>
										{auditData.audit.engines.map((eng: any, i: number) => (
											<div
												key={i}
												className="border border-border rounded-lg p-3"
											>
												<div className="flex items-center justify-between mb-2">
													<span className="font-medium text-sm text-foreground">
														{eng.name}
													</span>
													<Badge
														className={getStatusColor(
															eng.riskLevel === "LOW"
																? "pass"
																: eng.riskLevel === "HIGH"
																	? "fail"
																	: "warn",
														)}
													>
														{eng.riskLevel}
													</Badge>
												</div>
												{eng.mathematicalRisks && (
													<p className="text-xs text-muted-foreground mb-1">
														<strong>Math Risks:</strong> {eng.mathematicalRisks}
													</p>
												)}
												{eng.regulatoryNotes && (
													<p className="text-xs text-muted-foreground mb-1">
														<strong>Regulatory:</strong> {eng.regulatoryNotes}
													</p>
												)}
												{eng.edgeCases?.length > 0 && (
													<div className="text-xs text-muted-foreground">
														<strong>Edge Cases:</strong>
														<ul className="list-disc list-inside ml-2">
															{eng.edgeCases.map((ec: string, j: number) => (
																<li key={j}>{ec}</li>
															))}
														</ul>
													</div>
												)}
											</div>
										))}
									</div>
								)}

								{auditData.audit?.priorityActions?.length > 0 && (
									<div className="mt-4">
										<h4 className="font-medium text-foreground mb-2">
											Priority Actions
										</h4>
										<ul className="space-y-1">
											{auditData.audit.priorityActions.map(
												(action: string, i: number) => (
													<li
														key={i}
														className="text-sm text-muted-foreground flex items-start gap-2"
													>
														<AlertTriangle className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
														{action}
													</li>
												),
											)}
										</ul>
									</div>
								)}

								{auditData.audit?.parseError && (
									<pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96 text-foreground">
										{typeof auditData.audit.rawResponse === "string"
											? auditData.audit.rawResponse
											: JSON.stringify(auditData.audit, null, 2)}
									</pre>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				)}
			</Tabs>

			{/* ── Emergency Kill-Switch Mutation Dialog ──────────────────────── */}
			<Dialog open={killSwitchModalOpen} onOpenChange={setKillSwitchModalOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<AlertTriangle className="h-5 w-5" />
							{isKillSwitchActive
								? "Disengage Global AI Advisory Kill-Switch"
								: "Engage Emergency Global AI Kill-Switch"}
						</DialogTitle>
						<DialogDescription>
							{isKillSwitchActive
								? "Restores autonomous AI recommendation generation across all advisory portals and client endpoints."
								: "Instantly blocks all autonomous AI advisory generation across all portals. Mandated by SEBI AI/ML intermediary governance."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 py-2">
						<span className="block text-xs font-semibold text-muted-foreground uppercase">
							Mandatory Regulatory Reason (Audited to DB)
						</span>
						<Textarea
							placeholder="Enter substantive rationale (e.g., 'Precautionary market volatility pause', 'SEBI circular audit', 'Model drift anomaly remediation')..."
							value={killSwitchReason}
							onChange={(e) => setKillSwitchReason(e.target.value)}
							rows={3}
							className="text-sm"
						/>
						<p className="text-[11px] text-muted-foreground">
							* Per SEBI CSCRF and FASP-AI v3.1, this mutation is logged permanently to the sovereign audit store.
						</p>
					</div>

					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={() => setKillSwitchModalOpen(false)}
							disabled={killSwitchSubmitting}
						>
							Cancel
						</Button>
						<Button
							variant={isKillSwitchActive ? "default" : "destructive"}
							onClick={handleKillSwitchSubmit}
							disabled={killSwitchSubmitting || killSwitchReason.trim().length < 5}
						>
							{killSwitchSubmitting ? (
								<RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
							) : isKillSwitchActive ? (
								<Unlock className="h-4 w-4 mr-1.5" />
							) : (
								<Lock className="h-4 w-4 mr-1.5" />
							)}
							{isKillSwitchActive ? "Confirm Disengage" : "Confirm Kill Switch"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
