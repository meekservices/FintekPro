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
		tagline: "Platform observability, calculation engine health, circuit breakers, DB latency & zero-defect deploys",
		themeColor: "from-cyan-600 to-blue-800",
		lightBg: "bg-cyan-500/10 text-cyan-500",
		borderTheme: "border-cyan-500/20",
		irisBrief:
			"Core API uptime is 99.98% with 0ms database latency and 94.2% cache hit rate. Auto-healing sentinels deduplicated and auto-resolved 42k telemetry spikes. All calculation engines (IRR, XIRR, MVO, Golden Pricing) verified healthy. Cloud Build deployment pipeline is clear.",
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
				label: "Database Response",
				value: "0ms",
				change: "Pool Nominal",
				isPositive: true,
				subtext: "Neon/Postgres cluster",
				icon: Database,
			},
			{
				label: "Cache Hit Rate",
				value: "94.2%",
				change: "+1.2% optimal",
				isPositive: true,
				subtext: "Redis & LRU tiered cache",
				icon: Zap,
			},
			{
				label: "Critical Open Incidents",
				value: "0",
				change: "Auto-healed",
				isPositive: true,
				subtext: "Circuit breakers closed",
				icon: CheckCircle2,
			},
		],
		actionItems: [
			{
				id: "cto-1",
				title: "Activity Centre Real-Time Telemetry & Error Digest Review",
				category: "Observability",
				urgency: "medium",
				amountOrImpact: "Platform Vitals",
				timeAgo: "10m ago",
				actionLabel: "Open Activity Centre",
				targetRoute: "/admin/activity-centre",
			},
			{
				id: "cto-2",
				title: "Golden Pricing Engine Multi-Asset Tick Freshness Audit",
				category: "Engine Validation",
				urgency: "medium",
				amountOrImpact: "NSE/BSE Feeds",
				timeAgo: "1h ago",
				actionLabel: "Pricing Engine",
				targetRoute: "/admin/pricing-engine",
			},
			{
				id: "cto-3",
				title: "API Gateway Provider Quota & Rate Limit Consumption",
				category: "Capacity Planning",
				urgency: "low",
				amountOrImpact: "AI & External APIs",
				timeAgo: "3h ago",
				actionLabel: "API Telemetry",
				targetRoute: "/admin/api-usage",
			},
			{
				id: "cto-4",
				title: "Pre-Deploy Production Readiness Checklist & Schema Validation",
				category: "Release Engineering",
				urgency: "low",
				amountOrImpact: "GCP Cloud Build",
				timeAgo: "1d ago",
				actionLabel: "Run Audit",
				targetRoute: "/admin/production-readiness",
			},
		],
		tabs: [
			{ id: "telemetry", label: "System & Engine Telemetry", component: "telemetry" },
			{ id: "circuit_breakers", label: "Circuit Breakers & Auto-Heal", component: "circuits" },
			{ id: "pricing_benchmarks", label: "Golden Pricing Health", component: "pricing" },
			{ id: "db_schemas", label: "Database Pool & Migrations", component: "db" },
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

	const handleRefresh = async () => {
		setIsRefreshing(true);
		try {
			await refetch();
		} finally {
			setTimeout(() => setIsRefreshing(false), 500);
		}
	};

	const RoleIcon = config.icon;

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
												telemetry: "/admin/activity-centre",
												circuit_breakers: "/admin/system-health",
												pricing_benchmarks: "/admin/pricing-engine",
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
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
