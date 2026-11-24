import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation, useSearch } from "wouter";
import fintekproLogo from "@assets/fintekpro_admin_1772539048012.png";
import { PortalLogo } from "@/components/portal/PortalLogo";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getPortalQueryParams } from "@/hooks/useSubdomain";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Settings,
	BookOpen,
	Users,
	BarChart3,
	ShieldCheck,
	Shield as LucideShield,
	Database,
	Activity,
	Key,
	FileCheck,
	LogOut,
	Menu,
	X,
	Home,
	Bell,
	AlertCircle,
	AlertTriangle,
	DollarSign,
	Workflow,
	TrendingUp,
	Mail,
	MessageSquare,
	Building2,
	Target,
	PieChart,
	Store,
	Briefcase,
	ClipboardList,
	History,
	Handshake,
	ChevronDown,
	ChevronRight,
	Landmark,
	ShoppingCart,
	Lightbulb,
	Award,
	Search,
	Megaphone,
	LayoutDashboard,
	Cog,
	Package,
	CheckCircle,
	UserCheck,
	Bug,
	Wallet,
	Inbox,
	FileSignature,
	Palette,
	FileText,
	Scale,
	ShieldAlert,
	GitBranch,
	ArrowRightLeft,
	LineChart,
	HeartPulse,
	ServerCog,
	Layers,
	Radio,
	Bell as BellIcon,
	UserCog,
	Receipt,
	Link as LinkIcon,
	FileBarChart,
	Boxes,
	Zap,
	Brain,
	Send,
	Clock,
	Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AdminLayoutProps {
	children: React.ReactNode;
}

interface NavItem {
	title: string;
	href: string;
	icon: LucideIcon;
	description: string;
	badge?: string;
	children?: NavItem[];
}

interface NavCategory {
	id: string;
	title: string;
	icon: LucideIcon;
	items: NavItem[];
}

