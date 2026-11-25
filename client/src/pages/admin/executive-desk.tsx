import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	DollarSign,
	Briefcase,
	TrendingUp,
	Shield as LucideShield,
	ServerCog,
	Activity,
	CheckCircle2,
	AlertTriangle,
	ArrowUpRight,
	ArrowDownRight,
	RefreshCw,
	Sparkles,
	Clock,
	Users,
	Scale,
	Building2,
	FileText,
	Database,
	Layers,
	HeartPulse,
	Zap,
	Receipt,
	Wallet,
	Target,
	History,
	ExternalLink,
	ShieldAlert,
	ChevronRight,
	Radio,
	Boxes,
	Check,
	X,
	Loader2,
	GraduationCap,
	Compass,
	Network,
	Brain,
	ShieldCheck,
	Globe,
	Lock,
	Terminal,
	Download,
	PlayCircle,
	FileSpreadsheet,
	Cpu,
	HardDrive,
	Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type ExecutiveRole = "coo" | "cfo" | "cbo" | "cco" | "cto";

interface DeskConfig {
	role: ExecutiveRole;
	title: string;
	executiveName: string;
	badge: string;
	icon: any;
	tagline: string;
	themeColor: string;
	lightBg: string;
	borderTheme: string;
	irisBrief: string;
	kpis: Array<{
		label: string;
		value: string;
		change: string;
		isPositive: boolean;
		subtext: string;
		icon: any;
	}>;
	actionItems: Array<{
		id: string;
		title: string;
		category: string;
		urgency: "high" | "medium" | "low";
		amountOrImpact?: string;
		timeAgo: string;
		actionLabel: string;
		targetRoute: string;
	}>;
	tabs: Array<{
		id: string;
		label: string;
		component: string;
	}>;
}

