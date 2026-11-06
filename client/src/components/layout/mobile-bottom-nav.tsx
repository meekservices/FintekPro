import { Link, useLocation } from "wouter";
import {
	Home,
	PieChart,
	TrendingUp,
	ShoppingCart,
	User,
	Sparkles,
	ArrowRight,
	Store,
	Users,
	Target,
	FileText,
	LayoutDashboard,
	type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/use-cart";
import { useSubdomain } from "@/hooks/useSubdomain";
import { Badge } from "@/components/ui/badge";

interface NavItemDef {
	href: string;
	icon: LucideIcon;
	label: string;
	matchPrefix?: boolean;
	highlightDot?: boolean;
	showBadge?: boolean;
	badgeText?: string;
}

const INVESTOR_NAV_ITEMS: NavItemDef[] = [
	{ href: "/", icon: Home, label: "Home" },
	{ href: "/picks", icon: Sparkles, label: "Ideas", highlightDot: true },
	{ href: "/portfolio", icon: PieChart, label: "Portfolio", matchPrefix: true },
	{ href: "/markets", icon: TrendingUp, label: "Markets" },
	{ href: "/unified-cart", icon: ShoppingCart, label: "Cart", showBadge: true },
	{ href: "/profile", icon: User, label: "Profile" },
];

const PARTNER_NAV_ITEMS: NavItemDef[] = [
	{ href: "/agent/dashboard", icon: LayoutDashboard, label: "Home" },
	{ href: "/agent/store", icon: Store, label: "Store", badgeText: "STORE" },
	{ href: "/agent/clients", icon: Users, label: "Clients" },
	{ href: "/agent/financial-planning", icon: Target, label: "Planning", highlightDot: true },
	{ href: "/agent/proposals", icon: FileText, label: "Proposals" },
];

const CA_NAV_ITEMS: NavItemDef[] = [
	{ href: "/ca/dashboard", icon: LayoutDashboard, label: "Home" },
	{ href: "/ca/clients", icon: Users, label: "Clients" },
	{ href: "/ca/itr-tax", icon: FileText, label: "ITR Filing" },
	{ href: "/ca/capital-gains", icon: TrendingUp, label: "Harvesting" },
	{ href: "/ca/profile", icon: User, label: "Profile" },
];

export function MobileBottomNav() {
	const [location] = useLocation();
	const { isAuthenticated } = useAuth();
	const { totalItems } = useCart();
	const { isPartnerPortal, isCaPortal } = useSubdomain();

	const isPartnerMode =
		isPartnerPortal ||
		location.startsWith("/agent") ||
		location.startsWith("/partner");

	const isCaMode = isCaPortal || location.startsWith("/ca");

	const activeNavItems = isPartnerMode
		? PARTNER_NAV_ITEMS
		: isCaMode
			? CA_NAV_ITEMS
			: INVESTOR_NAV_ITEMS;

	const cartItemCount = totalItems;

	return (
		<>
			{/* Floating Quick-Action Basket / Cart Pill for Investor */}
			{!isPartnerMode && !isCaMode && cartItemCount > 0 && location !== "/unified-cart" && (
				<div className="fixed bottom-20 left-3 right-3 z-50 md:hidden animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-md mx-auto">
					<Link href="/unified-cart">
						<div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-primary to-purple-600 text-white shadow-xl shadow-primary/25 border border-white/20 active:scale-98 transition-transform cursor-pointer">
							<div className="flex items-center gap-2">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold font-mono">
									{cartItemCount}
								</span>
								<span className="text-xs font-semibold tracking-tight">
									{cartItemCount === 1 ? "1 Item / Leg Staged" : `${cartItemCount} Orders Staged in Basket`}
								</span>
							</div>
							<div className="flex items-center gap-1 text-xs font-bold">
								<span>Review & Place</span>
								<ArrowRight className="h-3.5 w-3.5" />
							</div>
						</div>
					</Link>
				</div>
			)}

			{/* Floating Quick-Action Pill for Partner Distribution Basket */}
			{isPartnerMode && cartItemCount > 0 && location !== "/agent/store" && (
				<div className="fixed bottom-20 left-3 right-3 z-50 md:hidden animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-md mx-auto">
					<Link href="/agent/store">
						<div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xl shadow-blue-600/30 border border-white/20 active:scale-98 transition-transform cursor-pointer">
							<div className="flex items-center gap-2">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold font-mono">
									{cartItemCount}
								</span>
								<span className="text-xs font-semibold tracking-tight">
									{cartItemCount === 1 ? "1 Product Staged" : `${cartItemCount} Products in Proposal Basket`}
								</span>
							</div>
							<div className="flex items-center gap-1 text-xs font-bold">
								<span>Package Proposal</span>
								<ArrowRight className="h-3.5 w-3.5" />
							</div>
						</div>
					</Link>
				</div>
			)}

			<nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom">
				<div className="flex items-center justify-around h-16 px-2">
					{activeNavItems.map((item) => {
						const isActive =
							item.href === "/" || item.href === "/agent/dashboard" || item.href === "/ca/dashboard"
								? location === item.href
								: location.startsWith(item.href);

						const Icon = item.icon;

						if (item.href === "/profile" && !isAuthenticated) {
							return (
								<Link key={item.href} href="/auth">
									<div className="flex flex-col items-center justify-center min-w-[60px] py-1 cursor-pointer">
										<Icon className="h-5 w-5 transition-colors text-muted-foreground" />
										<span className="text-[10px] mt-1 transition-colors text-muted-foreground">
											Login
										</span>
									</div>
								</Link>
							);
						}

						return (
							<Link key={item.href} href={item.href}>
								<div className="relative flex flex-col items-center justify-center min-w-[48px] py-1 cursor-pointer">
									<div className="relative">
										<Icon
											className={cn(
												"h-5 w-5 transition-colors",
												isActive ? "text-primary" : "text-muted-foreground",
											)}
										/>
										{item.highlightDot && !isActive && (
											<span className="absolute -top-1 -right-1 flex h-2 w-2">
												<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
												<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
											</span>
										)}
										{item.badgeText && (
											<Badge
												className="absolute -top-2 -right-3 h-3 px-1 py-0 text-[8px] bg-blue-600 text-white font-bold leading-none border-0"
											>
												{item.badgeText}
											</Badge>
										)}
										{item.showBadge && cartItemCount > 0 && (
											<Badge
												variant="destructive"
												className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
											>
												{cartItemCount > 9 ? "9+" : cartItemCount}
											</Badge>
										)}
									</div>
									<span
										className={cn(
											"text-[10px] mt-1 transition-colors",
											isActive
												? "text-primary font-medium"
												: "text-muted-foreground",
										)}
									>
										{item.label}
									</span>
								</div>
							</Link>
						);
					})}
				</div>
			</nav>
		</>
	);
}