const navCategories: NavCategory[] = [
	{
		id: "dashboard",
		title: "Autonomous Core",
		icon: Brain,
		items: [
			{
				title: "Overview",
				href: "/admin/dashboard",
				icon: Home,
				description: "Platform metrics & executive KPIs",
			},
			{
				title: "Activity Centre",
				href: "/admin/activity-centre",
				icon: Activity,
				description: "Platform monitoring, AI insights & error diagnostics",
			},
			{
				title: "Ask Iris (AI Co-pilot)",
				href: "/admin/chat",
				icon: MessageSquare,
				description: "Iris autonomous operations & advisory assistant",
			},
			{
				title: "AI Governance & Lineage",
				href: "/admin/ai-governance",
				icon: Brain,
				description: "FASP-AI compliance, AAGE validation & lineage",
				badge: "AAGE",
			},
			{
				title: "Enterprise Copilot Hub",
				href: "/admin/copilot",
				icon: Sparkles,
				description: "Multi-agent autonomous enterprise copilot suite",
			},
			{
				title: "AI Market Signals",
				href: "/admin/ai-insights",
				icon: Lightbulb,
				description: "AI-powered trends, sentiment & alpha signals",
			},
			{
				title: "Autonomous Picks Monitor",
				href: "/admin/picks",
				icon: Award,
				description: "Auto-generated daily quant & equity picks",
			},
			{
				title: "Partner Oversight",
				href: "/admin/agent-oversight",
				icon: UserCog,
				description: "Monitor partner network activity & advisory",
			},
			{
				title: "User Activity Audit",
				href: "/admin/user-activity",
				icon: BarChart3,
				description: "Client & advisor behavioural audit log",
			},
			{
				title: "Notifications Management",
				href: "/admin/notification-management",
				icon: BellIcon,
				description: "Push & in-app notification settings",
			},
		],
	},
	{
		id: "executive_desks",
		title: "Executive Desks",
		icon: Award,
		items: [
			{
				title: "COO Desk",
				href: "/admin/coo-desk",
				icon: Briefcase,
				description: "KYC throughput, T+1 settlements & Maker-Checker SLAs",
				badge: "Ops",
			},
			{
				title: "CFO Desk",
				href: "/admin/cfo-desk",
				icon: DollarSign,
				description: "Multibroker earnings, payout claims & treasury float",
				badge: "Finance",
			},
			{
				title: "CBO Desk",
				href: "/admin/cbo-desk",
				icon: TrendingUp,
				description: "Marketplace GTV, MCA corporate pipeline & partner growth",
				badge: "Growth",
			},
			{
				title: "CCO Desk",
				href: "/admin/cco-desk",
				icon: LucideShield,
				description: "SEBI/RBI compliance, desk licensing & risk surveillance",
				badge: "Risk",
			},
			{
				title: "CTO Desk",
				href: "/admin/cto-desk",
				icon: ServerCog,
				description: "Platform resiliency, auto-healing & telemetry",
				badge: "Tech",
			},
		],
	},
	{
		id: "crm",
		title: "CRM & Growth",
		icon: Users,
		items: [
			{
				title: "Stakeholder Directory",
				href: "/admin/stakeholders",
				icon: Users,
				description: "Clients, HNIs & partner network",
			},
			{
				title: "Qualified Lead Pipeline",
				href: "/admin/lead-prospecting",
				icon: TrendingUp,
				description: "Assigned partner leads & active deal stages",
				badge: "Active",
			},
			{
				title: "MCA Corporate Intelligence",
				href: "/admin/mca-intelligence",
				icon: Building2,
				description: "Radar, ROC filings, Directors & financials",
				badge: "MCA",
			},
			{
				title: "Cold Prospect Directory",
				href: "/admin/prospect-dashboard",
				icon: Target,
				description: "Prospect database, MCA search & imports",
				badge: "Cold",
			},
			{
				title: "Partner Performance",
				href: "/admin/agent-performance",
				icon: LineChart,
				description: "Partner conversion metrics & leaderboard",
			},
			{
				title: "Task Oversight",
				href: "/admin/task-oversight",
				icon: ClipboardList,
				description: "Monitor partner assignments & workflows",
			},
			{
				title: "Zoho Ecosystem Sync",
				href: "/admin/zoho-dashboard",
				icon: Workflow,
				description: "Unified Zoho CRM, Books, Imports & Logs",
				children: [
					{
						title: "CRM Pipeline",
						href: "/admin/zoho-dashboard",
						icon: Workflow,
						description: "Zoho CRM pipeline",
					},
					{
						title: "Zoho Books",
						href: "/admin/zoho-books",
						icon: BookOpen,
						description: "Accounting & ledger sync",
					},
					{
						title: "Import Data",
						href: "/admin/zoho-import",
						icon: Package,
						description: "Bulk import from Zoho",
					},
					{
						title: "Connections & OAuth",
						href: "/admin/zoho-connections",
						icon: LinkIcon,
						description: "OAuth & API connections",
					},
					{
						title: "Activity Logs",
						href: "/admin/zoho-logs",
						icon: History,
						description: "Sync event logs & audit",
					},
				],
			},
		],
	},
	{
		id: "marketplaces",
		title: "Marketplaces & Assets",
		icon: Package,
		items: [
			{
				title: "Unlisted Shares & Pre-IPO",
				href: "/admin/unlisted/dashboard",
				icon: Building2,
				description: "Pre-IPO, unlisted equity & secondary trades",
				children: [
					{
						title: "Overview Dashboard",
						href: "/admin/unlisted/dashboard",
						icon: LayoutDashboard,
						description: "Overview & volume metrics",
					},
					{
						title: "Listed Companies",
						href: "/admin/unlisted/companies",
						icon: Building2,
						description: "Manage unlisted company profiles",
					},
					{
						title: "Buy / Sell Orders",
						href: "/admin/unlisted/orders",
						icon: ShoppingCart,
						description: "Order book & pending requests",
					},
					{
						title: "Price Negotiations",
						href: "/admin/unlisted/negotiations",
						icon: Handshake,
						description: "Counter-offers & deal matching",
					},
					{
						title: "Compliance Alerts",
						href: "/admin/unlisted/compliance-alerts",
						icon: ShieldAlert,
						description: "Blocked trades & limits",
					},
					{
						title: "Audit Trail",
						href: "/admin/unlisted/audit-log",
						icon: History,
						description: "Immutable transaction audit",
					},
				],
			},
			{
				title: "Bonds & Fixed Income Hub",
				href: "/admin/bonds/dashboard",
				icon: Scale,
				description: "Corporate bonds, NCDs, MLDs & G-Secs",
				children: [
					{
						title: "Bonds Overview",
						href: "/admin/bonds/dashboard",
						icon: LayoutDashboard,
						description: "Fixed income dashboard",
					},
					{
						title: "Sell Listings",
						href: "/admin/bonds/sell-listings",
						icon: Store,
						description: "Active secondary sell inventory",
					},
					{
						title: "Buy Requests",
						href: "/admin/bonds/buy-requests",
						icon: ShoppingCart,
						description: "Client RFQs & buy orders",
					},
					{
						title: "Matched Deals",
						href: "/admin/bonds/deals",
						icon: Handshake,
						description: "Settlement & deal processing",
					},
					{
						title: "Audit Trail",
						href: "/admin/bonds/audit-log",
						icon: History,
						description: "Bond trade audit log",
					},
				],
			},
			{
				title: "Mutual Funds & Analytics Ops",
				href: "/admin/mf-analytics-ops",
				icon: Boxes,
				description: "Bulk MF calculation & return analytics",
				children: [
					{
						title: "Analytics Operations",
						href: "/admin/mf-analytics-ops",
						icon: Boxes,
						description: "Run bulk MF analytics jobs",
					},
					{
						title: "Returns Sync & Enrichment",
						href: "/admin/mf-enrichment",
						icon: Layers,
						description: "AMFI NAV & historical returns sync",
					},
					{
						title: "MF Benchmarks",
						href: "/admin/mf-benchmarks",
						icon: LineChart,
						description: "Benchmark indices & TRI mapping",
					},
				],
			},
			{
				title: "US Broker-Dealer (Alpaca)",
				href: "/admin/broker-dashboard",
				icon: Wallet,
				description: "Global US equities & fractional trading",
				children: [
					{
						title: "Alpaca Hub",
						href: "/admin/alpaca-hub",
						icon: Building2,
						description: "Accounts, orders, positions & risk",
					},
					{
						title: "Accounts & KYC",
						href: "/admin/broker-dashboard?tab=accounts",
						icon: ShieldCheck,
						description: "Account status & W-8BEN compliance",
					},
					{
						title: "Journals & Transfers",
						href: "/admin/broker-dashboard?tab=journals",
						icon: ArrowRightLeft,
						description: "Fund transfers & journal entries",
					},
					{
						title: "Corporate Actions",
						href: "/admin/broker-dashboard?tab=corporate-actions",
						icon: FileText,
						description: "Dividends, splits & reorganizations",
					},
					{
						title: "Revenue & Pricing",
						href: "/admin/broker-dashboard?tab=revenue",
						icon: LineChart,
						description: "Broker-dealer revenue & tiers",
					},
					{
						title: "BD Registration",
						href: "/admin/broker-dashboard?tab=app-registration",
						icon: ServerCog,
						description: "Broker-dealer registration & config",
					},
				],
			},
			{
				title: "Loan Marketplace & DSA Routing",
				href: "/admin/loan-marketplace",
				icon: Landmark,
				description: "Multi-bank retail & corporate credit",
				children: [
					{
						title: "Loan Marketplace",
						href: "/admin/loan-marketplace",
						icon: Landmark,
						description: "Products, rates & eligibility",
					},
					{
						title: "DSA Loan Routing",
						href: "/admin/dsa-loans",
						icon: Briefcase,
						description: "Multi-bank partner DSA routing",
					},
					{
						title: "Master DSA Claims",
						href: "/admin/master-dsa-claims",
						icon: Receipt,
						description: "Financier claim tracking",
					},
				],
			},
			{
				title: "Institutional & Master Data",
				href: "/admin/institutional-data",
				icon: Database,
				description: "ISIN master, corporate actions & credit ratings",
			},
			{
				title: "Store & Product Catalog",
				href: "/admin/store-management",
				icon: Store,
				description: "Curated investment product catalog",
			},
			{
				title: "IRIS / KFintech Oversight",
				href: "/admin/iris",
				icon: Radio,
				description: "RTA synchronization & MF investor books",
			},
		],
	},
	{
		id: "operations",
		title: "Operations & KYC",
		icon: Briefcase,
		items: [
			{
				title: "Smart KYC & Video Verification",
				href: "/admin/kyc-v2-management",
				icon: ShieldAlert,
				description: "Automated biometric, V-KYC & OCR sessions",
			},
			{
				title: "Manual Document KYC Reviews",
				href: "/admin/kyc-compliance",
				icon: FileCheck,
				description: "Document verification & exception queue",
			},
			{
				title: "CKYC Deferred Queue",
				href: "/admin/ckyc-deferred",
				icon: Clock,
				description: "Deferred CKYC registry sync",
			},
			{
				title: "Transaction Queue",
				href: "/admin/financial-operations",
				icon: ClipboardList,
				description: "Pending transactions & settlements",
			},
			{
				title: "Trade Reconciliation (T+1)",
				href: "/admin/reconciliation",
				icon: ArrowRightLeft,
				description: "Broker, exchange & gateway matching",
			},
			{
				title: "Order Audit Trail",
				href: "/admin/order-audit",
				icon: History,
				description: "Immutable order modification audit",
			},
			{
				title: "E-Sign & Legal Agreements",
				href: "/admin/esign-management",
				icon: FileSignature,
				description: "Aadhaar e-Sign documents & status",
			},
			{
				title: "Maker-Checker Governance Queue",
				href: "/admin/approval-queue",
				icon: Workflow,
				description: "Multi-eye approval workflow",
			},
			{
				title: "Data Duplicates Resolver",
				href: "/admin/duplicates",
				icon: AlertCircle,
				description: "Detect & deduplicate conflicting master records",
			},
		],
	},
	{
		id: "compliance",
		title: "Compliance & Risk",
		icon: LucideShield,
		items: [
			{
				title: "Regulatory Compliance Dashboard",
				href: "/admin/compliance-dashboard",
				icon: LucideShield,
				description: "SEBI, RBI & PMLA compliance cockpit",
			},
			{
				title: "Desk Licensing & Circuit Breakers",
				href: "/admin/compliance-dashboard?tab=desks",
				icon: Building2,
				description: "LLP desks, licenses & trading thresholds",
			},
			{
				title: "Regulatory Audit Norms",
				href: "/admin/regulatory-audit-norms",
				icon: Scale,
				description: "SEBI/AMFI/PMLA compliance checklist",
			},
			{
				title: "SEBI MF Categorisation 2026",
				href: "/admin/sebi-mf-compliance",
				icon: FileCheck,
				description: "True-to-label scheme categorization audit",
			},
			{
				title: "Risk & Exposure Export",
				href: "/admin/risk-compliance-export",
				icon: AlertTriangle,
				description: "Audit export for statutory reporting",
			},
			{
				title: "CA & RIA Partner Management",
				href: "/admin/ca-management",
				icon: Award,
				description: "Chartered Accountant & RIA governance",
			},
		],
	},
	{
		id: "finance",
		title: "Finance & Treasury",
		icon: DollarSign,
		items: [
			{
				title: "Multibroker Earnings Engine",
				href: "/admin/multibroker-earnings",
				icon: Landmark,
				description:
					"Cross-broker commissions & order-flow revenue (IRIS · IIFL · Alpaca · Upstox)",
				children: [
					{
						title: "Earnings Overview",
						href: "/admin/multibroker-earnings",
						icon: Landmark,
						description: "Cross-broker commission & order-flow dashboard",
					},
					{
						title: "Upstox Live Token Manager",
						href: "/admin/upstox-token",
						icon: Key,
						description: "Rotate & validate live exchange token",
					},
				],
			},
			{
				title: "Partner Hierarchy Tree",
				href: "/admin/partner-hierarchy",
				icon: GitBranch,
				description: "Partner network & override commission tree",
			},
			{
				title: "Commission Master",
				href: "/admin/commission-master",
				icon: Receipt,
				description: "Commission rates, slabs & passthroughs",
			},
			{
				title: "Commission Ledger",
				href: "/admin/commission-ledger",
				icon: FileBarChart,
				description: "Immutable commission accrual ledger",
			},
			{
				title: "Partner Payout Claims",
				href: "/admin/payouts",
				icon: Wallet,
				description: "Payout claims, invoicing & disbursements",
			},
			{
				title: "Revenue & P&L Analytics",
				href: "/admin/revenue-analytics",
				icon: LineChart,
				description: "Net revenue, partner share & trends",
			},
			{
				title: "Firm DP Holdings & Inventory",
				href: "/admin/firm-inventory",
				icon: Package,
				description: "FintekPro FS LLP DP holdings & inventory",
			},
			{
				title: "Global Fee Model",
				href: "/admin/global-fee-model",
				icon: DollarSign,
				description: "Advisory fee schedule & slabs",
			},
			{
				title: "Comprehensive Reports & Tax P&L",
				href: "/admin/reports",
				icon: FileBarChart,
				description: "Platform reports, Tax P&L & capital gains",
			},
		],
	},
	{
		id: "marketing",
		title: "Marketing & Outreach",
		icon: Megaphone,
		items: [
			{
				title: "Marketing Studio",
				href: "/admin/bulk-communication",
				icon: Send,
				description: "Omnichannel campaigns for clients & prospects",
				badge: "Growth",
			},
			{
				title: "Campaign Dashboard",
				href: "/admin/marketing-dashboard",
				icon: LayoutDashboard,
				description: "Aggregated outreach metrics & ROI",
			},
			{
				title: "Email Marketing",
				href: "/admin/email-campaigns",
				icon: Mail,
				description: "Drip campaigns & newsletters",
			},
			{
				title: "WhatsApp Broadcasts",
				href: "/admin/whatsapp-campaigns",
				icon: MessageSquare,
				description: "Official WhatsApp Business broadcasts",
			},
			{
				title: "SMS Campaigns & Inbox",
				href: "/admin/sms-campaigns",
				icon: Radio,
				description: "Transactional & promotional SMS",
				children: [
					{
						title: "SMS Broadcasts",
						href: "/admin/sms-campaigns",
						icon: Radio,
						description: "Campaign dispatches",
					},
					{
						title: "SMS 2-Way Inbox",
						href: "/admin/sms-inbox",
						icon: Inbox,
						description: "Inbound client SMS communications",
					},
				],
			},
			{
				title: "Outreach Analytics",
				href: "/admin/marketing-analytics",
				icon: PieChart,
				description: "Delivery, open & conversion analytics",
			},
		],
	},
	{
		id: "system",
		title: "Observability & System",
		icon: HeartPulse,
		items: [
			{
				title: "System & Infra Health",
				href: "/admin/system-health",
				icon: HeartPulse,
				description: "Server, memory, DB latency & uptime",
			},
			{
				title: "Calculation Engine Health",
				href: "/admin/engine-health-check",
				icon: ServerCog,
				description: "Financial calculation engines diagnostic",
			},
			{
				title: "Golden Pricing Engine",
				href: "/admin/pricing-engine",
				icon: DollarSign,
				description: "Cross-asset real-time pricing benchmarks",
			},
			{
				title: "API Usage & Cost Telemetry",
				href: "/admin/api-usage",
				icon: LineChart,
				description: "Vendor API consumption, latency & costs",
			},
			{
				title: "Database Administration",
				href: "/admin/database",
				icon: Database,
				description: "Drizzle schemas, pool inspection & migrations",
			},
			{
				title: "Data Providers & Fallbacks",
				href: "/admin/data-providers",
				icon: Layers,
				description: "Exchange & vendor feed fallback cascade",
			},
			{
				title: "Pre-Deploy Production Readiness",
				href: "/admin/production-readiness",
				icon: CheckCircle,
				description: "Zero-defect pre-flight production audit",
			},
		],
	},
	{
		id: "settings",
		title: "Settings & Security",
		icon: Cog,
		items: [
			{
				title: "Users & Role Access (RBAC)",
				href: "/admin/users",
				icon: Users,
				description: "User accounts, roles & permissions",
			},
			{
				title: "Role Appointments & Approvals",
				href: "/admin/appointments",
				icon: UserCog,
				description: "Corporate appointments & role grants",
			},
			{
				title: "Integration & API Credentials",
				href: "/admin/api-config",
				icon: Key,
				description: "Vendor credentials, webhook secrets & keys",
			},
			{
				title: "Unified KYC Flow Provider",
				href: "/admin/kyc-flow",
				icon: Workflow,
				description: "Configure primary & fallback KYC vendors",
			},
			{
				title: "Feature Flags & Rollouts",
				href: "/admin/feature-flags",
				icon: Lightbulb,
				description: "A/B testing, beta toggles & kill-switches",
			},
			{
				title: "Document & PDF Parser",
				href: "/admin/parser-config",
				icon: FileText,
				description: "CAS, CAMS, Karvy & statement parsing rules",
			},
			{
				title: "WhatsApp Device Setup",
				href: "/admin/whatsapp-setup",
				icon: MessageSquare,
				description: "Link WhatsApp Web QR & connection state",
			},
			{
				title: "Theme & Display Customization",
				href: "/admin/theme-settings",
				icon: Palette,
				description: "Branding, dark/light theme & typography",
			},
			{
				title: "Account Security & Settings",
				href: "/admin/settings",
				icon: Settings,
				description: "Admin credentials, PIN, 2FA & sessions",
			},
		],
	},
];

