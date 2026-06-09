import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
	FileText,
	Calculator,
	Users,
	Clock,
	CheckCircle,
	AlertTriangle,
	TrendingUp,
	Shield as LucideShield,
	Receipt,
	Building2,
	CreditCard,
	Phone,
	Mail,
	Calendar,
	Star,
	Award,
	Target,
	Zap,
	ChevronRight,
	BookOpen,
	DollarSign,
	PieChart,
	BarChart3,
	Download,
	Upload,
	Send,
	Eye,
	Edit,
	Save,
	ArrowRight,
	Info,
} from "lucide-react";

interface TaxService {
	id: string;
	title: string;
	description: string;
	category: string;
	features: string[];
	price: number;
	originalPrice?: number;
	processingTime: string;
	rating: number;
	isPopular?: boolean;
	isPremium?: boolean;
	icon: any;
	benefits: string[];
	documents: string[];
}

interface ITRForm {
	id: string;
	name: string;
	description: string;
	applicableFor: string[];
	complexity: "Simple" | "Moderate" | "Complex";
	estimatedTime: string;
	price: number;
	features: string[];
}

interface TaxPlanning {
	id: string;
	title: string;
	description: string;
	potentialSavings: string;
	category: string;
	icon: any;
	details: string[];
}

// ITR Forms
const itrForms: ITRForm[] = [
	{
		id: "itr1",
		name: "ITR-1 (Sahaj)",
		description:
			"For individuals having income from salary, one house property, and other sources",
		applicableFor: [
			"Salaried Employees",
			"Pensioners",
			"Single House Property",
		],
		complexity: "Simple",
		estimatedTime: "15-30 minutes",
		price: 999,
		features: [
			"Auto-filled data",
			"E-verification",
			"Quick refund",
			"Expert review",
		],
	},
	{
		id: "itr2",
		name: "ITR-2",
		description:
			"For individuals with income from capital gains, multiple properties, foreign assets",
		applicableFor: [
			"Multiple Properties",
			"Capital Gains",
			"Foreign Income",
			"Director of Companies",
		],
		complexity: "Moderate",
		estimatedTime: "45-90 minutes",
		price: 1499,
		features: [
			"Capital gains computation",
			"Foreign income reporting",
			"Schedule AL filing",
			"CA assistance",
		],
	},
	{
		id: "itr3",
		name: "ITR-3",
		description: "For individuals with business or professional income",
		applicableFor: [
			"Business Income",
			"Professional Income",
			"Partnership Firms",
			"LLP Partners",
		],
		complexity: "Complex",
		estimatedTime: "2-4 hours",
		price: 2999,
		features: [
			"P&L preparation",
			"Balance sheet",
			"Tax audit support",
			"Dedicated CA",
		],
	},
	{
		id: "itr4",
		name: "ITR-4 (Sugam)",
		description: "For presumptive income from business and profession",
		applicableFor: [
			"Small Business",
			"Presumptive Taxation",
			"Freelancers",
			"Consultants",
		],
		complexity: "Simple",
		estimatedTime: "30-45 minutes",
		price: 1299,
		features: [
			"Presumptive scheme",
			"Simple calculation",
			"Quick filing",
			"Expert guidance",
		],
	},
	{
		id: "itr5",
		name: "ITR-5",
		description: "For partnership firms, LLPs, AOPs, and BOIs",
		applicableFor: [
			"Partnership Firms",
			"LLPs",
			"AOP/BOI",
			"Co-operative Societies",
		],
		complexity: "Complex",
		estimatedTime: "4-6 hours",
		price: 5499,
		features: [
			"Partnership taxation",
			"Book profit calculation",
			"MAT computation",
			"Senior CA review",
		],
	},
	{
		id: "itr6",
		name: "ITR-6",
		description: "For companies other than claiming exemption under section 11",
		applicableFor: [
			"Private Companies",
			"Public Companies",
			"Foreign Companies",
		],
		complexity: "Complex",
		estimatedTime: "6-8 hours",
		price: 10499,
		features: [
			"Corporate taxation",
			"MAT/AMT calculation",
			"Transfer pricing",
			"Compliance check",
		],
	},
	{
		id: "itr7",
		name: "ITR-7",
		description:
			"For trusts, political parties, institutions, and other entities",
		applicableFor: [
			"Trusts",
			"Political Parties",
			"Institutions",
			"Universities",
		],
		complexity: "Complex",
		estimatedTime: "4-6 hours",
		price: 7999,
		features: [
			"Trust taxation",
			"Exemption claims",
			"Compliance reporting",
			"Legal review",
		],
	},
];

