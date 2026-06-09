import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import fintekproLogo from "@assets/fintekpro_partners_1772539048013.png";
import { PortalLogo } from "@/components/portal/PortalLogo";
import { Button } from "@/components/ui/button";
import { getPortalQueryParams } from "@/hooks/useSubdomain";
import {
	Home,
	Bell,
	LogOut,
	Menu,
	X,
	Settings,
	Users,
	HelpCircle,
	BarChart3,
	UserCheck,
	Wallet,
	ChevronDown,
	ChevronRight,
	AlertCircle,
	GitBranch,
	Receipt,
	UserCircle,
	FileText,
	Calculator,
	Briefcase,
	ClipboardList,
	Building2,
	TrendingUp,
	LineChart,
	DollarSign,
	UserCog,
	Palette,
	ShieldCheck,
	Headphones,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PartnerLayoutProps {
	children: React.ReactNode;
}

interface NavItem {
	title: string;
	href?: string;
	icon: LucideIcon;
	description: string;
	children?: { title: string; href: string; description?: string }[];
}

interface NavSection {
	id: string;
	section: string;
	items: NavItem[];
}

const partnerNavSections: NavSection[] = [
	{
		id: "overview",
		section: "Overview",
		items: [
			{
				title: "Dashboard",
				href: "/partner-portal",
				icon: Home,
				description: "Key metrics & overview",
			},
		],
	},
	{
		id: "agent-network",
		section: "Agent Network",
		items: [
			{
				title: "My Team",
				href: "/partner/my-team?tab=team",
				icon: GitBranch,
				description: "Sub-agents, SM/RM, invites & commissions",
			},
			{
				title: "Agent Cost Centre",
				href: "/partner/agents",
				icon: Users,
				description: "Recruit & manage agents in your hierarchy",
			},
			{
				title: "Agent Performance",
				href: "/partner/agent-performance",
				icon: LineChart,
				description: "Track agent metrics & P&L",
			},
			{
				title: "Agent Payouts",
				href: "/partner/payouts",
				icon: DollarSign,
				description: "Commission payouts & settlements",
			},
		],
	},
	{
		id: "ca-services",
		section: "CA Services",
		items: [
			{
				title: "CA Management",
				href: "/partner/ca-management",
				icon: UserCheck,
				description: "Onboard CAs & assign cases",
			},
			{
				title: "CA Dashboard",
				href: "/partner/ca-dashboard",
				icon: Briefcase,
				description: "Cases, client overview & CA earnings",
			},
			{
				title: "CA Clients",
				href: "/partner/ca-clients",
				icon: UserCog,
				description: "Manage CA-assigned clients",
			},
			{
				title: "CA Support",
				href: "/partner/ca-support",
				icon: Headphones,
				description: "CA assistance & support tickets",
			},
		],
	},
	{
		id: "earnings",
		section: "Earnings & Compliance",
		items: [
			{
				title: "Revenue Sheet",
				href: "/partner/revenue-sheet",
				icon: Receipt,
				description: "Case-wise monthly earnings",
			},
			{
				title: "Payout Statement",
				href: "/partner-portal?tab=statement",
				icon: Wallet,
				description: "Auditable payout records",
			},
			{
				title: "Earnings Model",
				href: "/partner-portal?tab=earnings",
				icon: TrendingUp,
				description: "How your earnings are calculated",
			},
			{
				title: "Compliance",
				href: "/partner-portal?tab=compliance",
				icon: ShieldCheck,
				description: "Regulatory disclosures & obligations",
			},
		],
	},
	{
		id: "account",
		section: "Account",
		items: [
			{
				title: "My Profile",
				href: "/partner/my-profile",
				icon: UserCircle,
				description: "Credentials, KYC & bank details",
			},
			{
				title: "Support",
				href: "/partner-portal?tab=support",
				icon: HelpCircle,
				description: "Your support requests",
			},
			{
				title: "Settings",
				href: "/settings",
				icon: Settings,
				description: "Password, PIN & security",
			},
			{
				title: "Theme & Display",
				href: "/theme-settings",
				icon: Palette,
				description: "Preferences & visual customization",
			},
		],
	},
];

export function PartnerLayout({ children }: PartnerLayoutProps) {
	const { user, isLoading } = useAuth();
	const [location] = useLocation();
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [expandedItems, setExpandedItems] = useState<string[]>([]);

	const { data: caStatus } = useQuery<{ isCaQualified: boolean }>({
		queryKey: ["/api/partner/ca-status"],
		enabled: !!user,
		staleTime: 5 * 60 * 1000,
	});
	const isCaQualified = caStatus?.isCaQualified ?? false;

	const caOnlySections = ["CA Services"];
	const visibleNavSections = partnerNavSections.filter(
		(s) => !caOnlySections.includes(s.section) || isCaQualified,
	);

	const toggleExpanded = (title: string) => {
		setExpandedItems((prev) =>
			prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
		);
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

	if (isLoading) {
		return (
			<div className="min-h-screen bg-indigo-950 flex items-center justify-center">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500" />
			</div>
		);
	}

	if (!user) {
		if (typeof window !== "undefined") {
			window.location.href = "/auth" + getPortalQueryParams();
		}
		return (
			<div className="min-h-screen bg-indigo-950 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500 mx-auto mb-4" />
					<p className="text-indigo-300">Redirecting to login...</p>
				</div>
			</div>
		);
	}

	const isPartner =
		user.roles?.includes("partner") ||
		user.roles?.includes("agent") ||
		user.roles?.includes("master_agent") ||
		user.roles?.includes("sub_agent") ||
		user.roles?.includes("admin") ||
		user.roles?.includes("superadmin");

	if (!isPartner) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center justify-center p-4">
				<div className="bg-background rounded-lg shadow-xl p-8 max-w-md w-full text-center">
					<AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
					<h1 className="text-2xl font-bold text-foreground mb-2">
						Access Denied
					</h1>
					<p className="text-muted-foreground mb-2">
						This partner portal is restricted to registered partners only.
					</p>
					{user.email && (
						<p className="text-sm text-muted-foreground mb-6">
							You are signed in as <strong>{user.email}</strong>, which does not
							have partner access.
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
						<Button
							asChild
							className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
						>
							<a href="/partner/register">Register as Partner</a>
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
		<div className="min-h-screen bg-indigo-950 text-white">
			<header className="bg-indigo-900 border-b border-indigo-800 sticky top-0 z-50">
				<div className="flex items-center justify-between px-4 py-3">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSidebarOpen(!sidebarOpen)}
							className="text-indigo-300 hover:text-foreground"
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
									FintekPro Partner
								</h1>
								<p className="text-xs text-indigo-300">
									Business Partner Portal
								</p>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-4">
						<Link href="/theme-settings">
							<Button
								variant="ghost"
								size="icon"
								className="text-indigo-300 hover:text-foreground"
								data-testid="btn-theme-settings"
								title="Theme & Accessibility"
							>
								<Settings className="h-5 w-5" />
							</Button>
						</Link>
						<Button
							variant="ghost"
							size="icon"
							className="text-indigo-300 hover:text-foreground relative"
						>
							<Bell className="h-5 w-5" />
						</Button>

						<div className="flex items-center gap-3 border-l border-indigo-800 pl-4">
							<div className="text-right">
								<p className="text-sm font-medium text-white">
									{user?.firstName && user?.lastName
										? `${user.firstName} ${user.lastName}`
										: user?.email?.split("@")[0] || "Partner"}
								</p>
								<p className="text-xs text-indigo-400 capitalize">
									{user?.roles?.includes("master_agent")
										? "Master Agent"
										: user?.roles?.includes("partner")
											? "Partner"
											: user?.roles?.includes("agent")
												? "Agent"
												: "Partner"}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								asChild
								className="text-indigo-300 hover:text-foreground"
								data-testid="button-partner-client-portal"
								title="Client Portal"
							>
								<a
									href="https://fintekpro.com"
									title="Client Portal"
									aria-label="Client Portal"
								>
									<Home className="h-5 w-5" />
									<span className="sr-only">Client Portal</span>
								</a>
							</Button>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => logoutMutation.mutate()}
								className="text-indigo-300 hover:text-red-400"
								data-testid="button-partner-logout"
								title="Sign Out"
							>
								<LogOut className="h-5 w-5" />
							</Button>
						</div>
					</div>
				</div>
			</header>

			<div className="flex min-h-0">
				{/* Mobile backdrop overlay */}
				{sidebarOpen && (
					<div
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
						onClick={() => setSidebarOpen(false)}
					/>
				)}

				<aside
					className={cn(
						"bg-indigo-900 border-r border-indigo-800 transition-all duration-300 overflow-y-auto",
						"md:sticky md:top-[73px] md:h-[calc(100vh-73px)]",
						"max-md:fixed max-md:top-[73px] max-md:left-0 max-md:h-[calc(100vh-73px)] max-md:z-50 max-md:shadow-2xl",
						sidebarOpen
							? "md:w-72 max-md:w-72 max-md:translate-x-0"
							: "md:w-0 md:border-0 max-md:-translate-x-full max-md:w-72",
					)}
				>
					{sidebarOpen && (
						<nav className="p-4 space-y-4">
							{visibleNavSections.map((section) => (
								<div key={section.id}>
									<h3 className="px-3 mb-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
										{section.section}
									</h3>
									<div className="space-y-1">
										{section.items.map((item) => {
											const Icon = item.icon;
											const itemHref = item.href || "";
											const itemPath = itemHref.split("?")[0];
											const itemQuery = itemHref.includes("?")
												? itemHref.split("?")[1]
												: null;
											const currentPath = location.split("?")[0];
											const currentQuery =
												typeof window !== "undefined"
													? window.location.search.slice(1)
													: "";
											const isActive =
												item.href &&
												(itemQuery
													? currentPath === itemPath &&
														currentQuery === itemQuery
													: location === itemHref || currentPath === itemPath);
											const hasChildren =
												item.children && item.children.length > 0;
											const isExpanded = expandedItems.includes(item.title);

											if (hasChildren) {
												return (
													<div key={item.title}>
														<button
															onClick={() => toggleExpanded(item.title)}
															className={cn(
																"w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group text-left",
																"text-indigo-300 hover:bg-indigo-800 hover:text-white",
															)}
														>
															<Icon className="h-4 w-4 flex-shrink-0" />
															<span className="flex-1 text-sm font-medium text-indigo-200 group-hover:text-foreground">
																{item.title}
															</span>
															{isExpanded ? (
																<ChevronDown className="h-4 w-4 text-indigo-400" />
															) : (
																<ChevronRight className="h-4 w-4 text-indigo-400" />
															)}
														</button>
														{isExpanded && (
															<div className="ml-7 mt-1 space-y-1">
																{item.children!.map((child) => {
																	const hasQueryParam =
																		child.href.includes("?");
																	const childActive = hasQueryParam
																		? location === child.href
																		: location === child.href ||
																			location.startsWith(child.href);
																	return (
																		<Link
																			key={child.href}
																			href={child.href}
																			className={cn(
																				"block px-3 py-2 rounded-md text-sm transition-colors",
																				childActive
																					? "bg-violet-600 text-white"
																					: "text-indigo-400 hover:bg-indigo-800 hover:text-white",
																			)}
																		>
																			{child.title}
																		</Link>
																	);
																})}
															</div>
														)}
													</div>
												);
											}

											return (
												<Link
													key={item.href}
													href={item.href!}
													className={cn(
														"flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
														isActive
															? "bg-violet-600 text-white"
															: "text-indigo-300 hover:bg-indigo-800 hover:text-white",
													)}
													data-testid={`link-partner-${item.href!.split("/").pop() || "home"}`}
												>
													<Icon className="h-4 w-4 flex-shrink-0" />
													<span
														className={cn(
															"text-sm font-medium",
															isActive
																? "text-foreground"
																: "text-indigo-200 group-hover:text-foreground",
														)}
													>
														{item.title}
													</span>
												</Link>
											);
										})}
									</div>
								</div>
							))}
						</nav>
					)}
				</aside>

				<main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto px-3 py-4 sm:p-6">
					<div className="w-full max-w-7xl mx-auto">{children}</div>
				</main>
			</div>
		</div>
	);
}