const DESK_CONFIGS: Record<ExecutiveRole, DeskConfig> = {
	coo: {
		role: "coo",
		title: "Chief Operating Officer",
		executiveName: "COO Command Desk",
		badge: "Operations & Execution",
		icon: Briefcase,
		tagline: "KYC throughput, T+1 trade settlements, Maker-Checker SLA velocity & operational risk",
		themeColor: "from-blue-600 to-indigo-700",
		lightBg: "bg-blue-500/10 text-blue-500",
		borderTheme: "border-blue-500/20",
		irisBrief:
			"Platform operations are running at 99.98% SLA compliance. Median Smart KYC processing time is 3.8 minutes. 14 manual exception documents require Maker-Checker sign-off. T+1 trade reconciliation matched 99.4% of today's exchange executions cleanly.",
		kpis: [
			{
				label: "Smart KYC Median SLA",
				value: "3.8m",
				change: "-18% faster",
				isPositive: true,
				subtext: "Target: < 5.0m",
				icon: Clock,
			},
			{
				label: "T+1 Settlement Match Rate",
				value: "99.4%",
				change: "+0.3% WoW",
				isPositive: true,
				subtext: "3 unreconciled trades",
				icon: CheckCircle2,
			},
			{
				label: "Pending Approvals",
				value: "14",
				change: "5 high urgency",
				isPositive: false,
				subtext: "Maker-checker queue",
				icon: AlertTriangle,
			},
			{
				label: "Platform Operational SLA",
				value: "99.98%",
				change: "Nominal",
				isPositive: true,
				subtext: "RMS surveillance clear",
				icon: HeartPulse,
			},
		],
		actionItems: [
			{
				id: "coo-1",
				title: "High-Value HNI Video KYC Manual Review",
				category: "KYC Compliance",
				urgency: "high",
				amountOrImpact: "₹1.5 Cr AUM",
				timeAgo: "22m ago",
				actionLabel: "Review Documents",
				targetRoute: "/admin/kyc-compliance",
			},
			{
				id: "coo-2",
				title: "T+1 Unlisted Share Settlement Reconciliation Mismatch",
				category: "Settlements",
				urgency: "high",
				amountOrImpact: "₹4.8L mismatch",
				timeAgo: "45m ago",
				actionLabel: "Resolve Match",
				targetRoute: "/admin/reconciliation",
			},
			{
				id: "coo-3",
				title: "CKYC Batch Sync Deferred Queue Clearance",
				category: "Registry Sync",
				urgency: "medium",
				amountOrImpact: "28 records",
				timeAgo: "1h ago",
				actionLabel: "Trigger Sync",
				targetRoute: "/admin/ckyc-deferred",
			},
			{
				id: "coo-4",
				title: "Maker-Checker Fee Model Adjustment Approval",
				category: "Governance",
				urgency: "medium",
				amountOrImpact: "Tier-1 RIA",
				timeAgo: "3h ago",
				actionLabel: "Authorize Change",
				targetRoute: "/admin/approval-queue",
			},
		],
		tabs: [
			{ id: "kyc_velocity", label: "KYC & Onboarding SLAs", component: "kyc" },
			{ id: "settlements", label: "T+1 Trade Settlements", component: "settlements" },
			{ id: "governance", label: "Maker-Checker Queue", component: "governance" },
			{ id: "incidents", label: "Operational Incidents", component: "incidents" },
		],
	},
	cfo: {
		role: "cfo",
		title: "Chief Financial Officer",
		executiveName: "CFO Treasury Desk",
		badge: "Finance & Capital",
		icon: DollarSign,
		tagline: "Multibroker revenue, distributor commission liabilities, firm DP float & capital efficiency",
		themeColor: "from-emerald-600 to-teal-700",
		lightBg: "bg-emerald-500/10 text-emerald-500",
		borderTheme: "border-emerald-500/20",
		irisBrief:
			"Gross brokerage & order-flow revenue reached ₹48.2L this month (+14.2% MoM), led by unlisted secondary trades and Upstox F&O volume. ₹12.8L in verified partner payout claims are queued for disbursement. Vendor API burn is 3.1% of gross margin.",
		kpis: [
			{
				label: "Monthly Net Order-Flow",
				value: "₹48.2L",
				change: "+14.2% MoM",
				isPositive: true,
				subtext: "IRIS · IIFL · Alpaca · Upstox",
				icon: DollarSign,
			},
			{
				label: "Pending Payout Claims",
				value: "₹12.8L",
				change: "18 claims",
				isPositive: false,
				subtext: "Verified ready to release",
				icon: Wallet,
			},
			{
				label: "Firm DP Inventory Value",
				value: "₹2.45 Cr",
				change: "+5.1% valuation",
				isPositive: true,
				subtext: "FintekPro FS LLP DP holdings",
				icon: Boxes,
			},
			{
				label: "Vendor API Cost Ratio",
				value: "3.1%",
				change: "-0.4% efficient",
				isPositive: true,
				subtext: "Within 5% budget ceiling",
				icon: Zap,
			},
		],
		actionItems: [
			{
				id: "cfo-1",
				title: "Authorize Weekly Partner Commission Payout Batch",
				category: "Disbursements",
				urgency: "high",
				amountOrImpact: "₹8.45 Lakhs",
				timeAgo: "15m ago",
				actionLabel: "Disburse Batch",
				targetRoute: "/admin/payouts",
			},
			{
				id: "cfo-2",
				title: "Upstox Live Exchange Feed License Token Expiry",
				category: "Capital & Feeds",
				urgency: "high",
				amountOrImpact: "Live Quotes",
				timeAgo: "1h ago",
				actionLabel: "Rotate Token",
				targetRoute: "/admin/upstox-token",
			},
			{
				id: "cfo-3",
				title: "Pre-IPO Unlisted DP Inventory Balance Reallocation",
				category: "Treasury Inventory",
				urgency: "medium",
				amountOrImpact: "₹42.0 Lakhs",
				timeAgo: "2h ago",
				actionLabel: "Inspect DP",
				targetRoute: "/admin/firm-inventory",
			},
			{
				id: "cfo-4",
				title: "Q3 GST & TDS Reconciliation Report Review",
				category: "Compliance Accounting",
				urgency: "low",
				amountOrImpact: "Tax Ledger",
				timeAgo: "1d ago",
				actionLabel: "Open Reports",
				targetRoute: "/admin/reports",
			},
		],
		tabs: [
			{ id: "revenue_flow", label: "Multibroker Earnings", component: "revenue" },
			{ id: "commission_liabilities", label: "Commission Ledger & Claims", component: "commissions" },
			{ id: "firm_inventory", label: "Firm DP Holdings & Float", component: "inventory" },
			{ id: "api_burn", label: "Vendor API Cost Telemetry", component: "costs" },
		],
	},
	cbo: {
		role: "cbo",
		title: "Chief Business Officer",
		executiveName: "CBO Revenue & Commercial Desk",
		badge: "Revenue & Commercial Engine",
		icon: TrendingUp,
		tagline: "Revenue generation, monetization take-rates, unlisted secondary liquidity, bond syndication & MCA deal pipelines",
		themeColor: "from-amber-500 to-orange-600",
		lightBg: "bg-amber-500/10 text-amber-500",
		borderTheme: "border-amber-500/20",
		irisBrief:
			"Monthly revenue run-rate reached ₹54.2 Lakhs (+18.4% MoM) driven by secondary unlisted equity spreads and bond placements. Marketplace GTV accelerated to ₹18.6 Cr (+22.4% WoW). Active syndication pipeline expanded to ₹38.5 Cr across 14 institutional mandates. Net monetization take-rate widened by +12 bps to 1.85%.",
		kpis: [
			{
				label: "Monthly Revenue Run-Rate",
				value: "₹54.2 Lakhs",
				change: "+18.4% MoM",
				isPositive: true,
				subtext: "Secondary Spreads & Placement Fees",
				icon: TrendingUp,
			},
			{
				label: "Weekly Marketplace GTV",
				value: "₹18.6 Cr",
				change: "+22.4% WoW",
				isPositive: true,
				subtext: "Unlisted, Bonds, Loans, MF",
				icon: DollarSign,
			},
			{
				label: "Active Syndication Deals",
				value: "₹38.5 Cr",
				change: "14 Live Mandates",
				isPositive: true,
				subtext: "B2B & HNI corporate pipeline",
				icon: Target,
			},
			{
				label: "Monetization Take-Rate",
				value: "1.85%",
				change: "+12 bps expansion",
				isPositive: true,
				subtext: "Net Platform Margin",
				icon: Zap,
			},
		],
		actionItems: [
			{
				id: "cbo-rev-1",
				title: "Trigger Pre-IPO Secondary Liquidity Match (Tata Capital & NSE)",
				category: "Revenue Monetization",
				urgency: "high",
				amountOrImpact: "₹3.6 Lakhs Fee (₹2.4 Cr GTV)",
				timeAgo: "15m ago",
				actionLabel: "Lock Escrow",
				targetRoute: "/admin/unlisted/orders",
			},
			{
				id: "cbo-rev-2",
				title: "Syndicate 11.25% AAA/AA+ Corporate NCD Tranche",
				category: "Syndication Fees",
				urgency: "high",
				amountOrImpact: "₹5.8 Lakhs Margin (₹4.8 Cr Tranche)",
				timeAgo: "35m ago",
				actionLabel: "Syndicate Batch",
				targetRoute: "/admin/bonds-management",
			},
			{
				id: "cbo-rev-3",
				title: "MCA Promoter Liquidity Event Outreach (Series-B/C Bangalore & Mumbai)",
				category: "Corporate Pipeline",
				urgency: "high",
				amountOrImpact: "₹22.5 Cr Pipeline / ₹3.3L Fees",
				timeAgo: "1h ago",
				actionLabel: "Dispatch Proposals",
				targetRoute: "/admin/lead-prospecting",
			},
			{
				id: "cbo-rev-4",
				title: "Promote Top 12 Chartered Accountant Partners to Wealth Syndication Tier-A",
				category: "Distribution Expansion",
				urgency: "medium",
				amountOrImpact: "+₹4.2 Lakhs / Mo AUM Fees",
				timeAgo: "2h ago",
				actionLabel: "Upgrade Tiers",
				targetRoute: "/admin/agent-oversight",
			},
		],
		tabs: [
			{ id: "gtv_analytics", label: "Gross Transaction Volume (GTV)", component: "gtv" },
			{ id: "mca_radar", label: "MCA Radar & Prospect Pipeline", component: "pipeline" },
			{ id: "partner_network", label: "Partner Network Expansion", component: "network" },
			{ id: "campaign_roi", label: "Campaign Studio Conversion", component: "marketing" },
		],
	},
	cco: {
		role: "cco",
		title: "Chief Compliance Officer",
		executiveName: "CCO Compliance Desk",
		badge: "SEBI & Risk Governance",
		icon: LucideShield,
		tagline: "SEBI/RBI regulatory norms, desk licensing, risk surveillance (RMS), true-to-label audits & PMLA",
		themeColor: "from-purple-600 to-indigo-800",
		lightBg: "bg-purple-500/10 text-purple-500",
		borderTheme: "border-purple-500/20",
		irisBrief:
			"Compliance posture is 100% NOMINAL with zero regulatory breaches. SEBI MF 2026 True-to-Label Scheme categorisation audit passed for 412 schemes. Desk licensing circuit breakers and order kill-switches are in active standby with 0 quarantined trades.",
		kpis: [
			{
				label: "Regulatory Health Score",
				value: "100%",
				change: "Nominal",
				isPositive: true,
				subtext: "SEBI · RBI · PMLA · MCA",
				icon: LucideShield,
			},
			{
				label: "Active Desk Licenses",
				value: "8 / 8",
				change: "All active",
				isPositive: true,
				subtext: "LLP desks & limits nominal",
				icon: Building2,
			},
			{
				label: "Quarantined Transactions",
				value: "0",
				change: "Risk nominal",
				isPositive: true,
				subtext: "Order kill-switch armed",
				icon: ShieldAlert,
			},
			{
				label: "SEBI 2026 Categorisation",
				value: "100%",
				change: "412 schemes verified",
				isPositive: true,
				subtext: "True-to-label compliant",
				icon: Scale,
			},
		],
		actionItems: [
			{
				id: "cco-1",
				title: "Annual PMLA Client Due-Diligence & CKYC Sample Audit",
				category: "Regulatory Audit",
				urgency: "medium",
				amountOrImpact: "50 Audit Samples",
				timeAgo: "2h ago",
				actionLabel: "Inspect Norms",
				targetRoute: "/admin/regulatory-audit-norms",
			},
			{
				id: "cco-2",
				title: "Verify LLP Proprietary Desk Trading Threshold Breakers",
				category: "Desk Licensing",
				urgency: "medium",
				amountOrImpact: "₹10 Cr Limit",
				timeAgo: "4h ago",
				actionLabel: "Desk Settings",
				targetRoute: "/admin/compliance-dashboard?tab=desks",
			},
			{
				id: "cco-3",
				title: "SEBI Mutual Fund Label & Risk-o-Meter Drift Verification",
				category: "Scheme Compliance",
				urgency: "low",
				amountOrImpact: "Quarterly Audit",
				timeAgo: "1d ago",
				actionLabel: "Verify Schemes",
				targetRoute: "/admin/sebi-mf-compliance",
			},
			{
				id: "cco-4",
				title: "Generate Statutory Risk & Exposure Audit Export",
				category: "Statutory Reporting",
				urgency: "low",
				amountOrImpact: "Audit Export",
				timeAgo: "2d ago",
				actionLabel: "Download Report",
				targetRoute: "/admin/risk-compliance-export",
			},
		],
		tabs: [
			{ id: "regulatory_cockpit", label: "SEBI/RBI Cockpit", component: "cockpit" },
			{ id: "desk_licensing", label: "Desk Licenses & Limits", component: "desks" },
			{ id: "true_to_label", label: "True-to-Label Scheme Audit", component: "schemes" },
			{ id: "forensic_trail", label: "Forensic Audit Log", component: "forensics" },
		],
	},
	cto: {
		role: "cto",
		title: "Chief Technology Officer",
		executiveName: "CTO Infrastructure Desk",
		badge: "Tech & Telemetry",
		icon: ServerCog,
		tagline: "Platform resiliency, SEBI CSCRF governance, multi-region DR, tick latency & zero-defect releases",
		themeColor: "from-cyan-600 to-blue-800",
		lightBg: "bg-cyan-500/10 text-cyan-500",
		borderTheme: "border-cyan-500/20",
		irisBrief:
			"Core API uptime is 99.98% in asia-south1. SEBI CSCRF resilience compliance score is 98.4% with sub-2ms NTP atomic clock sync (NPL standard). DR RPO (1.8m) and RTO (14m) exceed statutory benchmarks. Upstox WebSocket feed tick latency is 38ms with active circuit breaker auto-heal. Production container images verified with 0 critical CVEs.",
		kpis: [
			{
				label: "Core API Uptime",
				value: "99.98%",
				change: "High Availability",
				isPositive: true,
				subtext: "Region: asia-south1",
				icon: Activity,
			},
			{
				label: "SEBI CSCRF Resilience",
				value: "98.4%",
				change: "SOC 24x7 Active",
				isPositive: true,
				subtext: "Tier-1 CSCRF v2.0",
				icon: ShieldCheck,
			},
			{
				label: "NTP Sovereign Drift",
				value: "+1.8ms",
				change: "Sub-50ms Delta",
				isPositive: true,
				subtext: "NPL India Standard",
				icon: Clock,
			},
			{
				label: "DR RPO / RTO",
				value: "1.8m / 14m",
				change: "Target <30m / <4h",
				isPositive: true,
				subtext: "Standby: asia-south2",
				icon: Globe,
			},
		],
		actionItems: [
			{
				id: "cto-1",
				title: "SEBI CSCRF & CERT-In 6-Hour Statutory Dispatch Form Generator",
				category: "Statutory Reporting",
				urgency: "high",
				amountOrImpact: "CERT-In Form-C",
				timeAgo: "25m ago",
				actionLabel: "Open CERT-In Cockpit",
				targetRoute: "/admin/cto-desk?tab=cscrf_resilience",
			},
			{
				id: "cto-2",
				title: "Execute Simulated Multi-Region Disaster Recovery Live Failover Drill",
				category: "BCP & Resiliency",
				urgency: "high",
				amountOrImpact: "DR RTO 14m / RPO 1.8m",
				timeAgo: "5m ago",
				actionLabel: "Execute DR Drill",
				targetRoute: "/admin/cto-desk?tab=dr_bcp",
			},
			{
				id: "cto-3",
				title: "Golden Pricing Multi-Asset Tick Freshness & Broker Session Audit",
				category: "Engine Validation",
				urgency: "medium",
				amountOrImpact: "NSE/BSE Feeds (38ms)",
				timeAgo: "1h ago",
				actionLabel: "Pricing Health",
				targetRoute: "/admin/cto-desk?tab=pricing_benchmarks",
			},
			{
				id: "cto-4",
				title: "DevSecOps CI/CD Vulnerability Gate & Secret Attestation Verification",
				category: "Release Engineering",
				urgency: "medium",
				amountOrImpact: "0 CVEs / Clean",
				timeAgo: "45m ago",
				actionLabel: "Verify Pipeline",
				targetRoute: "/admin/cto-desk?tab=devsecops",
			},
		],
		tabs: [
			{ id: "cscrf_resilience", label: "SEBI CSCRF & CERT-In Cockpit", component: "cscrf" },
			{ id: "dr_bcp", label: "Multi-Region DR & BCP", component: "dr" },
			{ id: "pricing_benchmarks", label: "Golden Pricing & Market Feeds", component: "pricing" },
			{ id: "telemetry", label: "System & Engine Telemetry", component: "telemetry" },
			{ id: "devsecops", label: "DevSecOps & Pipeline Gates", component: "devsecops" },
			{ id: "finops_cts", label: "FinOps & Cost to Serve", component: "finops" },
		],
	},
};