// Tax Services
const taxServices: TaxService[] = [
	// Tax Filing Services
	{
		id: "basic-filing",
		title: "Basic Tax Filing",
		description:
			"Simple tax filing for salaried individuals with standard deductions",
		category: "Filing",
		features: [
			"ITR-1 Filing",
			"Form 16 Upload",
			"Quick Refund",
			"E-verification",
		],
		price: 999,
		originalPrice: 1499,
		processingTime: "24 hours",
		rating: 4.6,
		isPopular: true,
		icon: FileText,
		benefits: [
			"Hassle-free filing",
			"Maximum refund",
			"Expert review",
			"Income tax notice support",
		],
		documents: ["Form 16", "Bank Statement", "Investment Proofs", "PAN Card"],
	},
	{
		id: "comprehensive-filing",
		title: "Comprehensive Tax Filing",
		description:
			"Complete tax filing for complex income sources and investments",
		category: "Filing",
		features: [
			"All ITR Forms",
			"Capital Gains",
			"Multiple Incomes",
			"Dedicated CA",
		],
		price: 2999,
		processingTime: "2-3 business days",
		rating: 4.8,
		isPremium: true,
		icon: Receipt,
		benefits: [
			"Complete tax optimization",
			"All income sources",
			"Capital gains planning",
			"Year-round support",
		],
		documents: [
			"All Income Documents",
			"Investment Statements",
			"Property Documents",
			"Foreign Asset Details",
		],
	},

	// Tax Planning Services
	{
		id: "tax-planning",
		title: "Annual Tax Planning",
		description:
			"Comprehensive tax planning to minimize your tax liability legally",
		category: "Planning",
		features: [
			"Investment Planning",
			"Tax-saving Instruments",
			"Retirement Planning",
			"Regular Reviews",
		],
		price: 4999,
		processingTime: "5-7 business days",
		rating: 4.9,
		isPremium: true,
		icon: Calculator,
		benefits: [
			"30-40% tax savings",
			"Customized strategy",
			"Regular monitoring",
			"Investment guidance",
		],
		documents: [
			"Salary Slips",
			"Investment Portfolio",
			"Insurance Policies",
			"Previous ITRs",
		],
	},
	{
		id: "ca-consultation",
		title: "CA Consultation",
		description:
			"One-on-one consultation with experienced Chartered Accountants",
		category: "Consultation",
		features: [
			"Personal Meeting",
			"Expert Advice",
			"Document Review",
			"Follow-up Support",
		],
		price: 1999,
		processingTime: "Same day",
		rating: 4.7,
		isPopular: true,
		icon: Users,
		benefits: [
			"Expert guidance",
			"Personalized advice",
			"Complex queries resolution",
			"Ongoing support",
		],
		documents: ["Relevant Documents", "Query Details"],
	},

	// Compliance Services
	{
		id: "tds-filing",
		title: "TDS Return Filing",
		description: "Quarterly TDS return filing and compliance management",
		category: "Compliance",
		features: [
			"Quarterly Filing",
			"TDS Reconciliation",
			"Form 16A Generation",
			"Correction Returns",
		],
		price: 2499,
		processingTime: "3-5 business days",
		rating: 4.5,
		icon: Building2,
		benefits: [
			"Compliance assurance",
			"Penalty avoidance",
			"Timely filing",
			"Expert handling",
		],
		documents: ["TDS Certificates", "Salary Register", "Payment Receipts"],
	},
	{
		id: "gst-filing",
		title: "GST Return Filing",
		description: "Monthly GST return filing and input tax credit optimization",
		category: "Compliance",
		features: [
			"Monthly Filing",
			"ITC Optimization",
			"Reconciliation",
			"Notice Handling",
		],
		price: 1999,
		processingTime: "5-7 business days",
		rating: 4.4,
		icon: Receipt,
		benefits: [
			"GST compliance",
			"ITC maximization",
			"Penalty protection",
			"Regular updates",
		],
		documents: [
			"Sales Invoices",
			"Purchase Bills",
			"Bank Statements",
			"GSTR-2A",
		],
	},

	// Advisory Services
	{
		id: "tax-audit",
		title: "Tax Audit Services",
		description:
			"Statutory tax audit for businesses exceeding prescribed limits",
		category: "Audit",
		features: [
			"Statutory Audit",
			"Tax Audit Report",
			"Compliance Check",
			"Audit Defense",
		],
		price: 15999,
		processingTime: "15-20 business days",
		rating: 4.6,
		isPremium: true,
		icon: LucideShield,
		benefits: [
			"Statutory compliance",
			"Clean audit report",
			"Tax optimization",
			"Audit defense",
		],
		documents: [
			"Books of Accounts",
			"Financial Statements",
			"Supporting Documents",
		],
	},
	{
		id: "notice-handling",
		title: "Income Tax Notice Handling",
		description: "Expert handling of income tax notices and assessments",
		category: "Advisory",
		features: [
			"Notice Analysis",
			"Response Preparation",
			"Hearing Representation",
			"Appeal Filing",
		],
		price: 4999,
		processingTime: "7-10 business days",
		rating: 4.8,
		isPopular: true,
		icon: AlertTriangle,
		benefits: [
			"Expert representation",
			"Penalty minimization",
			"Quick resolution",
			"Legal protection",
		],
		documents: ["Tax Notice", "Previous ITRs", "Supporting Documents"],
	},
];