const allNavItems = navCategories.flatMap((cat) =>
	cat.items.flatMap((item) =>
		item.children ? [item, ...item.children] : [item],
	),
);

interface Notification {
	id: string;
	type: "kyc" | "compliance" | "order" | "system";
	title: string;
	message: string;
	timestamp: Date;
	read: boolean;
	link?: string;
}

export function AdminLayout({ children }: AdminLayoutProps) {
	const { user, isLoading } = useAuth();
	const [location, navigate] = useLocation();
	const currentSearch = useSearch();
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
		new Set(["dashboard"]),
	);
	const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
	const [searchOpen, setSearchOpen] = useState(false);
	const [notificationsOpen, setNotificationsOpen] = useState(false);

	const { data: kycResponse } = useQuery<{
		success: boolean;
		data: { pendingKyc: number; activeAlerts: number };
	}>({
		queryKey: ["/api/admin/kyc/dashboard"],
		refetchInterval: 60000,
	});

	const { data: pendingOrdersResponse } = useQuery<{
		total: number;
		unlistedPending: number;
		bondPending: number;
	}>({
		queryKey: ["/api/admin/pending-orders/count"],
		refetchInterval: 60000,
	});

	const { data: smsInboxResponse } = useQuery<{ unreadCount: number }>({
		queryKey: ["/api/twilio/admin/messages/unread-count"],
		refetchInterval: 30000,
	});

	const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
	const [isTogglingBeaconKillSwitch, setIsTogglingBeaconKillSwitch] = useState(false);

	const { data: surveillanceMetrics, refetch: refetchSurveillance } = useQuery<{
		success: boolean;
		data: {
			activeIncidents: number;
			quarantinedTransactions: number;
			recentCriticalCount: number;
			killSwitchStates: Record<string, { active: boolean; reason: string; triggeredAt: string; triggeredBy: string }>;
		};
	}>({
		queryKey: ["/api/admin/surveillance/metrics"],
		refetchInterval: 10000,
	});

	const isKillSwitchActive = surveillanceMetrics?.data?.killSwitchStates?.orders?.active ?? false;
	const activeSurveillanceIncidents = surveillanceMetrics?.data?.activeIncidents || 0;

	const smsUnreadCount = smsInboxResponse?.unreadCount || 0;

	const notifications: Notification[] = useMemo(() => {
		const items: Notification[] = [];
		const pendingKyc = kycResponse?.data?.pendingKyc || 0;
		const activeAlerts = kycResponse?.data?.activeAlerts || 0;
		const pendingOrders = pendingOrdersResponse?.total || 0;

		if (pendingKyc > 0) {
			items.push({
				id: "kyc-pending",
				type: "kyc",
				title: "Pending KYC Reviews",
				message: `${pendingKyc} KYC submission${pendingKyc > 1 ? "s" : ""} awaiting review`,
				timestamp: new Date(),
				read: false,
				link: "/admin/kyc-compliance",
			});
		}
		if (activeAlerts > 0) {
			items.push({
				id: "compliance-alerts",
				type: "compliance",
				title: "Compliance Alerts",
				message: `${activeAlerts} active alert${activeAlerts > 1 ? "s" : ""} require attention`,
				timestamp: new Date(),
				read: false,
				link: "/admin/duplicates",
			});
		}
		if (pendingOrders > 0) {
			items.push({
				id: "pending-orders",
				type: "order",
				title: "Pending Orders",
				message: `${pendingOrders} order${pendingOrders > 1 ? "s" : ""} awaiting action`,
				timestamp: new Date(),
				read: false,
				link: "/admin/unlisted/orders",
			});
		}
		return items;
	}, [kycResponse, pendingOrdersResponse]);

	const unreadCount = notifications.filter((n) => !n.read).length;

	const hrefPath = (href: string) => href.split("?")[0];

	const isHrefActive = (href: string): boolean => {
		const path = hrefPath(href);
		if (location !== path && !location.startsWith(path + "/")) return false;
		const queryPart = href.includes("?") ? href.split("?")[1] : null;
		if (!queryPart) return true;
		const hrefParams = new URLSearchParams(queryPart);
		const currentParams = new URLSearchParams(currentSearch);
		for (const [key, value] of hrefParams.entries()) {
			if (currentParams.get(key) !== value) return false;
		}
		return true;
	};

	useEffect(() => {
		navCategories.forEach((category) => {
			category.items.forEach((item) => {
				if (item.children) {
					const isChildActive = item.children.some(
						(child) =>
							location === hrefPath(child.href) ||
							location.startsWith(hrefPath(child.href) + "/"),
					);
					if (isChildActive) {
						setExpandedCategories((prev) => new Set([...prev, category.id]));
						setExpandedMenus((prev) => new Set([...prev, item.title]));
					}
				}
				if (location === hrefPath(item.href)) {
					setExpandedCategories((prev) => new Set([...prev, category.id]));
				}
			});
		});
	}, [location]);

	const toggleCategory = (categoryId: string) => {
		setExpandedCategories((prev) => {
			const next = new Set(prev);
			if (next.has(categoryId)) {
				next.delete(categoryId);
			} else {
				next.add(categoryId);
			}
			return next;
		});
	};

	const toggleMenu = (title: string) => {
		setExpandedMenus((prev) => {
			const next = new Set(prev);
			if (next.has(title)) {
				next.delete(title);
			} else {
				next.add(title);
			}
			return next;
		});
	};

	const logoutMutation = useMutation({
		mutationFn: () => apiRequest("/api/logout", { method: "POST" }),
		onSuccess: () => {
			// Clear all client-side auth artifacts so X-Session-ID cannot re-authenticate
			try {
				localStorage.removeItem("fintekpro_sid");
			} catch {}
			try {
				sessionStorage.removeItem("fintekpro_was_authenticated");
			} catch {}
			// Hard redirect to auth page on the correct subdomain
			window.location.href = "/auth" + getPortalQueryParams();
		},
	});

	const handleSearchSelect = (href: string) => {
		setSearchOpen(false);
		navigate(href);
	};

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setSearchOpen((open) => !open);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
			</div>
		);
	}

	if (!user) {
		if (typeof window !== "undefined") {
			window.location.href = "/auth" + getPortalQueryParams();
		}
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4" />
					<p className="text-muted-foreground">Redirecting to login...</p>
				</div>
			</div>
		);
	}

	const isAdmin =
		user.roles?.includes("admin") ||
		user.roles?.includes("superadmin") ||
		user.roles?.includes("tester"); // Tester role has universal portal access (QA/dev)


	if (!isAdmin) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center justify-center p-4">
				<div className="bg-background rounded-lg shadow-xl p-8 max-w-md w-full text-center">
					<AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
					<h1 className="text-2xl font-bold text-foreground mb-2">
						Access Denied
					</h1>
					<p className="text-muted-foreground mb-2">
						This admin portal is restricted to administrators only.
					</p>
					{user.email && (
						<p className="text-sm text-muted-foreground mb-6">
							You are signed in as <strong>{user.email}</strong>, which does not
							have admin access.
						</p>
					)}
					<div className="space-y-3">
						<Button
							className="w-full"
							onClick={async () => {
								try {
									await fetch("/api/logout", {
										method: "POST",
										credentials: "include",
									});
								} catch {}
								window.location.href = "/auth";
							}}
						>
							Sign Out and Switch Account
						</Button>
						<Button variant="outline" asChild className="w-full">
							<a href="https://fintekpro.com">Go to Main Portal</a>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
			<Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<ShieldAlert className="h-5 w-5 text-red-500" />
							Emergency Risk Management (RMS)
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="p-3 rounded-lg border bg-muted/30 space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									Order Execution Pipeline
								</span>
								<Badge
									className={
										isKillSwitchActive
											? "bg-red-600 text-white font-bold"
											: "bg-emerald-600 text-white font-bold"
									}
								>
									{isKillSwitchActive ? "HALTED" : "ACTIVE"}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								{isKillSwitchActive
									? `Halt reason: ${surveillanceMetrics?.data?.killSwitchStates?.orders?.reason || "Emergency action triggered"}`
									: "Order routing, transaction compliance gates, and broker links operating normally."}
							</p>
						</div>

						<div className="grid grid-cols-2 gap-2 text-center">
							<div className="p-2.5 rounded-lg border bg-card">
								<div className="text-lg font-bold text-foreground">
									{activeSurveillanceIncidents}
								</div>
								<div className="text-[11px] text-muted-foreground">
									Active Incidents
								</div>
							</div>
							<div className="p-2.5 rounded-lg border bg-card">
								<div className="text-lg font-bold text-orange-600">
									{surveillanceMetrics?.data?.quarantinedTransactions || 0}
								</div>
								<div className="text-[11px] text-muted-foreground">
									Quarantined Orders
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-2 pt-2">
							<Button
								variant={isKillSwitchActive ? "outline" : "destructive"}
								className="w-full font-semibold"
								disabled={isTogglingBeaconKillSwitch}
								onClick={async () => {
									try {
										setIsTogglingBeaconKillSwitch(true);
										const nextActive = !isKillSwitchActive;
										await apiRequest("/api/admin/surveillance/kill-switch", {
											method: "POST",
											body: JSON.stringify({
												scope: "orders",
												active: nextActive,
												reason: nextActive
													? "Manual emergency trip by Administrator from Top Navigation RMS Beacon"
													: "Manual operational reset by Administrator from Top Navigation RMS Beacon",
											}),
										});
										await refetchSurveillance();
									} catch (e) {
										console.error("Failed to toggle kill switch", e);
									} finally {
										setIsTogglingBeaconKillSwitch(false);
									}
								}}
							>
								{isKillSwitchActive
									? "Disengage Kill-Switch (Resume Orders)"
									: "🚨 TRIP EMERGENCY KILL-SWITCH"}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="text-xs"
								onClick={() => {
									setEmergencyModalOpen(false);
									navigate("/admin/agent-oversight");
								}}
							>
								Open Full Surveillance & Incident Console →
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={searchOpen} onOpenChange={setSearchOpen}>
				<DialogContent
					className="bg-background border-border p-0 max-w-lg"
					aria-describedby={undefined}
				>
					<DialogTitle className="sr-only">Search Admin Features</DialogTitle>
					<Command className="bg-transparent">
						<CommandInput
							placeholder="Search admin features..."
							className="border-0"
						/>
						<CommandList>
							<CommandEmpty>No results found.</CommandEmpty>
							{navCategories.map((category) => (
								<CommandGroup key={category.id} heading={category.title}>
									{category.items.map((item) => (
										<CommandItem
											key={item.href}
											value={`${item.title} ${item.description}`}
											onSelect={() => handleSearchSelect(item.href)}
											className="cursor-pointer"
										>
											<item.icon className="mr-2 h-4 w-4" />
											<span>{item.title}</span>
											<span className="ml-2 text-xs text-muted-foreground">
												{item.description}
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							))}
						</CommandList>
					</Command>
				</DialogContent>
			</Dialog>

			<header className="bg-background border-b border-border sticky top-0 z-50">
				<div className="flex items-center justify-between px-4 py-3">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSidebarOpen(!sidebarOpen)}
							className="text-muted-foreground hover:text-foreground"
							data-testid="btn-toggle-sidebar"
						>
							{sidebarOpen ? (
								<X className="h-5 w-5" />
							) : (
								<Menu className="h-5 w-5" />
							)}
						</Button>
						<div className="flex items-center gap-3">
							<PortalLogo size="md" showTagline />
							<div className="hidden">
								<h1 className="text-xl font-bold text-foreground">
									FintekPro Admin
								</h1>
								<p className="text-xs text-muted-foreground">
									System Administration Portal
								</p>
							</div>
						</div>
					</div>

					<div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
						<Button
							variant="outline"
							className="w-full justify-start text-muted-foreground border-border hover:bg-card"
							onClick={() => setSearchOpen(true)}
							data-testid="btn-global-search"
						>
							<Search className="h-4 w-4 mr-2" />
							<span>Search features...</span>
							<kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
								<span className="text-xs">⌘</span>K
							</kbd>
						</Button>
					</div>
					{/* Mobile search icon */}
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setSearchOpen(true)}
						className="md:hidden text-muted-foreground hover:text-foreground"
						data-testid="btn-global-search-mobile"
					>
						<Search className="h-5 w-5" />
					</Button>

					<div className="flex items-center gap-3">
						{/* Real-Time Surveillance & Emergency RMS Beacon */}
						{isKillSwitchActive ? (
							<Button
								variant="destructive"
								size="sm"
								onClick={() => setEmergencyModalOpen(true)}
								className="animate-pulse h-8 px-2.5 text-xs font-bold gap-1.5 shadow-sm"
								title="Trading Kill-Switch Active - Click to Inspect"
							>
								<ShieldAlert className="h-4 w-4" />
								<span>KILL-SWITCH ACTIVE</span>
							</Button>
						) : activeSurveillanceIncidents > 0 ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setEmergencyModalOpen(true)}
								className="border-amber-500/80 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 h-8 px-2.5 text-xs font-medium gap-1.5"
								title="Active Surveillance Incidents"
							>
								<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
								<span>RMS: {activeSurveillanceIncidents} Alert{activeSurveillanceIncidents > 1 ? "s" : ""}</span>
							</Button>
						) : (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setEmergencyModalOpen(true)}
								className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5 gap-1.5 hidden sm:inline-flex"
								title="Risk Management & Surveillance Status: Nominal"
							>
								<span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
								<span className="font-medium text-[11px] tracking-tight">RMS Nominal</span>
							</Button>
						)}
						<DropdownMenu
							open={notificationsOpen}
							onOpenChange={setNotificationsOpen}
						>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="text-muted-foreground hover:text-foreground relative"
									data-testid="btn-notifications"
								>
									<Bell className="h-5 w-5" />
									{unreadCount > 0 && (
										<Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
											{unreadCount}
										</Badge>
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-80 bg-background border-border"
							>
								<DropdownMenuLabel className="text-muted-foreground">
									Notifications
								</DropdownMenuLabel>
								<DropdownMenuSeparator className="bg-muted" />
								{notifications.length === 0 ? (
									<div className="p-4 text-center text-muted-foreground">
										<CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
										<p className="text-sm">All caught up!</p>
									</div>
								) : (
									notifications.map((notification) => (
										<DropdownMenuItem
											key={notification.id}
											className="flex items-start gap-3 p-3 cursor-pointer hover:bg-card"
											onClick={() =>
												notification.link && navigate(notification.link)
											}
										>
											<div
												className={cn(
													"w-2 h-2 rounded-full mt-2 flex-shrink-0",
													notification.type === "kyc" && "bg-orange-400",
													notification.type === "compliance" && "bg-red-400",
													notification.type === "order" && "bg-blue-400",
													notification.type === "system" &&
														"bg-muted-foreground",
												)}
											/>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium text-foreground">
													{notification.title}
												</p>
												<p className="text-xs text-muted-foreground mt-0.5">
													{notification.message}
												</p>
											</div>
										</DropdownMenuItem>
									))
								)}
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Avatar dropdown */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="flex items-center gap-2 px-2 h-9 hover:bg-card rounded-lg"
									data-testid="button-admin-profile-menu"
								>
									<div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
										{user?.email?.charAt(0).toUpperCase() || "A"}
									</div>
									<div className="text-left hidden md:block">
										<p className="text-xs font-medium text-foreground leading-tight max-w-[100px] truncate">
											{user?.email?.split("@")[0] || "Admin"}
										</p>
										<p className="text-[10px] text-blue-400 font-medium capitalize">
											{user?.roles?.includes("superadmin")
												? "Super Admin"
												: "Admin"}
										</p>
									</div>
									<ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-64 bg-background border-border shadow-xl"
								sideOffset={8}
							>
								<DropdownMenuLabel className="p-3">
									<div className="flex items-center gap-3">
										<div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
											{user?.email?.charAt(0).toUpperCase() || "A"}
										</div>
										<div className="min-w-0">
											<p className="text-sm font-semibold text-foreground truncate">
												{user?.firstName && user?.lastName
													? `${user.firstName} ${user.lastName}`
													: user?.email?.split("@")[0] || "Admin"}
											</p>
											<p className="text-xs text-muted-foreground truncate">
												{user?.email}
											</p>
											<p className="text-[10px] text-blue-400 font-medium capitalize mt-0.5">
												{user?.roles?.includes("superadmin")
													? "Super Admin"
													: "Admin"}
											</p>
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link
										href="/profile"
										className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
									>
										<UserCheck className="h-4 w-4 text-muted-foreground" />
										<span className="text-sm">Admin Profile</span>
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link
										href="/admin/theme-settings"
										className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
									>
										<Palette className="h-4 w-4 text-muted-foreground" />
										<span className="text-sm">Theme & Accessibility</span>
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link
										href="/admin/users"
										className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
									>
										<Settings className="h-4 w-4 text-muted-foreground" />
										<span className="text-sm">Admin Settings</span>
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<a
										href="https://partner.fintekpro.com"
										className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-emerald-500 font-medium"
									>
										<Briefcase className="h-4 w-4" />
										<span className="text-sm">Partner Portal</span>
									</a>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<a
										href="https://fintekpro.com"
										className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-blue-500"
									>
										<Home className="h-4 w-4" />
										<span className="text-sm">Client Portal</span>
									</a>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="flex items-center gap-2.5 px-3 py-2 text-red-500 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
									onClick={() => logoutMutation.mutate()}
									data-testid="button-logout"
								>
									<LogOut className="h-4 w-4" />
									<span className="text-sm font-medium">Sign Out</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</header>

			<div className="flex flex-1 overflow-hidden">
				{/* Mobile backdrop overlay */}
				{sidebarOpen && (
					<button
						type="button"
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden w-full h-full border-0 p-0 cursor-default"
						aria-label="Close sidebar"
						onClick={() => setSidebarOpen(false)}
					/>
				)}

				<aside
					className={cn(
						"bg-background border-r border-border transition-all duration-300 overflow-y-auto",
						"md:sticky md:top-[73px] md:h-[calc(100vh-73px)]",
						"max-md:fixed max-md:top-[73px] max-md:left-0 max-md:h-[calc(100vh-73px)] max-md:z-50 max-md:shadow-2xl",
						sidebarOpen
							? "md:w-72 max-md:w-72 max-md:translate-x-0"
							: "md:w-0 md:border-0 max-md:-translate-x-full max-md:w-72",
					)}
				>
					{sidebarOpen && (
						<nav className="p-3 space-y-2">
							{navCategories.map((category) => {
								const CategoryIcon = category.icon;
								const isCategoryExpanded = expandedCategories.has(category.id);
								const hasActiveItem = category.items.some(
									(item) =>
										location === hrefPath(item.href) ||
										item.children?.some(
											(child) =>
												location === hrefPath(child.href) ||
												location.startsWith(hrefPath(child.href) + "/"),
										),
								);

								return (
									<div key={category.id} className="space-y-1">
										<button
											onClick={() => toggleCategory(category.id)}
											className={cn(
												"w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
												hasActiveItem
													? "bg-blue-600/10 text-blue-400"
													: "text-muted-foreground hover:bg-card hover:text-foreground",
											)}
											data-testid={`btn-category-${category.id}`}
										>
											<CategoryIcon className="h-4 w-4" />
											<span className="text-sm font-semibold flex-1">
												{category.title}
											</span>
											{isCategoryExpanded ? (
												<ChevronDown className="h-4 w-4" />
											) : (
												<ChevronRight className="h-4 w-4" />
											)}
										</button>

										{isCategoryExpanded && (
											<div className="ml-2 space-y-0.5">
												{category.items.map((item) => {
													const Icon = item.icon;
													const hasChildren =
														item.children && item.children.length > 0;
													const isExpanded = expandedMenus.has(item.title);
													const isActive = location === hrefPath(item.href);
													const isChildActive =
														hasChildren &&
														item.children?.some(
															(child) =>
																location === hrefPath(child.href) ||
																location.startsWith(hrefPath(child.href) + "/"),
														);

													if (hasChildren) {
														return (
															<div key={item.title}>
																<button
																	onClick={() => toggleMenu(item.title)}
																	className={cn(
																		"w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
																		isChildActive
																			? "bg-blue-600/20 text-blue-400"
																			: "text-muted-foreground hover:bg-card hover:text-foreground",
																	)}
																	data-testid={`btn-menu-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
																>
																	<Icon className="h-4 w-4 flex-shrink-0" />
																	<span className="text-sm flex-1">
																		{item.title}
																	</span>
																	{isExpanded ? (
																		<ChevronDown className="h-3 w-3 text-muted-foreground" />
																	) : (
																		<ChevronRight className="h-3 w-3 text-muted-foreground" />
																	)}
																</button>

																{isExpanded && (
																	<div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
																		{item.children?.map((child) => {
																			const ChildIcon = child.icon;
																			const isChildItemActive = isHrefActive(
																				child.href,
																			);

																			return (
																				<Link
																					key={child.href}
																					href={child.href}
																					className={cn(
																						"flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm",
																						isChildItemActive
																							? "bg-blue-600 text-white"
																							: "text-muted-foreground hover:bg-card hover:text-foreground",
																					)}
																					data-testid={`link-admin-${child.href.split("/").pop()}`}
																				>
																					<ChildIcon className="h-3.5 w-3.5 flex-shrink-0" />
																					<span>{child.title}</span>
																				</Link>
																			);
																		})}
																	</div>
																)}
															</div>
														);
													}

													const showBadge =
														item.href === "/admin/sms-inbox" &&
														smsUnreadCount > 0;

													return (
														<Link
															key={item.href}
															href={item.href}
															className={cn(
																"flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
																isActive
																	? "bg-blue-600 text-white"
																	: "text-muted-foreground hover:bg-card hover:text-foreground",
															)}
															data-testid={`link-admin-${item.href.split("/").pop()}`}
														>
															<Icon className="h-4 w-4 flex-shrink-0" />
															<span className="text-sm flex-1">
																{item.title}
															</span>
															{item.badge && (
																<Badge
																	variant="outline"
																	className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-medium"
																>
																	{item.badge}
																</Badge>
															)}
															{showBadge && (
																<Badge className="h-5 min-w-[20px] flex items-center justify-center p-0 bg-red-500 text-white text-xs">
																	{smsUnreadCount > 99 ? "99+" : smsUnreadCount}
																</Badge>
															)}
														</Link>
													);
												})}
											</div>
										)}
									</div>
								);
							})}
						</nav>
					)}
				</aside>

				<main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-3 py-4 sm:p-6">
					<div className="w-full max-w-7xl mx-auto">{children}</div>
				</main>
			</div>

			<FloatingChatWidget />
		</div>
	);
}
