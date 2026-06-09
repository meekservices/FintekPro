import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
	PlusCircle,
	TrendingUp,
	FileText,
	Calculator,
	Shield as LucideShield,
	Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface QuickAction {
	name: string;
	href: string;
	icon: any;
	color: string;
	bgColor: string;
	description: string;
}

export function QuickActionsWidget() {
	const { isAuthenticated, user } = useAuth();

	const guestActions: QuickAction[] = [
		{
			name: "Start Investing",
			href: "/auth",
			icon: TrendingUp,
			color: "text-blue-600",
			bgColor: "bg-blue-50 dark:bg-blue-950",
			description: "Begin your investment journey",
		},
		{
			name: "Explore Funds",
			href: "/mutual-funds",
			icon: PlusCircle,
			color: "text-green-600",
			bgColor: "bg-green-50 dark:bg-green-950",
			description: "Browse mutual funds",
		},
		{
			name: "Calculators",
			href: "/calculators",
			icon: Calculator,
			color: "text-purple-600",
			bgColor: "bg-purple-50 dark:bg-purple-950",
			description: "Plan your finances",
		},
	];

	const authenticatedActions: QuickAction[] = [
		{
			name: "Add Investment",
			href: "/mutual-funds",
			icon: PlusCircle,
			color: "text-green-600",
			bgColor: "bg-green-50 dark:bg-green-950",
			description: "Invest in funds",
		},
		{
			name: "View Portfolio",
			href: "/portfolio",
			icon: TrendingUp,
			color: "text-blue-600",
			bgColor: "bg-blue-50 dark:bg-blue-950",
			description: "Check holdings",
		},
		{
			name: "Tax Reports",
			href: "/capital-gains",
			icon: FileText,
			color: "text-amber-600",
			bgColor: "bg-amber-50 dark:bg-amber-950",
			description: "Generate reports",
		},
		{
			name: "Calculators",
			href: "/calculators",
			icon: Calculator,
			color: "text-purple-600",
			bgColor: "bg-purple-50 dark:bg-purple-950",
			description: "Plan finances",
		},
		{
			name: "KYC Status",
			href: "/kyc-dashboard",
			icon: LucideShield,
			color: "text-indigo-600",
			bgColor: "bg-indigo-50 dark:bg-indigo-950",
			description: "Verify identity",
		},
	];

	const actions = isAuthenticated ? authenticatedActions : guestActions;

	return (
		<Card
			className="border-0 shadow-lg bg-gradient-to-br from-background to-muted"
			data-testid="quick-actions-widget"
		>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-lg">
					<Zap className="h-5 w-5 text-yellow-500" />
					Quick Actions
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
					{actions.map((action) => (
						<Link key={action.name} href={action.href}>
							<Button
								variant="ghost"
								className={`h-auto w-full flex-col py-4 px-3 ${action.bgColor} hover:opacity-80 transition-all duration-200`}
								data-testid={`quick-action-${action.name.toLowerCase().replace(/\s+/g, "-")}`}
							>
								<action.icon className={`h-6 w-6 mb-2 ${action.color}`} />
								<span className={`text-sm font-medium ${action.color}`}>
									{action.name}
								</span>
								<span className="text-xs text-muted-foreground mt-1 line-clamp-1">
									{action.description}
								</span>
							</Button>
						</Link>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