// Tax Planning Strategies
const taxPlanningStrategies: TaxPlanning[] = [
	{
		id: "80c-investments",
		title: "Section 80C Investments",
		description:
			"Maximize deductions up to ₹1.5 lakh through ELSS, PPF, and life insurance",
		potentialSavings: "₹46,800",
		category: "Deductions",
		icon: PieChart,
		details: [
			"ELSS Mutual Funds - ₹1.5L",
			"PPF Contribution - ₹1.5L",
			"Life Insurance Premium",
			"Home Loan Principal",
		],
	},
	{
		id: "medical-insurance",
		title: "Health Insurance Deductions",
		description:
			"Save taxes through health insurance premiums under Section 80D",
		potentialSavings: "₹31,200",
		category: "Deductions",
		icon: LucideShield,
		details: [
			"Self & Family - ₹25,000",
			"Parents - ₹25,000",
			"Senior Citizen Bonus - ₹50,000",
			"Preventive Health Checkup",
		],
	},
	{
		id: "home-loan-benefits",
		title: "Home Loan Tax Benefits",
		description:
			"Dual benefits from home loan interest and principal repayment",
		potentialSavings: "₹4,68,000",
		category: "Property",
		icon: Building2,
		details: [
			"Interest Deduction - ₹2L",
			"Principal Deduction - ₹1.5L",
			"First Home Buyer - ₹3.5L Interest",
		],
	},
	{
		id: "nps-contribution",
		title: "National Pension System",
		description: "Additional ₹50,000 deduction under Section 80CCD(1B)",
		potentialSavings: "₹15,600",
		category: "Retirement",
		icon: TrendingUp,
		details: [
			"Employee Contribution - 10% of Salary",
			"Additional NPS - ₹50,000",
			"Employer Contribution - 14%",
		],
	},
	{
		id: "education-loan",
		title: "Education Loan Interest",
		description:
			"Deduction for interest on education loan without any upper limit",
		potentialSavings: "Unlimited",
		category: "Education",
		icon: BookOpen,
		details: [
			"No Upper Limit",
			"For Self/Spouse/Children",
			"Higher Education Only",
			"8 Years Maximum",
		],
	},
	{
		id: "charitable-donations",
		title: "Charitable Donations",
		description: "Deductions for donations to eligible charitable institutions",
		potentialSavings: "100% of Donation",
		category: "Donations",
		icon: Award,
		details: [
			"80G Donations - 50% to 100%",
			"PM CARES - 100%",
			"Electoral Bonds",
			"Scientific Research",
		],
	},
];

