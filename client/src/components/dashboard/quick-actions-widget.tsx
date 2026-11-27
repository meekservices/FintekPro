import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
	TrendingUp,
	ShieldCheck,
	Zap,
	Activity,
	Layers,
	ArrowUpRight,
	Terminal,
	Scale,
	Building,
	type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface QuickAction {
	name: string;
	href: string;
	icon: LucideIcon;
	badge: string;
	shortcut: string;
	description: string;
	accentClass: string;
}

export function QuickActionsWidget() {
	const { isAuthenticated } = useAuth();

	const guestActions: QuickAction[] = [
		{
			name: "Entity Onboarding",
			href: "/auth",
			icon: Building,
			badge: "SEBI Registered",
			shortcut: "⌘O",
			description: "Family Office & Corporate setup",
			accentClass: "text-blue-600 dark:text-blue-400",
		},
		{
			name: "Direct Fund Desk",
			href: "/mutual-funds",
			icon: TrendingUp,
			badge: "AMFI Cleared",
			shortcut: "⌘M",
			description: "Zero-commission institutional funds",
			accentClass: "text-emerald-600 dark:text-emerald-400",
		},
		{
			name: "Fixed Income Desk",
			href: "/bonds",
			icon: Layers,
			badge: "CCIL Direct",
			shortcut: "⌘B",
			description: "Sovereign G-Secs, SDLs & AAA debt",
			accentClass: "text-indigo-600 dark:text-indigo-400",
		},
		{
			name: "FASP-AI Analytics",
			href: "/wealth-management",
			icon: Zap,
			badge: "Quantitative",
			shortcut: "⌘A",
			description: "Decision Support & Factor Engine",
			accentClass: "text-amber-600 dark:text-amber-400",
		},
		{
			name: "Market Surveillance",
			href: "/markets",
			icon: Activity,
			badge: "<350ms Feed",
			shortcut: "⌘S",
			description: "Tick-by-tick NSE/BSE streams",
			accentClass: "text-cyan-600 dark:text-cyan-400",
		},
	];

	const authenticatedActions: QuickAction[] = [
		{
			name: "Order Execution Desk",
			href: "/unified-cart",
			icon: Terminal,
			badge: "STP Active",
			shortcut: "⌘T",
			description: "Direct Market Access (NSE/BSE)",
			accentClass: "text-blue-600 dark:text-blue-400",
		},
		{
			name: "Sovereign & AAA Debt",
			href: "/bonds",
			icon: Layers,
			badge: "CCIL Cleared",
			shortcut: "⌘B",
			description: "Primary G-Secs, SDLs & CP",
			accentClass: "text-indigo-600 dark:text-indigo-400",
		},
		{
			name: "Portfolio X-Ray",
			href: "/tools/portfolio-xray",
			icon: Activity,
			badge: "FASP-AI v1.0",
			shortcut: "⌘X",
			description: "Factor drift & Value-at-Risk",
			accentClass: "text-emerald-600 dark:text-emerald-400",
		},
		{
			name: "Tax-Loss Harvesting",
			href: "/tax-loss-harvesting",
			icon: Scale,
			badge: "Q4 FY26 Offsets",
			shortcut: "⌘H",
			description: "Capital gains loss matching",
			accentClass: "text-amber-600 dark:text-amber-400",
		},
		{
			name: "Depository & Custody",
			href: "/kyc-dashboard",
			icon: ShieldCheck,
			badge: "Tier-1 Clear",
			shortcut: "⌘D",
			description: "CDSL / NSDL Demat central",
			accentClass: "text-purple-600 dark:text-purple-400",
		},
	];

	const actions = isAuthenticated ? authenticatedActions : guestActions;

	return (
		<Card
			className="border border-border/70 bg-card/80 backdrop-blur-sm shadow-sm"
			data-testid="quick-actions-widget"
		>
			<CardHeader className="pb-3 border-b border-border/40">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
						<Terminal className="h-4 w-4 text-primary" />
						Institutional Operations & Execution Gateway
						<Badge
							variant="outline"
							className="text-[10px] font-mono border-primary/30 text-primary py-0 px-1.5"
						>
							STP Direct
						</Badge>
					</CardTitle>
					<div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
						<span className="flex items-center gap-1.5">
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
							NSE / BSE DMA
						</span>
						<span>•</span>
						<span className="text-[11px] text-muted-foreground/80">
							Latency: &lt;350ms
						</span>
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-4">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
					{actions.map((action) => {
						const Icon = action.icon;
						return (
							<Link key={action.name} href={action.href}>
								<div
									className="group relative flex flex-col justify-between p-3.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/60 hover:border-primary/40 transition-all duration-200 text-left cursor-pointer h-full"
									data-testid={`quick-action-${action.name.toLowerCase().replace(/\s+/g, "-")}`}
								>
									<div>
										<div className="flex items-center justify-between mb-2">
											<div
												className={`p-1.5 rounded-md bg-background border border-border/60 ${action.accentClass}`}
											>
												<Icon className="h-4 w-4" />
											</div>
											<kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-background/80 border border-border/70 rounded shadow-xs">
												{action.shortcut}
											</kbd>
										</div>
										<div className="flex items-center justify-between">
											<h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
												{action.name}
											</h4>
											<ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
										</div>
										<p className="text-xs text-muted-foreground mt-1 line-clamp-1">
											{action.description}
										</p>
									</div>

									<div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[10px] font-mono">
										<span className="text-muted-foreground flex items-center gap-1">
											<span className="w-1 h-1 rounded-full bg-emerald-500" />
											{action.badge}
										</span>
										<span className="text-muted-foreground/60 group-hover:text-primary transition-colors">
											Execute →
										</span>
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