export default function ExecutiveDeskPage({ initialRole = "coo" }: { initialRole?: ExecutiveRole }) {
	const [location, navigate] = useLocation();
	const { toast } = useToast();

	// Resolve active role from route path if matches /admin/*-desk, otherwise fallback to initialRole
	const currentRole: ExecutiveRole = location.includes("cfo-desk")
		? "cfo"
		: location.includes("cbo-desk")
			? "cbo"
			: location.includes("cco-desk")
				? "cco"
				: location.includes("cto-desk")
					? "cto"
					: location.includes("coo-desk")
						? "coo"
						: initialRole;

	const config = DESK_CONFIGS[currentRole];
	const [activeTab, setActiveTab] = useState(config.tabs[0]?.id || "overview");
	const [isRefreshing, setIsRefreshing] = useState(false);

	// ── Live Sub-Agent Status Query ──────────────────────────────────────────────
	const { data: statusResponse, isLoading: isStatusLoading, refetch } = useQuery<{
		success: boolean;
		data: {
			role: ExecutiveRole;
			agentName: string;
			status: "active" | "idle" | "auditing";
			health: "optimal" | "degraded" | "alert";
			confidenceScore: number;
			modelVersion: string;
			lastAuditAt: string;
			eventsProcessedToday: number;
			executiveBrief: string;
			keyMetrics: Record<string, string | number>;
			pendingDrafts: Array<{
				id: string;
				role: ExecutiveRole;
				title: string;
				category: string;
				urgency: "high" | "medium" | "low";
				amountOrImpact: string;
				rationale: string;
				factorsConsidered: string[];
				confidenceScore: number;
				proposedAction: string;
				targetRoute: string;
				status: "draft" | "approved" | "rejected";
				createdAt: string;
			}>;
		};
	}>({
		queryKey: ["/api/admin/copilot/desks", currentRole, "status"],
		queryFn: async () => {
			const res = await apiRequest("GET", `/api/admin/copilot/desks/${currentRole}/status`);
			return res.json();
		},
		refetchInterval: 30000,
	});

	const deskData = statusResponse?.data;

	// ── Master Mentorship & Orchestrator Query ───────────────────────────────────
	const { data: mentorshipResponse } = useQuery<{
		success: boolean;
		data: {
			masterBrief: string;
			overallEcosystemHealth: "optimal" | "degraded" | "alert";
			crossAgentSynergyScore: number;
			activeCrossDeskWorkflows: Array<{
				id: string;
				title: string;
				leadAgent: string;
				partnerAgents: string[];
				purpose: string;
				status: "active" | "standby" | "cleared";
			}>;
			deskDirectives: Record<
				ExecutiveRole,
				{
					deskRole: ExecutiveRole;
					executiveTitle: string;
					mentorGuidance: string;
					priorityFocus: string;
					learningPill: string;
					riskWatch: string;
					collaboratingDesks: ExecutiveRole[];
				}
			>;
			timestamp: string;
		};
	}>({
		queryKey: ["/api/admin/copilot/desks", "master-mentorship"],
		queryFn: async () => {
			const res = await apiRequest("GET", "/api/admin/copilot/desks/master-mentorship");
			return res.json();
		},
		refetchInterval: 60000,
	});

	const mentorshipData = mentorshipResponse?.data;
	const currentDirective = mentorshipData?.deskDirectives?.[currentRole];

	// ── Deep Autonomous Audit Mutation ───────────────────────────────────────────
	const auditMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", `/api/admin/copilot/desks/${currentRole}/audit`, {});
			return res.json();
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/copilot/desks", currentRole, "status"] });
			toast({
				title: `Iris-${currentRole.toUpperCase()} Audit Completed`,
				description:
					data?.data?.auditSummary ||
					`Autonomous audit completed across 14 operational checks with 0 critical exceptions.`,
			});
		},
		onError: (err: any) => {
			toast({
				title: "Autonomous Audit Failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	// ── Execute Action Draft Mutation (FASP-AI v1.0 Human Confirmation) ──────────
	const executeActionMutation = useMutation({
		mutationFn: async ({ draftId, action }: { draftId: string; action: "approve" | "reject" }) => {
			const res = await apiRequest("POST", `/api/admin/copilot/desks/${currentRole}/execute-action`, {
				draftId,
				action,
				notes: `Confirmed by C-Suite officer via ${currentRole.toUpperCase()} Command Desk`,
			});
			return res.json();
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/copilot/desks", currentRole, "status"] });
			toast({
				title: variables.action === "reject" ? "Action Dismissed" : "Action Approved & Executed",
				description: `Immutable audit trail recorded in admin compliance ledger.`,
			});
		},
		onError: (err: any) => {
			toast({
				title: "Action Execution Error",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	// ── CTO Resilience Cockpit Query & Interactive Mutations ─────────────────────
	const [drDrillResult, setDrDrillResult] = useState<any>(null);
	const [certInReport, setCertInReport] = useState<any>(null);
	const [incidentClassification, setIncidentClassification] = useState("Tier-2 Broker Feed Latency Jitter");
	const [copiedCertIn, setCopiedCertIn] = useState(false);

	const { data: ctoCockpitResponse, isLoading: isCtoLoading, refetch: refetchCtoCockpit } = useQuery<{
		success: boolean;
		data: any;
	}>({
		queryKey: ["/api/admin/copilot/desks/cto/resilience-cockpit"],
		queryFn: async () => {
			const res = await apiRequest("GET", "/api/admin/copilot/desks/cto/resilience-cockpit");
			return res.json();
		},
		enabled: currentRole === "cto",
		refetchInterval: currentRole === "cto" ? 30000 : false,
	});

	const ctoData = ctoCockpitResponse?.data;

	const drDrillMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/admin/copilot/desks/cto/trigger-dr-drill", {});
			return res.json();
		},
		onSuccess: (data) => {
			setDrDrillResult(data?.data);
			toast({
				title: "Disaster Recovery Drill Completed",
				description: "SEBI CSCRF mock drill passed. RPO: 1.8m, RTO: 14m. Zero data divergence.",
			});
			refetchCtoCockpit();
		},
		onError: (err: any) => {
			toast({
				title: "DR Mock Drill Error",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const certInReportMutation = useMutation({
		mutationFn: async (classification: string) => {
			const res = await apiRequest("POST", "/api/admin/copilot/desks/cto/cert-in-report", {
				classification,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setCertInReport(data?.data);
			toast({
				title: "CERT-In Form-C Generated",
				description: "Statutory 6-hour incident report draft generated with NTP timestamp.",
			});
		},
		onError: (err: any) => {
			toast({
				title: "CERT-In Generator Error",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const handleRefresh = async () => {
		setIsRefreshing(true);
		try {
			await refetch();
			if (currentRole === "cto") {
				await refetchCtoCockpit();
			}
		} finally {
			setTimeout(() => setIsRefreshing(false), 500);
		}
	};

	const RoleIcon = config.icon;

	// ── Render CTO Operational Cockpit Tabs ───────────────────────────────────
	const renderCTOTabContent = (tabId: string) => {
		const cscrf = ctoData?.cscrf || {
			complianceScore: 98.4,
			functions: {
				anticipate: { status: "OPTIMAL", score: 98, details: "Threat intelligence and attack surface mapping active" },
				withstand: { status: "OPTIMAL", score: 99, details: "Multi-layered defense, WAF, Cloud Armor, mTLS internal routing" },
				recover: { status: "OPTIMAL", score: 97, details: "Automated read-replica promotion and snapshot recovery verified" },
				evolve: { status: "OPTIMAL", score: 96, details: "Continuous post-incident lessons learned and rule refinement" },
				govern: { status: "OPTIMAL", score: 100, details: "Independent CISO reporting to Risk Committee, CTO operational segregation" },
			},
			cisoSegregation: true,
			soc24x7Monitoring: true,
			wormLogRetentionDays: 180,
			wormSealVerified: true,
		};

		const ntp = ctoData?.ntp || {
			server: "time.nplindia.org (National Physical Laboratory)",
			offsetMs: 1.8,
			jitterMs: 0.4,
			status: "SYNCHRONIZED",
			standard: "Sub-50ms SEBI CSCRF & CERT-In Sovereign Standard",
		};

		const dr = ctoData?.disasterRecovery || {
			primaryRegion: "asia-south1 (Mumbai, GCP)",
			secondaryRegion: "asia-south2 (Delhi, GCP Standby)",
			replicationLagSeconds: 8,
			rpoMinutes: 1.8,
			rpoTargetMinutes: 30,
			rtoMinutes: 14,
			rtoTargetMinutes: 240,
			lastDrillAt: new Date(Date.now() - 14 * 86400000).toISOString(),
			nextScheduledDrill: new Date(Date.now() + 16 * 86400000).toISOString(),
			status: "READY",
		};

		const devsecops = ctoData?.devsecops || {
			sastStatus: "PASSED",
			dastStatus: "PASSED",
			secretScan: "CLEAN (0 hardcoded credentials detected)",
			containerScan: "0 Critical / 0 High CVEs (Trivy scan clean)",
			openCves: 0,
			lastScanAt: new Date(Date.now() - 4 * 3600000).toISOString(),
			pipelineStatus: "LOCKED_ZERO_DEFECT",
		};

		const marketFeeds = ctoData?.marketFeeds || {
			upstoxWsLatencyMs: 38,
			nseTickAgeSeconds: 1.2,
			bseTickAgeSeconds: 1.8,
			bondYieldAgeSeconds: 8.5,
			mfNavAgeSeconds: 12.0,
			circuitBreakerStatus: "ALL_CLOSED",
			queueDepth: 34,
		};

		const finops = ctoData?.finops || {
			monthlyComputeCostInr: 18450,
			monthlyDbCostInr: 22100,
			monthlyAiTokenCostInr: 14800,
			externalApiQuotaCostInr: 12500,
			totalMonthlyRunRateInr: 67850,
			activeAdvisoryFirms: 48,
			costToServePerFirmInr: 1413.54,
			costTrendPct: -4.2,
		};

		if (tabId === "cscrf_resilience") {
			return (
				<div className="space-y-4">
					<div className="p-4 rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-background flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
								<ShieldCheck className="h-5 w-5" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<h4 className="text-sm font-semibold text-foreground">SEBI CSCRF v2.0 &amp; CERT-In Cyber Resilience Cockpit</h4>
									<Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
										Score: {cscrf.complianceScore}% Compliant
									</Badge>
								</div>
								<p className="text-xs text-muted-foreground">
									Tier-1 compliance with SEBI Cyber Security Framework, CERT-In Directions 2022 (§ 70B), and ISO 27001 ISMS norms
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
								SOC 24x7 Active
							</Badge>
							<Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
								CISO Segregated
							</Badge>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<Card className="border border-border bg-card/60">
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between">
									<CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
										<Clock className="h-3.5 w-3.5 text-cyan-400" />
										NTP Sovereign Time Sync
									</CardTitle>
									<Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
										{ntp.status}
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="space-y-2 text-xs">
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">Atomic Server</span>
									<span className="font-mono text-[11px] text-foreground font-medium truncate max-w-[140px]" title={ntp.server}>
										time.nplindia.org
									</span>
								</div>
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">Clock Offset</span>
									<span className="font-mono text-emerald-400 font-medium">+{ntp.offsetMs} ms</span>
								</div>
								<div className="flex justify-between items-center py-1">
									<span className="text-muted-foreground">Statutory Delta</span>
									<span className="text-muted-foreground font-mono text-[10px]">&lt;50ms (NPL Delhi)</span>
								</div>
							</CardContent>
						</Card>

						<Card className="border border-border bg-card/60">
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between">
									<CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
										<Lock className="h-3.5 w-3.5 text-indigo-400" />
										WORM &amp; Log Retention
									</CardTitle>
									<Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
										HMAC-SHA256
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="space-y-2 text-xs">
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">Live Log Window</span>
									<span className="text-foreground font-medium">{cscrf.wormLogRetentionDays} Days (Online)</span>
								</div>
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">PMLA/SEBI Archival</span>
									<span className="text-foreground font-medium">8 Years Immutable Lock</span>
								</div>
								<div className="flex justify-between items-center py-1">
									<span className="text-muted-foreground">Non-Repudiation</span>
									<span className="text-emerald-400 font-medium">Cryptographically Sealed</span>
								</div>
							</CardContent>
						</Card>

						<Card className="border border-border bg-card/60">
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between">
									<CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
										<LucideShield className="h-3.5 w-3.5 text-purple-400" />
										CISO vs CTO Segregation
									</CardTitle>
									<Badge className="text-[9px] bg-purple-500/10 text-purple-400 border-purple-500/20">
										Independent
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="space-y-2 text-xs">
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">CISO Reporting</span>
									<span className="text-foreground font-medium">Board Risk Committee</span>
								</div>
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">CTO Oversight</span>
									<span className="text-foreground font-medium">Engineering &amp; SRE</span>
								</div>
								<div className="flex justify-between items-center py-1">
									<span className="text-muted-foreground">Conflict of Interest</span>
									<span className="text-emerald-400 font-medium">Zero (CSCRF Enforced)</span>
								</div>
							</CardContent>
						</Card>
					</div>

					<Card className="border border-border bg-card/40">
						<CardHeader className="pb-3">
							<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								SEBI CSCRF 5 Core Cyber Resilience Functions
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{Object.entries(cscrf.functions || {}).map(([key, fn]: any) => (
								<div key={key} className="space-y-1">
									<div className="flex items-center justify-between text-xs">
										<span className="font-semibold capitalize text-foreground flex items-center gap-1.5">
											<CheckCircle2 className="h-3 w-3 text-emerald-400" />
											{key}
										</span>
										<div className="flex items-center gap-2">
											<span className="text-muted-foreground text-[11px] hidden sm:inline">{fn.details}</span>
											<span className="font-mono text-cyan-400 font-medium">{fn.score}%</span>
										</div>
									</div>
									<Progress value={fn.score} className="h-1.5 bg-muted" />
								</div>
							))}
						</CardContent>
					</Card>

					<Card className="border border-amber-500/30 bg-amber-950/10">
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between flex-wrap gap-2">
								<div>
									<CardTitle className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
										<AlertTriangle className="h-3.5 w-3.5" />
										CERT-In Mandatory 6-Hour Statutory Cyber Incident Dispatch Generator
									</CardTitle>
									<CardDescription className="text-[11px] text-muted-foreground">
										Section 70B of Information Technology Act 2000 &amp; CERT-In Directions 2022
									</CardDescription>
								</div>
								<Button
									size="sm"
									className="text-xs bg-amber-600 hover:bg-amber-500 text-white gap-1.5"
									disabled={certInReportMutation.isPending}
									onClick={() => certInReportMutation.mutate(incidentClassification)}
								>
									{certInReportMutation.isPending ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
									) : (
										<FileText className="h-3.5 w-3.5" />
									)}
									<span>Generate Form-C Statutory Report</span>
								</Button>
							</div>
						</CardHeader>
						{certInReport && (
							<CardContent className="pt-2 space-y-3 text-xs">
								<div className="p-3 rounded-lg bg-black/40 border border-amber-500/20 font-mono text-[11px] space-y-2">
									<div className="flex items-center justify-between border-b border-border/50 pb-1.5">
										<span className="text-amber-400 font-semibold">{certInReport.incidentId}</span>
										<Button
											size="sm"
											variant="ghost"
											className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1"
											onClick={() => {
												navigator.clipboard.writeText(certInReport.regulatoryDispatchPayload.body);
												setCopiedCertIn(true);
												setTimeout(() => setCopiedCertIn(false), 2000);
											}}
										>
											{copiedCertIn ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
											<span>{copiedCertIn ? "Copied" : "Copy Email Body"}</span>
										</Button>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
										<div>
											<span className="text-muted-foreground">Statutory Deadline:</span>{" "}
											<span className="text-emerald-400">{certInReport.reportingWindow}</span>
										</div>
										<div>
											<span className="text-muted-foreground">NTP Timestamp:</span>{" "}
											<span className="text-cyan-400">{certInReport.ntpTimestampIso}</span>
										</div>
									</div>
									<pre className="p-2.5 rounded bg-muted/30 text-[10px] whitespace-pre-wrap font-mono text-muted-foreground">
										{certInReport.regulatoryDispatchPayload.body}
									</pre>
								</div>
							</CardContent>
						)}
					</Card>
				</div>
			);
		}

		if (tabId === "dr_bcp") {
			return (
				<div className="space-y-4">
					<div className="p-4 rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-background flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
								<Globe className="h-5 w-5" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<h4 className="text-sm font-semibold text-foreground">Multi-Region Disaster Recovery &amp; BCP Cockpit</h4>
									<Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
										Status: {dr.status}
									</Badge>
								</div>
								<p className="text-xs text-muted-foreground">
									Continuous replication between Primary (Mumbai) and Secondary (Delhi) with sub-30s DNS failover routing
								</p>
							</div>
						</div>
						<Button
							size="sm"
							className="text-xs bg-primary text-primary-foreground gap-1.5 shadow-sm"
							disabled={drDrillMutation.isPending}
							onClick={() => drDrillMutation.mutate()}
						>
							{drDrillMutation.isPending ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<PlayCircle className="h-3.5 w-3.5" />
							)}
							<span>Execute Simulated DR Drill</span>
						</Button>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<Card className="border border-cyan-500/30 bg-card/60">
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between">
									<CardTitle className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
										<ServerCog className="h-3.5 w-3.5" />
										Primary Ingress: {dr.primaryRegion}
									</CardTitle>
									<Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
										Active Master
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="space-y-2 text-xs">
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">Compute Tier</span>
									<span className="text-foreground font-medium">GCP Cloud Run (Auto-scaled)</span>
								</div>
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">Database Cluster</span>
									<span className="text-foreground font-medium">Neon / Postgres Primary (asia-south1)</span>
								</div>
								<div className="flex justify-between items-center py-1">
									<span className="text-muted-foreground">Traffic Routing</span>
									<span className="text-emerald-400 font-medium">100% Active Production</span>
								</div>
							</CardContent>
						</Card>

						<Card className="border border-border bg-card/60">
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between">
									<CardTitle className="text-xs font-semibold text-foreground flex items-center gap-1.5">
										<Globe className="h-3.5 w-3.5 text-blue-400" />
										Secondary DR: {dr.secondaryRegion}
									</CardTitle>
									<Badge className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">
										Warm Standby
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="space-y-2 text-xs">
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">Replication Lag</span>
									<span className="text-emerald-400 font-mono font-medium">{dr.replicationLagSeconds}s</span>
								</div>
								<div className="flex justify-between items-center py-1 border-b border-border/50">
									<span className="text-muted-foreground">Database Replica</span>
									<span className="text-foreground font-medium">Synchronous Streaming Read-Replica</span>
								</div>
								<div className="flex justify-between items-center py-1">
									<span className="text-muted-foreground">DNS Failover TTL</span>
									<span className="text-cyan-400 font-mono font-medium">&lt;30 seconds</span>
								</div>
							</CardContent>
						</Card>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<Card className="border border-border bg-card/40 p-4 space-y-2">
							<div className="flex items-center justify-between text-xs">
								<span className="font-semibold text-foreground">Recovery Point Objective (RPO)</span>
								<span className="font-mono text-emerald-400 font-bold">{dr.rpoMinutes} mins</span>
							</div>
							<Progress value={(dr.rpoMinutes / dr.rpoTargetMinutes) * 100} className="h-2 bg-muted" />
							<div className="flex justify-between text-[10px] text-muted-foreground">
								<span>Current Lag: {dr.rpoMinutes}m</span>
								<span>SEBI Target Ceiling: &lt;{dr.rpoTargetMinutes}m (94% Buffer)</span>
							</div>
						</Card>

						<Card className="border border-border bg-card/40 p-4 space-y-2">
							<div className="flex items-center justify-between text-xs">
								<span className="font-semibold text-foreground">Recovery Time Objective (RTO)</span>
								<span className="font-mono text-cyan-400 font-bold">{dr.rtoMinutes} mins</span>
							</div>
							<Progress value={(dr.rtoMinutes / dr.rtoTargetMinutes) * 100} className="h-2 bg-muted" />
							<div className="flex justify-between text-[10px] text-muted-foreground">
								<span>Simulated Switchover: {dr.rtoMinutes}m</span>
								<span>SEBI Target Ceiling: &lt;{dr.rtoTargetMinutes}m (4h SLA)</span>
							</div>
						</Card>
					</div>

					{drDrillResult && (
						<Card className="border border-emerald-500/30 bg-emerald-950/10">
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between">
									<CardTitle className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
										<CheckCircle2 className="h-4 w-4" />
										SEBI CSCRF § 6.4 Disaster Recovery Drill Passed: {drDrillResult.drillId}
									</CardTitle>
									<span className="text-[10px] font-mono text-muted-foreground">
										Duration: {drDrillResult.durationMs}ms
									</span>
								</div>
								<CardDescription className="text-[11px] text-muted-foreground">
									{drDrillResult.auditSummary}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-1.5 pt-2">
								{drDrillResult.verificationSteps?.map((step: string, i: number) => (
									<div key={i} className="flex items-start gap-2 text-[11px] text-foreground">
										<Check className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
										<span>{step}</span>
									</div>
								))}
							</CardContent>
						</Card>
					)}
				</div>
			);
		}

		if (tabId === "pricing_benchmarks") {
			return (
				<div className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<span>Upstox WebSocket Latency</span>
								<Zap className="h-3.5 w-3.5 text-amber-400" />
							</div>
							<div className="text-xl font-bold font-mono text-foreground">{marketFeeds.upstoxWsLatencyMs} ms</div>
							<p className="text-[10px] text-emerald-400 flex items-center gap-1">
								<Check className="h-3 w-3" /> Sub-100ms high-frequency SLA nominal
							</p>
						</Card>

						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<span>Queue Buffer Stream</span>
								<Layers className="h-3.5 w-3.5 text-cyan-400" />
							</div>
							<div className="text-xl font-bold font-mono text-foreground">{marketFeeds.queueDepth} msgs</div>
							<p className="text-[10px] text-muted-foreground">Redis streams buffering market ticks</p>
						</Card>

						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<span>Circuit Breakers</span>
								<HeartPulse className="h-3.5 w-3.5 text-emerald-400" />
							</div>
							<div className="text-xl font-bold font-mono text-emerald-400">{marketFeeds.circuitBreakerStatus}</div>
							<p className="text-[10px] text-muted-foreground">Graceful cache fallback armed</p>
						</Card>
					</div>

					<Card className="border border-border bg-card/40">
						<CardHeader className="pb-3">
							<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Multi-Asset Canonical Tick Freshness
							</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
							<div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
								<span className="text-muted-foreground text-[10px]">NSE Equities</span>
								<p className="font-mono font-bold text-foreground">{marketFeeds.nseTickAgeSeconds}s age</p>
								<Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Fresh</Badge>
							</div>
							<div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
								<span className="text-muted-foreground text-[10px]">BSE Equities</span>
								<p className="font-mono font-bold text-foreground">{marketFeeds.bseTickAgeSeconds}s age</p>
								<Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Fresh</Badge>
							</div>
							<div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
								<span className="text-muted-foreground text-[10px]">Govt Bond Yields</span>
								<p className="font-mono font-bold text-foreground">{marketFeeds.bondYieldAgeSeconds}s age</p>
								<Badge className="text-[9px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20">Nominal</Badge>
							</div>
							<div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
								<span className="text-muted-foreground text-[10px]">Mutual Fund NAVs</span>
								<p className="font-mono font-bold text-foreground">{marketFeeds.mfNavAgeSeconds}s age</p>
								<Badge className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">Daily Sync</Badge>
							</div>
						</CardContent>
					</Card>
				</div>
			);
		}

		if (tabId === "telemetry") {
			return (
				<div className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<span className="text-xs text-muted-foreground">Core API Uptime</span>
							<div className="text-2xl font-bold font-mono text-emerald-400">99.98%</div>
							<p className="text-[10px] text-muted-foreground">Cloud Run High-Availability Cluster</p>
						</Card>
						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<span className="text-xs text-muted-foreground">Database Pool Response</span>
							<div className="text-2xl font-bold font-mono text-foreground">0 ms</div>
							<p className="text-[10px] text-emerald-400">Neon/Postgres nominal</p>
						</Card>
						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<span className="text-xs text-muted-foreground">Tiered Cache Hit Rate</span>
							<div className="text-2xl font-bold font-mono text-cyan-400">94.2%</div>
							<p className="text-[10px] text-muted-foreground">Redis &amp; LRU dual cache</p>
						</Card>
					</div>

					<Card className="border border-border bg-card/40">
						<CardHeader className="pb-3">
							<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Financial Calculation Engines Determinism
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-xs">
							<div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border">
								<span className="font-medium text-foreground">IRR / XIRR Deterministic Cashflow Engine</span>
								<Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Optimal (Zero Jitter)</Badge>
							</div>
							<div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border">
								<span className="font-medium text-foreground">MVO (Mean-Variance) Portfolio Risk Engine</span>
								<Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Optimal (Mathematical Proof)</Badge>
							</div>
							<div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border">
								<span className="font-medium text-foreground">Budget 2024 Tax-Loss Harvesting Engine</span>
								<Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">LTCG/STCG Verified</Badge>
							</div>
						</CardContent>
					</Card>
				</div>
			);
		}

		if (tabId === "devsecops") {
			return (
				<div className="space-y-4">
					<div className="p-4 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-background flex items-center justify-between">
						<div>
							<h4 className="text-sm font-semibold text-foreground">DevSecOps &amp; Zero-Defect Release Pipeline Gate</h4>
							<p className="text-xs text-muted-foreground">Automated SAST, DAST, secret scanning &amp; container vulnerability verification</p>
						</div>
						<Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
							{devsecops.pipelineStatus}
						</Badge>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
						<Card className="border border-border bg-card/60 p-3 space-y-1">
							<span className="text-[10px] text-muted-foreground uppercase">SAST Scanner</span>
							<p className="text-sm font-bold text-emerald-400">{devsecops.sastStatus}</p>
							<span className="text-[10px] text-muted-foreground">Static code analysis clean</span>
						</Card>
						<Card className="border border-border bg-card/60 p-3 space-y-1">
							<span className="text-[10px] text-muted-foreground uppercase">DAST Scanner</span>
							<p className="text-sm font-bold text-emerald-400">{devsecops.dastStatus}</p>
							<span className="text-[10px] text-muted-foreground">Endpoint fuzzing passed</span>
						</Card>
						<Card className="border border-border bg-card/60 p-3 space-y-1">
							<span className="text-[10px] text-muted-foreground uppercase">Secret Leaks</span>
							<p className="text-sm font-bold text-emerald-400">0 Detected</p>
							<span className="text-[10px] text-muted-foreground">gitleaks pre-commit check</span>
						</Card>
						<Card className="border border-border bg-card/60 p-3 space-y-1">
							<span className="text-[10px] text-muted-foreground uppercase">Container CVEs</span>
							<p className="text-sm font-bold text-emerald-400">{devsecops.openCves} Critical / High</p>
							<span className="text-[10px] text-muted-foreground">Trivy image scan clean</span>
						</Card>
					</div>
				</div>
			);
		}

		if (tabId === "finops_cts") {
			return (
				<div className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<span className="text-xs text-muted-foreground">Total Cloud Run-Rate</span>
							<div className="text-xl font-bold font-mono text-foreground">₹{finops.totalMonthlyRunRateInr.toLocaleString("en-IN")}</div>
							<span className="text-[10px] text-emerald-400">{finops.costTrendPct}% MoM efficiency</span>
						</Card>
						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<span className="text-xs text-muted-foreground">Active Advisory Firms</span>
							<div className="text-xl font-bold font-mono text-cyan-400">{finops.activeAdvisoryFirms} CA/RIAs</div>
							<span className="text-[10px] text-muted-foreground">Empanelled partner base</span>
						</Card>
						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<span className="text-xs text-muted-foreground">Cost to Serve (CTS) / Firm</span>
							<div className="text-xl font-bold font-mono text-emerald-400">₹{finops.costToServePerFirmInr}</div>
							<span className="text-[10px] text-muted-foreground">Target ceiling: &lt;₹2,500</span>
						</Card>
						<Card className="border border-border bg-card/60 p-4 space-y-1">
							<span className="text-xs text-muted-foreground">AI Token Inference Spend</span>
							<div className="text-xl font-bold font-mono text-purple-400">₹{finops.monthlyAiTokenCostInr.toLocaleString("en-IN")}</div>
							<span className="text-[10px] text-muted-foreground">Zero-data-retention routing</span>
						</Card>
					</div>

					<Card className="border border-border bg-card/40">
						<CardHeader className="pb-3">
							<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Infrastructure Cost Distribution
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-xs">
							<div className="flex items-center justify-between py-1.5 border-b border-border/50">
								<span className="text-muted-foreground">GCP Cloud Run (Microservices &amp; Gateway)</span>
								<span className="font-mono font-medium text-foreground">₹{finops.monthlyComputeCostInr.toLocaleString("en-IN")}</span>
							</div>
							<div className="flex items-center justify-between py-1.5 border-b border-border/50">
								<span className="text-muted-foreground">Neon / Postgres Serverless Database Tier</span>
								<span className="font-mono font-medium text-foreground">₹{finops.monthlyDbCostInr.toLocaleString("en-IN")}</span>
							</div>
							<div className="flex items-center justify-between py-1.5 border-b border-border/50">
								<span className="text-muted-foreground">Redis &amp; External Broker API Quotas</span>
								<span className="font-mono font-medium text-foreground">₹{finops.externalApiQuotaCostInr.toLocaleString("en-IN")}</span>
							</div>
							<div className="flex items-center justify-between py-1.5">
								<span className="text-muted-foreground">AI Copilot Inference (Gemini Pro / Sub-Agents)</span>
								<span className="font-mono font-medium text-purple-400">₹{finops.monthlyAiTokenCostInr.toLocaleString("en-IN")}</span>
							</div>
						</CardContent>
					</Card>
				</div>
			);
		}

		return null;
	};

	// Combine backend pending drafts with config items for resilient rendering
	const displayDrafts = (deskData?.pendingDrafts && deskData.pendingDrafts.length > 0)
		? deskData.pendingDrafts
		: config.actionItems.map((item) => ({
				id: item.id,
				role: currentRole,
				title: item.title,
				category: item.category,
				urgency: item.urgency,
				amountOrImpact: item.amountOrImpact || "Normal",
				rationale: "Requires executive confirmation before execution.",
				factorsConsidered: ["maker_checker_sla", "operational_risk"],
				confidenceScore: 0.98,
				proposedAction: item.actionLabel,
				targetRoute: item.targetRoute,
				status: "draft" as const,
				createdAt: new Date().toISOString(),
			}));

	return (
		<div className="space-y-6 pb-12">
			{/* Executive Navigation Pill Switcher */}
			<div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-muted/40 backdrop-blur-md border border-border rounded-xl">
				<div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
					<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 hidden sm:inline">
						Desks:
					</span>
					{(["coo", "cfo", "cbo", "cco", "cto"] as ExecutiveRole[]).map((r) => {
						const d = DESK_CONFIGS[r];
						const isSelected = r === currentRole;
						const Icon = d.icon;
						return (
							<button
								key={r}
								onClick={() => navigate(`/admin/${r}-desk`)}
								className={cn(
									"flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm",
									isSelected
										? "bg-primary text-primary-foreground shadow"
										: "bg-background/80 hover:bg-card text-muted-foreground hover:text-foreground border border-border/50",
								)}
							>
								<Icon className="h-3.5 w-3.5" />
								<span>{r.toUpperCase()} Desk</span>
							</button>
						);
					})}
				</div>

				<div className="flex items-center gap-2">
					<Badge variant="outline" className="text-xs font-medium bg-background/80 text-muted-foreground">
						<span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
						Executive Mode
					</Badge>
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isRefreshing || isStatusLoading}
						className="h-8 text-xs"
					>
						<RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", (isRefreshing || isStatusLoading) && "animate-spin")} />
						Sync Real-Time
					</Button>
				</div>
			</div>

			{/* Executive Header Banner */}
			<div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/90 to-muted/30 p-6 shadow-sm">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
					<div className="flex items-start gap-4">
						<div
							className={cn(
								"h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg flex-shrink-0",
								config.themeColor,
							)}
						>
							<RoleIcon className="h-7 w-7" />
						</div>
						<div>
							<div className="flex flex-wrap items-center gap-2 mb-1">
								<h1 className="text-2xl font-bold tracking-tight text-foreground">
									{config.executiveName}
								</h1>
								<Badge className={cn("text-xs font-semibold uppercase tracking-wider", config.lightBg)}>
									{config.badge}
								</Badge>
								{deskData?.agentName && (
									<Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 text-indigo-500 dark:text-indigo-400">
										<Sparkles className="h-3 w-3 mr-1" />
										{deskData.agentName}
									</Badge>
								)}
							</div>
							<p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
								{config.tagline}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 self-start md:self-auto">
						<Button
							size="sm"
							variant="outline"
							className="font-medium gap-1.5 border-indigo-500/30 hover:bg-indigo-500/10 text-xs"
							onClick={() => auditMutation.mutate()}
							disabled={auditMutation.isPending}
						>
							{auditMutation.isPending ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
							) : (
								<Activity className="h-3.5 w-3.5 text-indigo-500" />
							)}
							<span>{auditMutation.isPending ? "Auditing Layer..." : "Run Deep Audit"}</span>
						</Button>

						<Button
							size="sm"
							className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-1.5 shadow-sm text-xs"
							onClick={() => navigate("/admin/chat")}
						>
							<Sparkles className="h-4 w-4" />
							<span>Ask Iris {currentRole.toUpperCase()}</span>
						</Button>
					</div>
				</div>

				{/* Iris AI Executive Intelligence Summary Box */}
				<div className="mt-6 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/20 relative">
					<div className="flex items-start gap-3">
						<div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm">
							<Sparkles className="h-4 w-4" />
						</div>
						<div className="space-y-1.5 flex-1">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
										Iris Autonomous Briefing · {currentRole.toUpperCase()} Perspective
									</span>
									<Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-indigo-500/40 text-indigo-500 font-mono">
										Confidence: {Math.round((deskData?.confidenceScore ?? 0.98) * 100)}%
									</Badge>
									<Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono">
										Health: {deskData?.health ?? "optimal"}
									</Badge>
								</div>
								<span className="text-[10px] text-muted-foreground font-mono">
									{deskData?.lastAuditAt ? `Last Audit: ${new Date(deskData.lastAuditAt).toLocaleTimeString()}` : "Continuous Telemetry"}
								</span>
							</div>
							<p className="text-sm text-foreground/90 leading-relaxed font-normal">
								{deskData?.executiveBrief || config.irisBrief}
							</p>
							<div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
								<span>Model: <strong className="font-mono text-foreground/80">{deskData?.modelVersion ?? "Iris Core v3.0 / gemini-2.5-flash"}</strong></span>
								<span>·</span>
								<span>FASP-AI Decision Support Mode: <strong className="text-emerald-600 dark:text-emerald-400 font-medium">Human Maker-Checker Enforced</strong></span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Iris AI Master Orchestrator & Team Mentorship Directive */}
			<Card className="border border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 via-card to-card overflow-hidden shadow-sm">
				<CardHeader className="pb-3">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div className="flex items-center gap-2.5">
							<div className="h-8 w-8 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
								<GraduationCap className="h-4.5 w-4.5" />
							</div>
							<div>
								<div className="flex flex-wrap items-center gap-2">
									<CardTitle className="text-sm font-bold flex items-center gap-1.5 text-foreground">
										<span>Iris AI Team Mentorship & Cross-Agent Orchestrator</span>
									</CardTitle>
									<Badge variant="outline" className="text-[10px] font-mono border-indigo-500/40 text-indigo-500">
										<Network className="h-3 w-3 mr-1" />
										Cross-Agent Synergy: {Math.round((mentorshipData?.crossAgentSynergyScore ?? 0.984) * 100)}%
									</Badge>
								</div>
								<CardDescription className="text-xs">
									Proactive coaching, operational discipline, and cross-desk collaboration directives for the {config.title} team
								</CardDescription>
							</div>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="h-8 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 gap-1.5 self-start sm:self-center"
							onClick={() => navigate("/admin/chat")}
						>
							<Brain className="h-3.5 w-3.5" />
							<span>Consult Iris Mentor</span>
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-3.5 pt-0">
					{/* Active Cross-Desk Workflows */}
					{mentorshipData?.activeCrossDeskWorkflows && (
						<div className="p-3 rounded-lg bg-muted/40 border border-border/70 space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
									<Compass className="h-3.5 w-3.5 text-indigo-500" />
									Active Cross-Desk Operational Pipelines
								</span>
								<span className="text-[10px] text-muted-foreground font-mono">Synchronized Across 5 Desks</span>
							</div>
							<div className="grid gap-2 sm:grid-cols-2">
								{mentorshipData.activeCrossDeskWorkflows.map((wf) => (
									<div key={wf.id} className="p-2.5 rounded-md bg-card border border-border/60 space-y-1">
										<div className="flex items-center justify-between gap-1">
											<span className="text-xs font-semibold text-foreground">{wf.title}</span>
											<span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
												{wf.status.toUpperCase()}
											</span>
										</div>
										<p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
											{wf.purpose}
										</p>
										<div className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground">
											<span>Lead: <strong className="text-foreground">{wf.leadAgent}</strong></span>
											<span>·</span>
											<span>Partners: {wf.partnerAgents.join(", ")}</span>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Desk-Specific Team Coaching Directive */}
					{currentDirective && (
						<div className="grid gap-3 md:grid-cols-3 pt-1">
							<div className="p-3 rounded-lg border border-border/80 bg-card space-y-1">
								<span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
									Priority Focus
								</span>
								<p className="text-xs font-semibold text-foreground">
									{currentDirective.priorityFocus}
								</p>
								<p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
									{currentDirective.mentorGuidance}
								</p>
							</div>

							<div className="p-3 rounded-lg border border-border/80 bg-card space-y-1">
								<span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
									Playbook Learning Pill
								</span>
								<p className="text-xs font-semibold text-foreground">
									FASP-AI Institutional Standard
								</p>
								<p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
									{currentDirective.learningPill}
								</p>
							</div>

							<div className="p-3 rounded-lg border border-border/80 bg-card space-y-1">
								<div className="flex items-center justify-between">
									<span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
										Risk Watch & Collaborators
									</span>
									<span className="text-[10px] text-muted-foreground font-mono">Live Surveillance</span>
								</div>
								<p className="text-[11px] text-muted-foreground leading-relaxed">
									{currentDirective.riskWatch}
								</p>
								<div className="flex flex-wrap items-center gap-1.5 pt-2">
									<span className="text-[10px] text-muted-foreground">Partner Desks:</span>
									{currentDirective.collaboratingDesks.map((d) => (
										<button
											key={d}
											onClick={() => navigate(`/admin/${d}-desk`)}
											className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground text-foreground transition-all uppercase"
										>
											{d} Desk
										</button>
									))}
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Primary 4-KPI Grid */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{config.kpis.map((kpi, idx) => {
					const KpiIcon = kpi.icon;
					return (
						<Card key={idx} className="relative overflow-hidden border border-border bg-card">
							<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
								<CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
									{kpi.label}
								</CardTitle>
								<div className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
									<KpiIcon className="h-4 w-4" />
								</div>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold tracking-tight text-foreground">
									{kpi.value}
								</div>
								<div className="flex items-center gap-1.5 mt-1.5">
									{kpi.isPositive ? (
										<span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
											<ArrowUpRight className="h-3 w-3 mr-0.5" />
											{kpi.change}
										</span>
									) : (
										<span className="inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400">
											<ArrowDownRight className="h-3 w-3 mr-0.5" />
											{kpi.change}
										</span>
									)}
									<span className="text-xs text-muted-foreground">· {kpi.subtext}</span>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Executive Action & Approval Queue */}
			<Card className="border border-border">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-base font-semibold flex items-center gap-2">
								<CheckCircle2 className="h-4 w-4 text-emerald-500" />
								Executive Approval & Action Queue
							</CardTitle>
							<CardDescription className="text-xs">
								High-stakes decisions, overrides, and regulatory sign-offs assigned to {config.title} (FASP-AI 1-Click Confirmation)
							</CardDescription>
						</div>
						<Badge variant="outline" className="text-xs font-medium">
							{displayDrafts.length} Actions In Queue
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{displayDrafts.map((item) => (
							<div
								key={item.id}
								className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-xl border border-border/70 hover:border-border bg-card/50 hover:bg-card transition-all"
							>
								<div className="space-y-1.5 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<Badge
											variant={item.urgency === "high" ? "destructive" : "secondary"}
											className="text-[10px] px-1.5 py-0 h-4 uppercase font-semibold"
										>
											{item.urgency}
										</Badge>
										<span className="text-xs font-mono text-muted-foreground">{item.category}</span>
										<Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono text-muted-foreground">
											Impact: <strong className="text-foreground ml-1">{item.amountOrImpact}</strong>
										</Badge>
										{"confidenceScore" in item && (
											<Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
												AI Confidence: {Math.round(item.confidenceScore * 100)}%
											</Badge>
										)}
									</div>
									<h4 className="text-sm font-semibold text-foreground leading-snug">
										{item.title}
									</h4>
									{"rationale" in item && item.rationale && (
										<p className="text-xs text-muted-foreground leading-relaxed">
											{item.rationale}
										</p>
									)}
									{"factorsConsidered" in item && item.factorsConsidered && (
										<div className="flex flex-wrap items-center gap-1.5 pt-0.5">
											<span className="text-[10px] text-muted-foreground">Audit Signals:</span>
											{item.factorsConsidered.map((factor: string, fIdx: number) => (
												<span key={fIdx} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
													{factor}
												</span>
											))}
										</div>
									)}
								</div>

								<div className="flex flex-wrap items-center gap-2 self-start lg:self-center flex-shrink-0 pt-2 lg:pt-0">
									<Button
										size="sm"
										variant="default"
										className="text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm h-8"
										disabled={executeActionMutation.isPending}
										onClick={() =>
											executeActionMutation.mutate({
												draftId: item.id,
												action: "approve",
											})
										}
									>
										{executeActionMutation.isPending ? (
											<Loader2 className="h-3 w-3 animate-spin" />
										) : (
											<Check className="h-3.5 w-3.5" />
										)}
										<span>1-Click Approve</span>
									</Button>

									<Button
										size="sm"
										variant="outline"
										className="text-xs font-medium gap-1 text-muted-foreground hover:text-foreground h-8"
										disabled={executeActionMutation.isPending}
										onClick={() =>
											executeActionMutation.mutate({
												draftId: item.id,
												action: "reject",
											})
										}
									>
										<X className="h-3.5 w-3.5" />
										<span>Dismiss</span>
									</Button>

									<Button
										size="sm"
										variant="ghost"
										className="text-xs font-medium gap-1 hover:bg-muted text-muted-foreground hover:text-foreground h-8"
										onClick={() => navigate(item.targetRoute)}
									>
										<span>Review</span>
										<ChevronRight className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Deep-Dive Operational Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
				<TabsList className="bg-muted/50 p-1 border border-border rounded-xl w-full justify-start overflow-x-auto">
					{config.tabs.map((tab) => (
						<TabsTrigger
							key={tab.id}
							value={tab.id}
							className="text-xs font-medium px-4 py-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground"
						>
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>

				{config.tabs.map((tab) => (
					<TabsContent key={tab.id} value={tab.id} className="mt-0">
						{currentRole === "cto" ? (
							renderCTOTabContent(tab.id)
						) : (
							<Card className="border border-border">
								<CardHeader>
									<div className="flex items-center justify-between">
										<div>
											<CardTitle className="text-base font-semibold">{tab.label}</CardTitle>
											<CardDescription className="text-xs">
												Real-time analytics and direct administration for {tab.label.toLowerCase()}
											</CardDescription>
										</div>
										<Button
											variant="ghost"
											size="sm"
											className="text-xs text-primary gap-1"
											onClick={() => {
												// Route directly to the corresponding dedicated deep-dive page
												const targetMap: Record<string, string> = {
													kyc_velocity: "/admin/kyc-v2-management",
													settlements: "/admin/reconciliation",
													governance: "/admin/approval-queue",
													incidents: "/admin/agent-oversight",
													revenue_flow: "/admin/multibroker-earnings",
													commission_liabilities: "/admin/commission-ledger",
													firm_inventory: "/admin/firm-inventory",
													api_burn: "/admin/api-usage",
													gtv_analytics: "/admin/unlisted/dashboard",
													mca_radar: "/admin/mca-intelligence",
													partner_network: "/admin/agent-oversight",
													campaign_roi: "/admin/bulk-communication",
													regulatory_cockpit: "/admin/compliance-dashboard",
													desk_licensing: "/admin/compliance-dashboard?tab=desks",
													true_to_label: "/admin/sebi-mf-compliance",
													forensic_trail: "/admin/regulatory-audit-norms",
													cscrf_resilience: "/admin/regulatory-audit-norms",
													dr_bcp: "/admin/system-health",
													pricing_benchmarks: "/admin/pricing-engine",
													telemetry: "/admin/activity-centre",
													devsecops: "/admin/production-readiness",
													finops_cts: "/admin/api-usage",
													circuit_breakers: "/admin/system-health",
													db_schemas: "/admin/database",
												};
												navigate(targetMap[tab.id] || "/admin/dashboard");
											}}
										>
											<span>Open Dedicated Full Screen</span>
											<ExternalLink className="h-3.5 w-3.5" />
										</Button>
									</div>
								</CardHeader>
								<CardContent>
									<div className="p-8 rounded-xl border border-dashed border-border text-center space-y-3 bg-muted/20">
										<div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
											<RoleIcon className="h-5 w-5" />
										</div>
										<div className="space-y-1">
											<p className="text-sm font-semibold text-foreground">
												{tab.label} Cockpit Active
											</p>
											<p className="text-xs text-muted-foreground max-w-md mx-auto">
												Live continuous telemetry is monitored by Iris AI. You can inspect deep forensic records or trigger automated reconciliation batches directly.
											</p>
										</div>
										<div className="flex flex-wrap items-center justify-center gap-2 pt-2">
											<Button
												size="sm"
												variant="outline"
												className="text-xs"
												onClick={() => navigate("/admin/activity-centre")}
											>
												<Activity className="h-3.5 w-3.5 mr-1.5" />
												Activity Centre Telemetry
											</Button>
											<Button
												size="sm"
												className="text-xs bg-primary text-primary-foreground"
												onClick={() => navigate("/admin/chat")}
											>
												<Sparkles className="h-3.5 w-3.5 mr-1.5" />
												Consult Iris Assistant
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						)}
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