export default function ITRTaxServices() {
	const [activeTab, setActiveTab] = useState("itr-forms");
	const [selectedCategory, setSelectedCategory] = useState("All");
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedITR, setSelectedITR] = useState<ITRForm | null>(null);
	const [selectedService, setSelectedService] = useState<TaxService | null>(
		null,
	);
	const [taxSavings, setTaxSavings] = useState(0);

	const { isAuthenticated, user } = useAuth();
	const { toast } = useToast();

	const categories = [
		"All",
		"Filing",
		"Planning",
		"Consultation",
		"Compliance",
		"Audit",
		"Advisory",
	];

	const filteredServices = taxServices.filter((service) => {
		const matchesCategory =
			selectedCategory === "All" || service.category === selectedCategory;
		const matchesSearch =
			service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
			service.description.toLowerCase().includes(searchTerm.toLowerCase());
		return matchesCategory && matchesSearch;
	});

	const handleServiceBooking = (service: TaxService) => {
		if (!isAuthenticated) {
			toast({
				title: "Login Required",
				description: "Please login to book tax services.",
			});
			return;
		}

		toast({
			title: "Service Booked",
			description: `Your ${service.title} service has been booked. Our CA will contact you soon.`,
		});
	};

	const calculateTaxSavings = () => {
		const total = taxPlanningStrategies.reduce((sum, strategy) => {
			if (strategy.potentialSavings.includes("₹")) {
				const amount = Number.parseInt(
					strategy.potentialSavings.replace(/[₹,]/g, ""),
				);
				return sum + amount;
			}
			return sum;
		}, 0);
		setTaxSavings(total);
	};

	useEffect(() => {
		calculateTaxSavings();
	}, []);

	return (
		<div className="container mx-auto px-4 py-8 space-y-8">
			{/* Hero Section */}
			<div className="relative bg-gradient-to-br from-green-600 via-blue-600 to-purple-600 rounded-3xl p-8 md:p-12 text-foreground overflow-hidden">
				<div className="absolute inset-0 bg-black/10" />
				<div className="relative z-10">
					<div className="flex items-center gap-3 mb-4">
						<div className="p-3 bg-card/10 backdrop-blur-sm rounded-xl">
							<FileText className="h-8 w-8" />
						</div>
						<Badge
							variant="secondary"
							className="bg-card/20 text-foreground border-white/30"
						>
							Tax Services
						</Badge>
					</div>

					<h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
						Complete ITR & Tax Services
					</h1>
					<p className="text-xl mb-8 text-blue-100 max-w-3xl leading-relaxed">
						Expert tax filing, planning, and compliance services with CA
						consultation. Maximize your savings and ensure complete compliance.
					</p>

					<div className="grid md:grid-cols-3 gap-6 mb-8">
						<div className="bg-card/10 backdrop-blur-sm rounded-xl p-4">
							<div className="text-3xl font-bold mb-1">
								₹{taxSavings.toLocaleString()}+
							</div>
							<div className="text-sm text-blue-100">Potential Tax Savings</div>
						</div>
						<div className="bg-card/10 backdrop-blur-sm rounded-xl p-4">
							<div className="text-3xl font-bold mb-1">24hrs</div>
							<div className="text-sm text-blue-100">Quick Filing Service</div>
						</div>
						<div className="bg-card/10 backdrop-blur-sm rounded-xl p-4">
							<div className="text-3xl font-bold mb-1">500+</div>
							<div className="text-sm text-blue-100">Expert CAs</div>
						</div>
					</div>

					<div className="flex flex-wrap gap-4">
						<Button
							size="lg"
							className="bg-card text-green-600 hover:bg-blue-50 dark:bg-blue-950/30"
							data-testid="button-file-itr"
						>
							File ITR Now
							<ArrowRight className="ml-2 h-5 w-5" />
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="border-white/30 text-foreground hover:bg-card/10"
							data-testid="button-ca-consultation"
						>
							<Users className="mr-2 h-5 w-5" />
							CA Consultation
						</Button>
					</div>
				</div>
			</div>

			{/* Main Content Tabs */}
			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-6"
			>
				<ScrollableTabsList className="grid grid-cols-4 w-full max-w-2xl mx-auto">
					<TabsTrigger value="itr-forms" data-testid="tab-itr-forms">
						ITR Forms
					</TabsTrigger>
					<TabsTrigger value="services" data-testid="tab-services">
						Tax Services
					</TabsTrigger>
					<TabsTrigger value="planning" data-testid="tab-planning">
						Tax Planning
					</TabsTrigger>
					<TabsTrigger value="compliance" data-testid="tab-compliance">
						Compliance
					</TabsTrigger>
				</ScrollableTabsList>

				{/* ITR Forms Tab */}
				<TabsContent value="itr-forms" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5 text-green-600" />
								Choose Your ITR Form
							</CardTitle>
							<p className="text-muted-foreground">
								Select the appropriate ITR form based on your income sources
							</p>
						</CardHeader>
						<CardContent>
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
								{itrForms.map((form) => (
									<Card
										key={form.id}
										className="relative border-2 hover:border-green-200 dark:border-green-800 transition-colors cursor-pointer"
									>
										<CardHeader className="pb-4">
											<div className="flex items-center justify-between mb-2">
												<CardTitle className="text-lg">{form.name}</CardTitle>
												<Badge
													variant={
														form.complexity === "Simple"
															? "secondary"
															: form.complexity === "Moderate"
																? "outline"
																: "destructive"
													}
													className="text-xs"
												>
													{form.complexity}
												</Badge>
											</div>
											<p className="text-sm text-muted-foreground mb-3">
												{form.description}
											</p>
											<div className="text-2xl font-bold text-green-600">
												₹{form.price.toLocaleString()}
											</div>
											<div className="text-sm text-muted-foreground">
												{form.estimatedTime}
											</div>
										</CardHeader>

										<CardContent className="space-y-4">
											<div>
												<h5 className="font-semibold text-sm mb-2">
													Applicable For:
												</h5>
												<div className="flex flex-wrap gap-1">
													{form.applicableFor.map((category) => (
														<Badge
															key={category}
															variant="secondary"
															className="text-xs"
														>
															{category}
														</Badge>
													))}
												</div>
											</div>

											<div>
												<h5 className="font-semibold text-sm mb-2">
													Features:
												</h5>
												<div className="space-y-1">
													{form.features.slice(0, 3).map((feature) => (
														<div
															key={feature}
															className="text-xs text-muted-foreground flex items-center"
														>
															<CheckCircle className="h-3 w-3 mr-2 text-green-500" />
															{feature}
														</div>
													))}
												</div>
											</div>

											<Button
												className="w-full"
												onClick={() => setSelectedITR(form)}
												data-testid={`button-select-${form.id}`}
											>
												Select {form.name}
												<ArrowRight className="ml-2 h-4 w-4" />
											</Button>
										</CardContent>
									</Card>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Tax Services Tab */}
				<TabsContent value="services" className="space-y-6">
					<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
						<div className="flex flex-wrap gap-2">
							{categories.map((category) => (
								<Button
									key={category}
									variant={
										selectedCategory === category ? "default" : "outline"
									}
									size="sm"
									onClick={() => setSelectedCategory(category)}
									data-testid={`button-category-${category.toLowerCase()}`}
								>
									{category}
								</Button>
							))}
						</div>

						<Input
							placeholder="Search tax services..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full sm:w-64"
							data-testid="input-search-services"
						/>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
						{filteredServices.map((service) => (
							<Card
								key={service.id}
								className="relative overflow-hidden hover:shadow-lg transition-shadow"
							>
								{service.isPremium && (
									<div className="absolute top-0 right-0 bg-gradient-to-l from-yellow-400 to-yellow-600 text-yellow-900 dark:text-yellow-100 px-3 py-1 text-xs font-semibold rounded-bl-lg">
										<Award className="h-3 w-3 inline mr-1" />
										PREMIUM
									</div>
								)}
								{service.isPopular && (
									<div className="absolute top-0 left-0 bg-gradient-to-r from-blue-500 to-green-600 text-foreground px-3 py-1 text-xs font-semibold rounded-br-lg">
										<Star className="h-3 w-3 inline mr-1" />
										POPULAR
									</div>
								)}

								<CardHeader className="pb-4">
									<div className="flex items-start justify-between">
										<div className="flex items-center gap-3">
											<div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
												<service.icon className="h-5 w-5 text-green-600" />
											</div>
											<div>
												<CardTitle className="text-lg mb-1">
													{service.title}
												</CardTitle>
												<div className="flex items-center gap-2">
													<div className="flex items-center">
														{[...Array(5)].map((_, i) => (
															<Star
																key={i}
																className={`h-3 w-3 ${i < Math.floor(service.rating) ? "text-yellow-400 fill-current" : "text-muted-foreground"}`}
															/>
														))}
														<span className="text-sm text-muted-foreground ml-1">
															{service.rating}
														</span>
													</div>
												</div>
											</div>
										</div>
									</div>
								</CardHeader>

								<CardContent className="space-y-4">
									<p className="text-muted-foreground text-sm">
										{service.description}
									</p>

									<div className="flex items-center justify-between">
										<div>
											<div className="text-2xl font-bold text-green-600">
												₹{service.price.toLocaleString()}
											</div>
											{service.originalPrice && (
												<div className="text-sm text-muted-foreground line-through">
													₹{service.originalPrice.toLocaleString()}
												</div>
											)}
										</div>
										<div className="text-right">
											<div className="flex items-center gap-1 text-sm text-muted-foreground">
												<Clock className="h-4 w-4" />
												{service.processingTime}
											</div>
										</div>
									</div>

									<div className="space-y-2">
										<h5 className="font-semibold text-sm">Key Features:</h5>
										<div className="flex flex-wrap gap-1">
											{service.features.map((feature) => (
												<Badge
													key={feature}
													variant="secondary"
													className="text-xs"
												>
													{feature}
												</Badge>
											))}
										</div>
									</div>

									<div className="flex gap-2 pt-2">
										<Button
											className="flex-1"
											onClick={() => handleServiceBooking(service)}
											data-testid={`button-book-${service.id}`}
										>
											Book Now
											<ArrowRight className="ml-2 h-4 w-4" />
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setSelectedService(service)}
											data-testid={`button-details-${service.id}`}
										>
											Details
										</Button>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</TabsContent>

				{/* Tax Planning Tab */}
				<TabsContent value="planning" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Calculator className="h-5 w-5 text-blue-600" />
								Tax Saving Strategies
							</CardTitle>
							<p className="text-muted-foreground">
								Maximize your tax savings with these proven strategies
							</p>
						</CardHeader>
						<CardContent>
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
								{taxPlanningStrategies.map((strategy) => (
									<Card
										key={strategy.id}
										className="border-2 border-blue-100 dark:border-blue-800 hover:border-blue-200 dark:border-blue-800 transition-colors"
									>
										<CardHeader className="pb-4">
											<div className="flex items-center gap-3 mb-3">
												<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
													<strategy.icon className="h-5 w-5 text-blue-600" />
												</div>
												<Badge variant="outline">{strategy.category}</Badge>
											</div>
											<CardTitle className="text-lg mb-2">
												{strategy.title}
											</CardTitle>
											<p className="text-sm text-muted-foreground mb-3">
												{strategy.description}
											</p>
											<div className="text-xl font-bold text-green-600">
												Save up to {strategy.potentialSavings}
											</div>
										</CardHeader>

										<CardContent>
											<div className="space-y-2">
												<h5 className="font-semibold text-sm">Details:</h5>
												<div className="space-y-1">
													{strategy.details.map((detail, index) => (
														<div
															key={index}
															className="text-xs text-muted-foreground flex items-start"
														>
															<CheckCircle className="h-3 w-3 mr-2 text-green-500 mt-0.5 flex-shrink-0" />
															{detail}
														</div>
													))}
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<BarChart3 className="h-5 w-5 text-purple-600" />
								Tax Savings Calculator
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid md:grid-cols-2 gap-6">
								<div className="space-y-4">
									<div>
										<label className="block text-sm font-medium mb-2">
											Annual Income
										</label>
										<Input
											placeholder="Enter your annual income"
											data-testid="input-annual-income"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium mb-2">
											Tax Regime
										</label>
										<Select>
											<SelectTrigger data-testid="select-tax-regime">
												<SelectValue placeholder="Select tax regime" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="old">Old Tax Regime</SelectItem>
												<SelectItem value="new">New Tax Regime</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div>
										<label className="block text-sm font-medium mb-2">
											Investments (80C)
										</label>
										<Input
											placeholder="Enter 80C investments"
											data-testid="input-80c-investments"
										/>
									</div>
									<Button className="w-full" data-testid="button-calculate-tax">
										<Calculator className="mr-2 h-4 w-4" />
										Calculate Tax Savings
									</Button>
								</div>
								<div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6">
									<h3 className="font-semibold mb-4">
										Your Tax Savings Breakdown
									</h3>
									<div className="space-y-3">
										<div className="flex justify-between">
											<span className="text-sm">80C Deductions</span>
											<span className="font-semibold">₹46,800</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm">80D Health Insurance</span>
											<span className="font-semibold">₹7,800</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm">Home Loan Interest</span>
											<span className="font-semibold">₹62,400</span>
										</div>
										<div className="border-t pt-3 mt-3">
											<div className="flex justify-between font-bold text-lg text-green-600">
												<span>Total Savings</span>
												<span>₹1,17,000</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Compliance Tab */}
				<TabsContent value="compliance" className="space-y-6">
					<div className="grid md:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Clock className="h-5 w-5 text-orange-600" />
									Important Deadlines
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
										<div>
											<div className="font-semibold">ITR Filing Deadline</div>
											<div className="text-sm text-muted-foreground">
												July 31, 2024
											</div>
										</div>
										<Badge variant="destructive">Urgent</Badge>
									</div>
									<div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
										<div>
											<div className="font-semibold">Advance Tax Q3</div>
											<div className="text-sm text-muted-foreground">
												December 15, 2024
											</div>
										</div>
										<Badge variant="outline">Upcoming</Badge>
									</div>
									<div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
										<div>
											<div className="font-semibold">TDS Return Filing</div>
											<div className="text-sm text-muted-foreground">
												Quarterly
											</div>
										</div>
										<Badge variant="secondary">Regular</Badge>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<LucideShield className="h-5 w-5 text-green-600" />
									Compliance Health Check
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<div>
										<div className="flex justify-between items-center mb-2">
											<span className="text-sm">ITR Filing Status</span>
											<span className="text-green-600 font-semibold">
												Filed
											</span>
										</div>
										<Progress value={100} className="h-2" />
									</div>
									<div>
										<div className="flex justify-between items-center mb-2">
											<span className="text-sm">TDS Compliance</span>
											<span className="text-orange-600 font-semibold">
												Pending
											</span>
										</div>
										<Progress value={60} className="h-2" />
									</div>
									<div>
										<div className="flex justify-between items-center mb-2">
											<span className="text-sm">GST Returns</span>
											<span className="text-green-600 font-semibold">
												Up to Date
											</span>
										</div>
										<Progress value={100} className="h-2" />
									</div>
								</div>
								<Button
									className="w-full"
									data-testid="button-compliance-report"
								>
									<Download className="mr-2 h-4 w-4" />
									Download Compliance Report
								</Button>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Users className="h-5 w-5 text-blue-600" />
								CA Support Team
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid md:grid-cols-3 gap-6">
								<div className="text-center">
									<div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
										<Phone className="h-6 w-6 text-blue-600" />
									</div>
									<h4 className="font-semibold mb-1">Phone Support</h4>
									<p className="text-sm text-muted-foreground mb-3">
										Direct line to our CA experts
									</p>
									<Button
										variant="outline"
										size="sm"
										data-testid="button-phone-support"
									>
										Call Now
									</Button>
								</div>
								<div className="text-center">
									<div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
										<Mail className="h-6 w-6 text-green-600" />
									</div>
									<h4 className="font-semibold mb-1">Email Support</h4>
									<p className="text-sm text-muted-foreground mb-3">
										24/7 email assistance
									</p>
									<Button
										variant="outline"
										size="sm"
										data-testid="button-email-support"
									>
										Send Email
									</Button>
								</div>
								<div className="text-center">
									<div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
										<Calendar className="h-6 w-6 text-purple-600" />
									</div>
									<h4 className="font-semibold mb-1">Schedule Meeting</h4>
									<p className="text-sm text-muted-foreground mb-3">
										Book one-on-one consultation
									</p>
									<Button
										variant="outline"
										size="sm"
										data-testid="button-schedule-meeting"
									>
										Book Meeting
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
