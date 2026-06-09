import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Home,
	Calculator,
	FileText,
	TrendingUp,
	Building2,
	MapPin,
	CreditCard,
	Shield as LucideShield,
	DollarSign,
	Banknote,
	PieChart,
	Target,
	ChevronRight,
	InfoIcon,
	ExternalLink,
	CheckCircle,
	Clock,
	BarChart3,
} from "lucide-react";
import { Link } from "wouter";

interface PropertyService {
	id: string;
	name: string;
	description: string;
	icon: any;
	category: string;
	href: string;
	status: "available" | "coming_soon" | "beta";
	features?: string[];
	providers?: string[];
}

interface PropertyCalculation {
	id: string;
	type: "emi" | "eligibility" | "valuation" | "roi";
	title: string;
	description: string;
	result?: any;
	isCalculating?: boolean;
}

export default function PropertyServices() {
	const [activeTab, setActiveTab] = useState("overview");
	const [calculations, setCalculations] = useState<PropertyCalculation[]>([]);

	// Fetch property service overview
	const { data: serviceOverview, isLoading } = useQuery({
		queryKey: ["/api/property/overview"],
		enabled: true,
	});

	const propertyServices: PropertyService[] = [
		// Financing Services
		{
			id: "home-loans",
			name: "🏠 Home Loans",
			description: "Compare home loan offers from multiple banks and NBFCs",
			icon: Home,
			category: "financing",
			href: "/loans?category=home",
			status: "available",
			features: [
				"Interest rates from 8.5%",
				"Loan up to ₹10 Cr",
				"Quick approval",
			],
			providers: ["ICICI", "HDFC", "SBI", "Bajaj Finance", "Tata Capital"],
		},
		{
			id: "lap",
			name: "🏢 Loan Against Property",
			description: "Leverage your property for business or personal needs",
			icon: Building2,
			category: "financing",
			href: "/loans?category=lap",
			status: "available",
			features: [
				"Loan up to 70% of property value",
				"Flexible tenure",
				"Lower interest rates",
			],
			providers: ["Tata Capital", "HDFC", "ICICI"],
		},

		// Investment Services
		{
			id: "reits",
			name: "🏗️ Real Estate Investment Trusts",
			description: "Invest in commercial real estate through REITs",
			icon: TrendingUp,
			category: "investment",
			href: "/investments/reits",
			status: "coming_soon",
			features: [
				"Professional management",
				"Regular dividends",
				"High liquidity",
			],
		},
		{
			id: "property-funds",
			name: "🏘️ Property Investment Funds",
			description: "Diversified real estate mutual funds and portfolios",
			icon: PieChart,
			category: "investment",
			href: "/mutual-funds?category=realty",
			status: "beta",
			features: [
				"Diversified exposure",
				"Professional management",
				"Lower entry amount",
			],
		},

		// Documentation & Legal
		{
			id: "property-docs",
			name: "📋 Property Documentation",
			description: "Document verification, registry, and legal support",
			icon: FileText,
			category: "documentation",
			href: "/property/documents",
			status: "coming_soon",
			features: [
				"Title verification",
				"Registry assistance",
				"Legal clearance",
			],
		},
		{
			id: "valuation",
			name: "💰 Property Valuation",
			description: "Professional property valuation and market analysis",
			icon: DollarSign,
			category: "documentation",
			href: "/property/valuation",
			status: "coming_soon",
			features: [
				"Certified valuers",
				"Market analysis",
				"Bank-approved reports",
			],
		},

		// Insurance & Protection
		{
			id: "home-insurance",
			name: "🛡️ Home Insurance",
			description: "Comprehensive home and property insurance coverage",
			icon: LucideShield,
			category: "protection",
			href: "/insurance/home",
			status: "available",
			features: [
				"Structure + contents",
				"Natural disasters",
				"Theft protection",
			],
			providers: ["ICICI Lombard", "HDFC ERGO", "Bajaj Allianz"],
		},

		// Calculators & Tools
		{
			id: "property-calculators",
			name: "🧮 Property Calculators",
			description: "EMI, eligibility, and property investment calculators",
			icon: Calculator,
			category: "tools",
			href: "/calculators?category=property",
			status: "available",
			features: ["EMI calculator", "Eligibility checker", "ROI calculator"],
		},
	];

	const categories = [
		{
			id: "financing",
			name: "🏦 Financing",
			description: "Loans and credit solutions",
		},
		{
			id: "investment",
			name: "📈 Investment",
			description: "Real estate investment options",
		},
		{
			id: "documentation",
			name: "📄 Documentation",
			description: "Legal and paperwork support",
		},
		{
			id: "protection",
			name: "🛡️ Protection",
			description: "Insurance and security",
		},
		{ id: "tools", name: "🔧 Tools", description: "Calculators and analysis" },
	];

	const renderServiceCard = (service: PropertyService) => (
		<Card
			key={service.id}
			className="group hover:shadow-lg transition-all duration-200 cursor-pointer"
			data-testid={`card-property-service-${service.id}`}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
							<service.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
						</div>
						<div>
							<CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
								{service.name}
							</CardTitle>
							<CardDescription className="text-sm mt-1">
								{service.description}
							</CardDescription>
						</div>
					</div>
					<Badge
						variant={
							service.status === "available"
								? "default"
								: service.status === "beta"
									? "secondary"
									: "outline"
						}
						className="text-xs"
					>
						{service.status === "available"
							? "Available"
							: service.status === "beta"
								? "Beta"
								: "Coming Soon"}
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				{service.features && (
					<div className="space-y-2 mb-4">
						{service.features.slice(0, 3).map((feature, index) => (
							<div
								key={index}
								className="flex items-center gap-2 text-sm text-muted-foreground"
							>
								<CheckCircle className="h-3 w-3 text-green-500" />
								{feature}
							</div>
						))}
					</div>
				)}

				{service.providers && (
					<div className="mb-4">
						<p className="text-xs text-muted-foreground mb-2">
							Available from:
						</p>
						<div className="flex flex-wrap gap-1">
							{service.providers.slice(0, 3).map((provider, index) => (
								<Badge key={index} variant="outline" className="text-xs">
									{provider}
								</Badge>
							))}
							{service.providers.length > 3 && (
								<Badge variant="outline" className="text-xs">
									+{service.providers.length - 3} more
								</Badge>
							)}
						</div>
					</div>
				)}

				<div className="flex items-center justify-between">
					<Link href={service.href}>
						<Button
							variant={service.status === "available" ? "default" : "outline"}
							size="sm"
							disabled={service.status === "coming_soon"}
							className="group-hover:shadow-sm transition-shadow"
							data-testid={`button-access-${service.id}`}
						>
							{service.status === "available"
								? "Access Now"
								: service.status === "beta"
									? "Try Beta"
									: "Notify Me"}
							<ChevronRight className="h-3 w-3 ml-1" />
						</Button>
					</Link>

					{service.status === "available" && (
						<Link href={service.href}>
							<Button
								variant="ghost"
								size="sm"
								data-testid={`button-learn-more-${service.id}`}
							>
								<ExternalLink className="h-3 w-3" />
							</Button>
						</Link>
					)}
				</div>
			</CardContent>
		</Card>
	);

	if (isLoading) {
		return (
			<div className="container mx-auto py-8 px-4">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{[...Array(6)].map((_, i) => (
						<Card key={i} className="animate-pulse">
							<CardHeader>
								<div className="h-4 bg-muted rounded w-3/4" />
								<div className="h-3 bg-muted rounded w-1/2" />
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="h-3 bg-muted rounded" />
									<div className="h-3 bg-muted rounded w-2/3" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	return (
		<div
			className="container mx-auto py-8 px-4"
			data-testid="page-property-services"
		>
			{/* Header */}
			<div className="mb-8">
				<div className="flex items-center gap-3 mb-4">
					<div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
						<Home className="h-6 w-6 text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<h1
							className="text-3xl font-bold text-foreground"
							data-testid="heading-property-services"
						>
							Property Services Hub
						</h1>
						<p className="text-muted-foreground mt-1">
							Complete real estate solutions from financing to investment
						</p>
					</div>
				</div>

				<Alert className="mb-6">
					<InfoIcon className="h-4 w-4" />
					<AlertDescription>
						<strong>Intelligent Property Workflow:</strong> Start with
						financing, secure your property, protect with insurance, then
						explore investment opportunities. Our unified platform guides you
						through every step.
					</AlertDescription>
				</Alert>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-6"
			>
				<ScrollableTabsList
					className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-6"
					data-testid="tabs-property-services"
				>
					<TabsTrigger value="overview" className="text-sm">
						Overview
					</TabsTrigger>
					<TabsTrigger value="financing" className="text-sm">
						Financing
					</TabsTrigger>
					<TabsTrigger value="investment" className="text-sm">
						Investment
					</TabsTrigger>
					<TabsTrigger value="documentation" className="text-sm">
						Documentation
					</TabsTrigger>
					<TabsTrigger value="protection" className="text-sm">
						Protection
					</TabsTrigger>
					<TabsTrigger value="tools" className="text-sm">
						Tools
					</TabsTrigger>
				</ScrollableTabsList>

				{/* Overview Tab */}
				<TabsContent
					value="overview"
					className="space-y-6"
					data-testid="tab-overview"
				>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
						{categories.map((category) => {
							const categoryServices = propertyServices.filter(
								(s) => s.category === category.id,
							);
							const availableCount = categoryServices.filter(
								(s) => s.status === "available",
							).length;

							return (
								<Card
									key={category.id}
									className="text-center hover:shadow-md transition-shadow cursor-pointer"
									onClick={() => setActiveTab(category.id)}
									data-testid={`card-category-${category.id}`}
								>
									<CardContent className="pt-6">
										<div className="text-2xl mb-2">
											{category.name.split(" ")[0]}
										</div>
										<h3 className="font-semibold text-sm mb-1">
											{category.name.split(" ").slice(1).join(" ")}
										</h3>
										<p className="text-xs text-muted-foreground mb-3">
											{category.description}
										</p>
										<div className="flex justify-center items-center gap-2">
											<Badge variant="outline" className="text-xs">
												{availableCount}/{categoryServices.length} ready
											</Badge>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>

					{/* Quick Actions */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
						<Card
							className="border-blue-200 bg-blue-50 dark:bg-blue-900/10"
							data-testid="card-quick-home-loan"
						>
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
									<Home className="h-5 w-5" />
									Quick Home Loan
								</CardTitle>
								<CardDescription>Get pre-approved in minutes</CardDescription>
							</CardHeader>
							<CardContent>
								<Link href="/loans?category=home">
									<Button
										className="w-full"
										data-testid="button-quick-home-loan"
									>
										Check Eligibility <ChevronRight className="h-4 w-4 ml-1" />
									</Button>
								</Link>
							</CardContent>
						</Card>

						<Card
							className="border-green-200 bg-green-50 dark:bg-green-900/10"
							data-testid="card-property-valuation"
						>
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
									<DollarSign className="h-5 w-5" />
									Property Valuation
								</CardTitle>
								<CardDescription>Know your property's worth</CardDescription>
							</CardHeader>
							<CardContent>
								<Button
									variant="outline"
									className="w-full"
									data-testid="button-property-valuation"
								>
									Get Valuation <Clock className="h-4 w-4 ml-1" />
								</Button>
							</CardContent>
						</Card>

						<Card
							className="border-purple-200 bg-purple-50 dark:bg-purple-900/10"
							data-testid="card-reits-investment"
						>
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
									<TrendingUp className="h-5 w-5" />
									REIT Investment
								</CardTitle>
								<CardDescription>Start with ₹100</CardDescription>
							</CardHeader>
							<CardContent>
								<Button
									variant="outline"
									className="w-full"
									disabled
									data-testid="button-reit-investment"
								>
									Coming Soon <Target className="h-4 w-4 ml-1" />
								</Button>
							</CardContent>
						</Card>
					</div>

					{/* All Services Grid */}
					<div>
						<h2
							className="text-xl font-semibold mb-4"
							data-testid="heading-all-services"
						>
							All Property Services
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{propertyServices.map(renderServiceCard)}
						</div>
					</div>
				</TabsContent>

				{/* Category-specific tabs */}
				{categories.map((category) => (
					<TabsContent
						key={category.id}
						value={category.id}
						className="space-y-6"
						data-testid={`tab-${category.id}`}
					>
						<div className="mb-6">
							<h2 className="text-2xl font-bold mb-2">{category.name}</h2>
							<p className="text-muted-foreground">{category.description}</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{propertyServices
								.filter((service) => service.category === category.id)
								.map(renderServiceCard)}
						</div>
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
