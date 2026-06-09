import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	TrendingUp,
	PieChart,
	LineChart,
	Brain,
	FileText,
	DollarSign,
	Shield as ShieldIcon,
	HelpCircle,
	Store,
	ShoppingCart,
	Settings,
	Users,
} from "lucide-react";

interface NavItem {
	name: string;
	href: string;
	icon?: React.ComponentType<{ className?: string }>;
	tone?: "default" | "admin" | "store" | "cart";
	badge?: number;
}

interface MobileNavCardsProps {
	items: NavItem[];
	onNavigate: () => void;
	isAuthenticated: boolean;
	cartCount?: number;
	isAdmin?: boolean;
}

const getIconForNavItem = (name: string) => {
	const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
		Markets: TrendingUp,
		Portfolio: PieChart,
		Broking: LineChart,
		InvestSmart: Brain,
		Proposals: FileText,
		Loans: DollarSign,
		Insurance: ShieldIcon,
		Support: HelpCircle,
		Store: Store,
		"Product Store": Store,
		Cart: ShoppingCart,
		"Admin Panel": Settings,
		"Supplier Management": Users,
	};

	return iconMap[name] || FileText;
};

const getCardStyles = (tone: string, isActive: boolean) => {
	const baseStyles =
		"h-20 transition-all duration-200 hover:shadow-md border-2 focus-within:ring-2 focus-within:ring-offset-2";

	if (isActive) {
		switch (tone) {
			case "admin":
				return `${baseStyles} border-red-500 bg-red-50 dark:bg-red-900/20 focus-within:ring-red-500`;
			case "store":
				return `${baseStyles} border-green-500 bg-green-50 dark:bg-green-900/20 focus-within:ring-green-500`;
			case "cart":
				return `${baseStyles} border-blue-500 bg-blue-50 dark:bg-blue-900/20 focus-within:ring-blue-500`;
			default:
				return `${baseStyles} border-finance-blue bg-blue-50 dark:bg-blue-900/20 focus-within:ring-blue-500`;
		}
	}

	return `${baseStyles} border-border hover:border-border dark:hover:border-border focus-within:ring-ring`;
};

const getIconStyles = (tone: string, isActive: boolean) => {
	if (isActive) {
		switch (tone) {
			case "admin":
				return "text-red-600 dark:text-red-400";
			case "store":
				return "text-green-600 dark:text-green-400";
			case "cart":
				return "text-blue-600 dark:text-blue-400";
			default:
				return "text-finance-blue dark:text-blue-400";
		}
	}

	return "text-muted-foreground";
};

const getTextStyles = (tone: string, isActive: boolean) => {
	if (isActive) {
		switch (tone) {
			case "admin":
				return "text-red-700 dark:text-red-300";
			case "store":
				return "text-green-700 dark:text-green-300";
			case "cart":
				return "text-blue-700 dark:text-blue-300";
			default:
				return "text-finance-blue dark:text-blue-300";
		}
	}

	return "text-foreground";
};

export function MobileNavCards({
	items,
	onNavigate,
	isAuthenticated,
	cartCount,
	isAdmin,
}: MobileNavCardsProps) {
	const [location] = useLocation();

	return (
		<nav aria-label="Primary navigation" className="w-full">
			<ul className="grid grid-cols-2 gap-3 p-1">
				{items.map((item) => {
					const Icon = item.icon || getIconForNavItem(item.name);
					const isActive = location === item.href;
					const tone = item.tone || "default";

					return (
						<li key={item.name} role="listitem">
							<Link
								href={item.href}
								onClick={onNavigate}
								className="block focus:outline-none"
								data-testid={`link-nav-${item.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
							>
								<Card
									className={getCardStyles(tone, isActive)}
									data-testid={`card-nav-${item.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
									aria-current={isActive ? "page" : undefined}
								>
									<CardContent className="flex flex-col items-center justify-center h-full p-3 relative">
										<Icon
											className={`h-6 w-6 mb-2 ${getIconStyles(tone, isActive)}`}
											aria-hidden="true"
										/>
										<span
											className={`text-sm font-medium text-center leading-tight ${getTextStyles(tone, isActive)}`}
										>
											{item.name}
										</span>

										{/* Badge for cart count */}
										{item.name === "Cart" && item.badge && item.badge > 0 && (
											<Badge
												className="absolute -top-2 -right-2 bg-red-500 text-white text-xs h-5 w-5 flex items-center justify-center p-0 rounded-full"
												aria-label={`${item.badge} items in cart`}
											>
												{item.badge}
											</Badge>
										)}
									</CardContent>
								</Card>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
