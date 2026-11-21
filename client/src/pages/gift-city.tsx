import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
	Building2,
	Crown,
	Globe,
	TrendingUp,
	Shield as LucideShield,
	Award,
	ArrowRight,
	Sparkles,
	Banknote,
	Target,
	FileText,
	Users,
	Briefcase,
	Calculator,
	Phone,
	Mail,
	CheckCircle,
	Star,
	Lock,
	Zap,
	PiggyBank,
	DollarSign,
	Percent,
	Clock,
	BarChart3,
	LineChart,
	Activity,
	Wallet,
	CreditCard,
	MapPin,
	Calendar,
} from "lucide-react";

interface GiftCityProduct {
	id: string;
	name: string;
	description: string;
	category: string;
	minimumInvestment: number;
	currency: string;
	expectedReturns: string;
	riskLevel: string;
	provider: string;
	features: string[];
	regulatoryBenefits: string[];
	eligibility: string[];
	isPremium: boolean;
	isLimited?: boolean;
}

// GIFT City IFSC Premium Products
const giftCityProducts: GiftCityProduct[] = [
	// Alternative Investment Funds (AIFs)
	{
		id: "aif-1",
		name: "GIFT City Private Equity AIF",
		description:
			"Category II AIF focusing on private equity investments across Asia-Pacific region with tax-efficient structure",
		category: "Alternative Investment Funds",
		minimumInvestment: 10000000,
		currency: "USD",
		expectedReturns: "18-25%",
		riskLevel: "High",
		provider: "GIFT City Asset Management",
		features: [
			"Professional Management",
			"Tax Efficient",
			"Diversified Portfolio",
			"Quarterly Reports",
		],
		regulatoryBenefits: [
			"No STT/CTT",
			"Tax Pass-through",
			"SEBI Regulated",
			"FPI Friendly",
		],
		eligibility: [
			"HNI (₹2Cr+ Net Worth)",
			"Institutional Investors",
			"Non-resident Indians",
		],
		isPremium: true,
		isLimited: true,
	},
	{
		id: "aif-2",
		name: "GIFT City Real Estate AIF",
		description:
			"Category I AIF investing in commercial real estate across India with REIT-like benefits",
		category: "Alternative Investment Funds",
		minimumInvestment: 5000000,
		currency: "USD",
		expectedReturns: "15-20%",
		riskLevel: "Medium-High",
		provider: "GIFT Realty Partners",
		features: [
			"Real Estate Focus",
			"Professional Management",
			"Regular Distributions",
			"Asset-backed",
		],
		regulatoryBenefits: [
			"Tax Benefits",
			"SEBI Regulated",
			"Transparency",
			"Professional Management",
		],
		eligibility: [
			"HNI (₹1Cr+ Net Worth)",
			"Family Offices",
			"Institutional Investors",
		],
		isPremium: true,
	},

	// IFSC Banking Services
	{
		id: "ifsc-bank-1",
		name: "GIFT City Multi-Currency Account",
		description:
			"Offshore banking account supporting 15+ currencies with competitive rates and global transfer facilities",
		category: "IFSC Banking",
		minimumInvestment: 100000,
		currency: "Multi-Currency",
		expectedReturns: "3-5%",
		riskLevel: "Low",
		provider: "GIFT City International Bank",
		features: [
			"Multi-Currency Support",
			"Global Transfers",
			"Zero FX Margins",
			"Relationship Manager",
		],
		regulatoryBenefits: [
			"IFSC Regulatory Benefits",
			"Tax Efficient",
			"Global Compliance",
			"KYC Once",
		],
		eligibility: [
			"NRIs",
			"HNIs",
			"Corporate Clients",
			"Institutional Investors",
		],
		isPremium: true,
	},
	{
		id: "ifsc-bank-2",
		name: "GIFT City Trade Finance Solutions",
		description:
			"Complete trade finance ecosystem including LC, Bank Guarantees, and Export Credit with competitive rates",
		category: "IFSC Banking",
		minimumInvestment: 500000,
		currency: "USD",
		expectedReturns: "8-12%",
		riskLevel: "Medium",
		provider: "GIFT Trade Finance Ltd",
		features: [
			"Trade Finance",
			"LC Facilities",
			"Export Credit",
			"Global Network",
		],
		regulatoryBenefits: [
			"IFSC Benefits",
			"Regulatory Arbitrage",
			"Tax Efficiency",
			"Faster Processing",
		],
		eligibility: [
			"Exporters",
			"Importers",
			"Trading Companies",
			"Manufacturing Units",
		],
		isPremium: true,
	},

	// Structured Products
	{
		id: "structured-1",
		name: "GIFT City Principal Protected Note",
		description:
			"USD denominated structured product with 100% capital protection and equity upside participation",
		category: "Structured Products",
		minimumInvestment: 250000,
		currency: "USD",
		expectedReturns: "6-18%",
		riskLevel: "Medium",
		provider: "GIFT Structured Solutions",
		features: [
			"Capital Protection",
			"Equity Upside",
			"USD Denominated",
			"3-Year Maturity",
		],
		regulatoryBenefits: [
			"Tax Efficient",
			"IFSC Regulated",
			"FPI Compliant",
			"Transparent Pricing",
		],
		eligibility: ["HNIs", "NRIs", "Family Offices", "Institutional Clients"],
		isPremium: true,
	},
	{
		id: "structured-2",
		name: "GIFT City Commodity Linked Note",
		description:
			"Structured note linked to basket of commodities providing inflation hedge with defined payoff structures",
		category: "Structured Products",
		minimumInvestment: 500000,
		currency: "USD",
		expectedReturns: "10-15%",
		riskLevel: "Medium-High",
		provider: "GIFT Commodity Partners",
		features: [
			"Commodity Exposure",
			"Inflation Hedge",
			"Professional Management",
			"Liquidity Options",
		],
		regulatoryBenefits: [
			"IFSC Benefits",
			"Tax Arbitrage",
			"Global Compliance",
			"Risk Management",
		],
		eligibility: [
			"HNIs",
			"Institutional Investors",
			"Corporate Treasuries",
			"Family Offices",
		],
		isPremium: true,
	},

	// Wealth Management Services
	{
		id: "wealth-1",
		name: "GIFT City Family Office Services",
		description:
			"Comprehensive family office solutions including wealth structuring, succession planning, and global investments",
		category: "Wealth Management",
		minimumInvestment: 25000000,
		currency: "Multi-Currency",
		expectedReturns: "12-20%",
		riskLevel: "Customized",
		provider: "GIFT Wealth Advisory",
		features: [
			"Family Office Setup",
			"Wealth Structuring",
			"Succession Planning",
			"Tax Optimization",
		],
		regulatoryBenefits: [
			"IFSC Advantages",
			"Global Tax Planning",
			"Regulatory Efficiency",
			"Privacy Protection",
		],
		eligibility: [
			"Ultra HNI (₹25Cr+)",
			"Business Families",
			"Promoter Groups",
			"Institutional Families",
		],
		isPremium: true,
		isLimited: true,
	},
	{
		id: "wealth-2",
		name: "GIFT City Investment Advisory",
		description:
			"Personalized investment advisory with global asset allocation and alternative investments access",
		category: "Wealth Management",
		minimumInvestment: 2500000,
		currency: "Multi-Currency",
		expectedReturns: "15-22%",
		riskLevel: "Customized",
		provider: "GIFT Advisory Services",
		features: [
			"Personalized Advisory",
			"Global Assets",
			"Alternative Investments",
			"Regular Reviews",
		],
		regulatoryBenefits: [
			"IFSC Benefits",
			"Tax Optimization",
			"Global Access",
			"Professional Management",
		],
		eligibility: [
			"HNIs",
			"NRIs",
			"Corporate Treasuries",
			"Institutional Clients",
		],
		isPremium: true,
	},
];

const categories = [
	{
		id: "all",
		name: "All Products",
		icon: Globe,
		count: giftCityProducts.length,
	},
	{
		id: "Alternative Investment Funds",
		name: "Alternative Investment Funds",
		icon: TrendingUp,
		count: 2,
	},
	{ id: "IFSC Banking", name: "IFSC Banking", icon: Banknote, count: 2 },
	{
		id: "Structured Products",
		name: "Structured Products",
		icon: BarChart3,
		count: 2,
	},
	{ id: "Wealth Management", name: "Wealth Management", icon: Crown, count: 2 },
];

const regulatoryAdvantages = [
	{
		title: "Tax Efficiency",
		description:
			"No Securities Transaction Tax (STT) or Commodity Transaction Tax (CTT)",
		icon: Percent,
	},
	{
		title: "Global Access",
		description:
			"Access to global markets and international financial products",
		icon: Globe,
	},
	{
		title: "Regulatory Arbitrage",
		description: "Benefit from IFSC's liberal regulatory framework",
		icon: LucideShield,
	},
	{
		title: "FPI Benefits",
		description: "Foreign Portfolio Investment benefits and easier compliance",
		icon: FileText,
	},
	{
		title: "Multi-Currency Operations",
		description: "Operate in multiple currencies without conversion hassles",
		icon: DollarSign,
	},
	{
		title: "Professional Management",
		description: "Access to international fund managers and advisory services",
		icon: Users,
	},
];

export default function GiftCity() {
	const { user } = useAuth();
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("products");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [searchTerm, setSearchTerm] = useState("");

	// Modals & Application state
	const [selectedProductForApply, setSelectedProductForApply] = useState<any | null>(null);
	const [selectedProductForDetails, setSelectedProductForDetails] = useState<any | null>(null);
	const userFullName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";
	const [applyForm, setApplyForm] = useState({
		applicantName: userFullName,
		email: user?.email || "",
		phone: user?.mobile || "",
		investorType: "Resident Indian",
		proposedInvestmentUSD: 25000,
		isAccredited: false,
		notes: "",
	});
	const [applicationSuccessData, setApplicationSuccessData] = useState<any | null>(null);

	// LRS & TCS Calculator state
	const [lrsAmountUSD, setLrsAmountUSD] = useState<number>(25000);
	const [lrsPriorINR, setLrsPriorINR] = useState<number>(0);
	const [lrsPurposeCode, setLrsPurposeCode] = useState<string>("S0001");
	const [lrsRemitterName, setLrsRemitterName] = useState<string>(userFullName);
	const [lrsRemitterPAN, setLrsRemitterPAN] = useState<string>("");
	const [lrsQuoteResult, setLrsQuoteResult] = useState<any | null>(null);

	// Accredited Investor check state
	const [accInvestorType, setAccInvestorType] = useState<string>("individual");
	const [accNetWorthUSD, setAccNetWorthUSD] = useState<number>(1200000);
	const [accIncomeUSD, setAccIncomeUSD] = useState<number>(220000);
	const [accResult, setAccResult] = useState<any | null>(null);

	// Fetch dynamic products with seed fallback
	const { data: apiProductsData } = useQuery({
		queryKey: ["/api/gift-city/products"],
		queryFn: async () => {
			try {
				const res = await apiRequest("/api/gift-city/products");
				return await res.json();
			} catch {
				return { data: [] };
			}
		},
	});

	const activeCatalog: any[] =
		apiProductsData?.data && apiProductsData.data.length > 0
			? apiProductsData.data.map((p: any) => ({
					...p,
					minimumInvestment: Number(p.minimumInvestment) || 10000,
					features: Array.isArray(p.features) ? p.features : [],
					regulatoryBenefits: Array.isArray(p.regulatoryBenefits) ? p.regulatoryBenefits : [],
					eligibility: Array.isArray(p.eligibility) ? p.eligibility : [],
			  }))
			: giftCityProducts;

	const filteredProducts = activeCatalog.filter((product) => {
		const matchesCategory =
			selectedCategory === "all" || product.category === selectedCategory;
		const matchesSearch =
			product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
		return matchesCategory && matchesSearch;
	});

	// Mutations
	const applyMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await apiRequest("/api/gift-city/application", "POST", payload);
			return res.json();
		},
		onSuccess: (res: any) => {
			if (res.success && res.data) {
				setApplicationSuccessData(res.data);
				setSelectedProductForApply(null);
				toast({
					title: "Application Registered",
					description: `Reference Number: ${res.data.referenceNumber}`,
				});
			} else {
				throw new Error(res.error || "Failed to register application");
			}
		},
		onError: (err: any) => {
			toast({
				title: "Submission Error",
				description: err?.message || "Could not register application",
				variant: "destructive",
			});
		},
	});

	const lrsQuoteMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await apiRequest("/api/gift-city/lrs-remittance-quote", "POST", payload);
			return res.json();
		},
		onSuccess: (res: any) => {
			if (res.success) {
				setLrsQuoteResult(res.data);
				toast({ title: "LRS Calculation Updated", description: "Section 206C(1G) TCS breakdown ready" });
			}
		},
		onError: (err: any) => {
			toast({ title: "Calculation Error", description: err?.message, variant: "destructive" });
		},
	});

	const accreditedCheckMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await apiRequest("/api/gift-city/accredited-check", "POST", payload);
			return res.json();
		},
		onSuccess: (res: any) => {
			if (res.success) {
				setAccResult(res.data);
				toast({
					title: "Assessment Complete",
					description: `Status: ${res.data.accreditationLevel}`,
				});
			}
		},
		onError: (err: any) => {
			toast({ title: "Assessment Error", description: err?.message, variant: "destructive" });
		},
	});

	const handleOpenApply = (product: any) => {
		setSelectedProductForApply(product);
		setApplyForm((prev) => ({
			...prev,
			proposedInvestmentUSD: Number(product.minimumInvestment) || 25000,
		}));
	};

	const formatCurrency = (amount: number, currency: string) => {
		if (currency === "USD") {
			return amount >= 1000000 ? `$${(amount / 1000000).toFixed(1)}M` : `$${amount.toLocaleString()}`;
		}
		if (currency === "Multi-Currency") {
			return `$${(amount / 1000000).toFixed(1)}M+`;
		}
		return `₹${(amount / 10000000).toFixed(1)}Cr`;
	};

	return (
		<div className="p-6 space-y-6" data-testid="gift-city-page">
			{/* Header Section */}
			<div className="mb-8">
				<div className="flex items-center gap-4 mb-6">
					<div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-lg">
						<Building2 className="h-8 w-8 text-foreground" />
					</div>
					<div>
						<h1 className="text-4xl font-bold text-foreground mb-2">
							GIFT City IFSC
						</h1>
						<p className="text-lg text-muted-foreground">
							Premium Financial Services for High-Net-Worth Clients
						</p>
					</div>
					<div className="ml-auto">
						<Badge
							variant="secondary"
							className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
						>
							<Crown className="h-3 w-3 mr-1" />
							Premium Zone
						</Badge>
					</div>
				</div>

				{/* Hero Stats */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<DollarSign className="h-8 w-8 text-green-600" />
								<div>
									<p className="text-sm text-muted-foreground">
										Assets Under Management
									</p>
									<p className="text-2xl font-bold text-foreground">$2.5B+</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<Users className="h-8 w-8 text-blue-600" />
								<div>
									<p className="text-sm text-muted-foreground">HNI Clients</p>
									<p className="text-2xl font-bold text-foreground">500+</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<TrendingUp className="h-8 w-8 text-purple-600" />
								<div>
									<p className="text-sm text-muted-foreground">
										Average Returns
									</p>
									<p className="text-2xl font-bold text-foreground">18.5%</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<Globe className="h-8 w-8 text-indigo-600" />
								<div>
									<p className="text-sm text-muted-foreground">
										Global Markets
									</p>
									<p className="text-2xl font-bold text-foreground">25+</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<ScrollableTabsList className="grid w-full grid-cols-2 md:grid-cols-5">
					<TabsTrigger value="products" data-testid="tab-products">
						Premium Products
					</TabsTrigger>
					<TabsTrigger value="lrs-calculator" data-testid="tab-lrs-calculator">
						LRS & TCS Form A2
					</TabsTrigger>
					<TabsTrigger value="accredited" data-testid="tab-accredited">
						IFSCA Accreditation
					</TabsTrigger>
					<TabsTrigger value="advantages" data-testid="tab-advantages">
						IFSC Advantages
					</TabsTrigger>
					<TabsTrigger value="contact" data-testid="tab-contact">
						Relationship Manager
					</TabsTrigger>
				</ScrollableTabsList>

				{/* Products Tab */}
				<TabsContent value="products" className="space-y-6">
					{/* Search and Filter */}
					<div className="flex flex-col md:flex-row gap-4 mb-6">
						<div className="flex-1">
							<Input
								placeholder="Search premium products..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="w-full"
								data-testid="input-search"
							/>
						</div>
					</div>

					{/* Category Filter */}
					<div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
						{categories.map((category) => (
							<Card
								key={category.id}
								className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
									selectedCategory === category.id
										? "ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20"
										: "hover:bg-muted"
								}`}
								onClick={() => setSelectedCategory(category.id)}
								data-testid={`category-${category.id}`}
							>
								<CardContent className="p-4 text-center">
									<category.icon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
									<p className="font-semibold text-sm">{category.name}</p>
									<p className="text-xs text-muted-foreground">
										{category.count} Products
									</p>
								</CardContent>
							</Card>
						))}
					</div>

					{/* Products Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{filteredProducts.map((product) => (
							<Card
								key={product.id}
								className="relative group hover:shadow-xl transition-all duration-300"
								data-testid={`product-card-${product.id}`}
							>
								<CardHeader>
									<div className="flex items-start justify-between mb-2">
										<div className="flex-1">
											<CardTitle className="text-lg font-bold mb-1">
												{product.name}
											</CardTitle>
											<Badge
												variant={product.isPremium ? "default" : "secondary"}
												className={`mb-2 ${product.isPremium ? "bg-purple-600" : ""}`}
											>
												{product.category}
											</Badge>
											{product.isLimited && (
												<Badge
													variant="outline"
													className="ml-2 border-orange-500 text-orange-600"
												>
													<Sparkles className="h-3 w-3 mr-1" />
													Limited Access
												</Badge>
											)}
										</div>
									</div>
									<p className="text-sm text-muted-foreground">
										{product.description}
									</p>
								</CardHeader>

								<CardContent className="space-y-4">
									{/* Key Metrics */}
									<div className="grid grid-cols-2 gap-4">
										<div>
											<p className="text-xs text-muted-foreground mb-1">
												Minimum Investment
											</p>
											<p className="font-bold text-lg text-purple-600">
												{formatCurrency(
													product.minimumInvestment,
													product.currency,
												)}
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground mb-1">
												Expected Returns
											</p>
											<p className="font-bold text-lg text-green-600">
												{product.expectedReturns}
											</p>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<p className="text-xs text-muted-foreground mb-1">
												Risk Level
											</p>
											<Badge
												variant={
													product.riskLevel === "High"
														? "destructive"
														: product.riskLevel === "Medium-High"
															? "outline"
															: product.riskLevel === "Medium"
																? "secondary"
																: "default"
												}
											>
												{product.riskLevel}
											</Badge>
										</div>
										<div>
											<p className="text-xs text-muted-foreground mb-1">
												Currency
											</p>
											<p className="font-medium">{product.currency}</p>
										</div>
									</div>

									{/* Features */}
									<div>
										<p className="text-sm font-semibold mb-2">Key Features</p>
										<div className="flex flex-wrap gap-1">
											{product.features?.slice(0, 3).map((feature: string, index: number) => (
												<Badge
													key={index}
													variant="outline"
													className="text-xs"
												>
													{feature}
												</Badge>
											))}
										</div>
									</div>

									{/* Regulatory Benefits */}
									<div>
										<p className="text-sm font-semibold mb-2">IFSC Benefits</p>
										<div className="flex flex-wrap gap-1">
											{product.regulatoryBenefits
												?.slice(0, 2)
												.map((benefit: string, index: number) => (
													<Badge
														key={index}
														variant="secondary"
														className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
													>
														<CheckCircle className="h-3 w-3 mr-1" />
														{benefit}
													</Badge>
												))}
										</div>
									</div>

									{/* Provider */}
									<div className="pt-2 border-t">
										<p className="text-xs text-muted-foreground mb-1">
											Provided by
										</p>
										<p className="font-medium">{product.provider}</p>
									</div>

									{/* Action Buttons */}
									<div className="flex gap-2 pt-2">
										<Button
											size="sm"
											className="flex-1 bg-purple-600 hover:bg-purple-700"
											onClick={() => handleOpenApply(product)}
											data-testid={`button-invest-${product.id}`}
										>
											<Wallet className="h-4 w-4 mr-1" />
											Invest Now
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setSelectedProductForDetails(product)}
											data-testid={`button-details-${product.id}`}
										>
											<FileText className="h-4 w-4 mr-1" />
											Details
										</Button>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</TabsContent>

				{/* LRS & TCS Form A2 Assistant Tab */}
				<TabsContent value="lrs-calculator" className="space-y-6">
					<div className="mb-6">
						<h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
							<Calculator className="h-6 w-6 text-purple-600" />
							RBI LRS Quota & Section 206C(1G) TCS Calculator
						</h2>
						<p className="text-muted-foreground">
							Compute outward remittances under the RBI Liberalised Remittance Scheme ($250,000 USD/FY) with exact 20% TCS threshold calculations and automated Form A2 generation for IFSC Banking Units (IBU).
						</p>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Inputs Card */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Remittance Parameters</CardTitle>
								<CardDescription>
									Enter your proposed investment to evaluate LRS quota and tax implications
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<Label className="text-sm font-semibold">Remittance Amount ($ USD)</Label>
									<Input
										type="number"
										value={lrsAmountUSD}
										onChange={(e) => setLrsAmountUSD(Number(e.target.value))}
										placeholder="e.g. 25000"
										className="mt-1"
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Converted at reference rate ₹84.50/USD
									</p>
								</div>

								<div>
									<Label className="text-sm font-semibold">Prior FY Remittances (₹ INR)</Label>
									<Input
										type="number"
										value={lrsPriorINR}
										onChange={(e) => setLrsPriorINR(Number(e.target.value))}
										placeholder="e.g. 0"
										className="mt-1"
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Cumulative foreign remittances made across all bank accounts this financial year
									</p>
								</div>

								<div>
									<Label className="text-sm font-semibold">RBI Purpose Code</Label>
									<Select value={lrsPurposeCode} onValueChange={setLrsPurposeCode}>
										<SelectTrigger className="mt-1">
											<SelectValue placeholder="Select purpose code" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="S0001">S0001: Indian investment abroad in equity shares/AIFs</SelectItem>
											<SelectItem value="S0002">S0002: Indian investment abroad in debt securities</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div>
										<Label className="text-sm font-semibold">Remitter Name</Label>
										<Input
											value={lrsRemitterName}
											onChange={(e) => setLrsRemitterName(e.target.value)}
											placeholder="Full Name"
											className="mt-1"
										/>
									</div>
									<div>
										<Label className="text-sm font-semibold">Remitter PAN</Label>
										<Input
											value={lrsRemitterPAN}
											onChange={(e) => setLrsRemitterPAN(e.target.value.toUpperCase())}
											placeholder="ABCDE1234F"
											maxLength={10}
											className="mt-1"
										/>
									</div>
								</div>

								<Button
									className="w-full bg-purple-600 hover:bg-purple-700"
									disabled={lrsQuoteMutation.isPending || lrsAmountUSD <= 0}
									onClick={() =>
										lrsQuoteMutation.mutate({
											remittanceAmountUSD: lrsAmountUSD,
											fyUtilizationINR: lrsPriorINR,
											purposeCode: lrsPurposeCode,
											remitterName: lrsRemitterName,
											remitterPAN: lrsRemitterPAN,
										})
									}
								>
									{lrsQuoteMutation.isPending ? "Calculating..." : "Calculate LRS & TCS Breakdown"}
								</Button>
							</CardContent>
						</Card>

						{/* Breakdown & Form A2 Preview Card */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg flex items-center justify-between">
									<span>Remittance & Tax Breakdown</span>
									{lrsQuoteResult && (
										<Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
											{lrsQuoteResult.a2FormPreview?.formNumber}
										</Badge>
									)}
								</CardTitle>
								<CardDescription>
									Statutory calculations under Section 206C(1G) and RBI LRS limits
								</CardDescription>
							</CardHeader>
							<CardContent>
								{lrsQuoteResult ? (
									<div className="space-y-4">
										<div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
											<div>
												<p className="text-xs text-muted-foreground">Remittance Amount (USD)</p>
												<p className="text-lg font-bold">${lrsQuoteResult.remittanceUSD?.toLocaleString()}</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">INR Equivalent (@ ₹{lrsQuoteResult.fxRate})</p>
												<p className="text-lg font-bold">₹{lrsQuoteResult.remittanceINR?.toLocaleString()}</p>
											</div>
										</div>

										<div className="space-y-2 border-t pt-3">
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">Exempt Portion (below ₹7L threshold):</span>
												<span className="font-medium">₹{lrsQuoteResult.tcsDetails?.amountBelowThresholdINR?.toLocaleString()}</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">Portion Subject to TCS:</span>
												<span className="font-medium">₹{lrsQuoteResult.tcsDetails?.amountAboveThresholdINR?.toLocaleString()}</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-purple-600 font-semibold">TCS Rate (Finance Act 2023):</span>
												<Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
													{lrsQuoteResult.tcsDetails?.tcsRatePercent}%
												</Badge>
											</div>
											<div className="flex justify-between text-sm border-t pt-2">
												<span className="font-semibold">TCS Payable (Tax credit in ITR):</span>
												<span className="font-bold text-amber-600">₹{lrsQuoteResult.tcsDetails?.tcsPayableINR?.toLocaleString()}</span>
											</div>
											<div className="flex justify-between text-base font-bold border-t pt-2 bg-purple-50 dark:bg-purple-950/40 p-2 rounded">
												<span>Total Amount Payable to AD Bank:</span>
												<span className="text-purple-700 dark:text-purple-300">₹{lrsQuoteResult.tcsDetails?.totalPayableWithTcsINR?.toLocaleString()}</span>
											</div>
										</div>

										{/* Form A2 Preview */}
										<div className="p-3 border rounded-lg bg-background text-xs space-y-1">
											<p className="font-bold text-sm text-foreground flex items-center gap-1">
												<FileText className="h-4 w-4 text-purple-600" />
												RBI Form A2 Pre-Filled Metadata
											</p>
											<p><span className="text-muted-foreground">Beneficiary Bank:</span> {lrsQuoteResult.a2FormPreview?.beneficiaryBank}</p>
											<p><span className="text-muted-foreground">Routing Rail:</span> {lrsQuoteResult.a2FormPreview?.transferChannel}</p>
											<p><span className="text-muted-foreground">Remaining LRS Balance:</span> ${lrsQuoteResult.remainingLrsLimitUSD?.toLocaleString()} USD</p>
										</div>

										<p className="text-xs text-muted-foreground italic">
											Note: TCS collected is fully adjustable against Advance Tax liability or refundable during annual ITR filing.
										</p>
									</div>
								) : (
									<div className="text-center py-12 text-muted-foreground space-y-2">
										<Calculator className="h-10 w-10 mx-auto text-purple-400 opacity-60" />
										<p className="text-sm">Click "Calculate LRS & TCS Breakdown" to view statutory remittance calculations and Form A2 package.</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* IFSCA Accredited Investor Assessment Tab */}
				<TabsContent value="accredited" className="space-y-6">
					<div className="mb-6">
						<h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
							<Award className="h-6 w-6 text-purple-600" />
							IFSCA Accredited Investor Assessment
						</h2>
						<p className="text-muted-foreground">
							Determine statutory eligibility under IFSCA (Fund Management) Regulations, 2022 to invest in Category I, II, & III Alternative Investment Funds (AIFs) and unlisted vehicles.
						</p>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Assessment Form Card */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Accreditation Questionnaire</CardTitle>
								<CardDescription>
									Self-certify financial thresholds as defined under IFSCA Regulation 2(1)(a)
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<Label className="text-sm font-semibold">Investor Category</Label>
									<Select value={accInvestorType} onValueChange={setAccInvestorType}>
										<SelectTrigger className="mt-1">
											<SelectValue placeholder="Select investor type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="individual">Individual Resident / NRI</SelectItem>
											<SelectItem value="entity">Corporate Body / Family Office</SelectItem>
											<SelectItem value="fpi">Foreign Portfolio Investor (FPI)</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div>
									<Label className="text-sm font-semibold">Liquid / Investable Net Worth ($ USD)</Label>
									<Input
										type="number"
										value={accNetWorthUSD}
										onChange={(e) => setAccNetWorthUSD(Number(e.target.value))}
										placeholder="e.g. 1200000"
										className="mt-1"
									/>
									<p className="text-xs text-muted-foreground mt-1">
										IFSCA Floor: $1,000,000 USD (excl. primary residence)
									</p>
								</div>

								<div>
									<Label className="text-sm font-semibold">Gross Annual Income (3-Year Average, $ USD)</Label>
									<Input
										type="number"
										value={accIncomeUSD}
										onChange={(e) => setAccIncomeUSD(Number(e.target.value))}
										placeholder="e.g. 250000"
										className="mt-1"
									/>
									<p className="text-xs text-muted-foreground mt-1">
										IFSCA Floor: $200,000 USD gross annual income
									</p>
								</div>

								<Button
									className="w-full bg-purple-600 hover:bg-purple-700"
									disabled={accreditedCheckMutation.isPending}
									onClick={() =>
										accreditedCheckMutation.mutate({
											investorType: accInvestorType,
											netWorthUSD: accNetWorthUSD,
											annualIncomeUSD: accIncomeUSD,
										})
									}
								>
									{accreditedCheckMutation.isPending ? "Evaluating..." : "Run Statutory Eligibility Assessment"}
								</Button>
							</CardContent>
						</Card>

						{/* Assessment Result Card */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg flex items-center justify-between">
									<span>Accreditation Verdict</span>
									{accResult && (
										<Badge
											variant={accResult.isEligible ? "default" : "destructive"}
											className={accResult.isEligible ? "bg-green-600 hover:bg-green-700 text-white" : ""}
										>
											{accResult.accreditationLevel}
										</Badge>
									)}
								</CardTitle>
								<CardDescription>
									Official classification and eligible GIFT City asset tiers
								</CardDescription>
							</CardHeader>
							<CardContent>
								{accResult ? (
									<div className="space-y-4">
										<div className="p-3 border rounded-lg bg-muted/40 space-y-2">
											<p className="text-sm font-semibold text-foreground">Statutory Framework</p>
											<p className="text-xs text-muted-foreground">{accResult.framework}</p>
											<p className="text-xs"><span className="font-semibold">Validity:</span> {accResult.validityPeriod}</p>
										</div>

										<div className="space-y-2">
											<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Criteria Verification</p>
											{accResult.criteriaEvaluated?.map((c: any, idx: number) => (
												<div key={idx} className="flex items-center justify-between p-2 border rounded text-xs">
													<div>
														<p className="font-semibold">{c.metric}</p>
														<p className="text-muted-foreground">Floor: {c.threshold} | Provided: {c.valueProvided}</p>
													</div>
													<Badge variant={c.met ? "secondary" : "outline"} className={c.met ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "text-amber-600"}>
														{c.met ? "MET" : "NOT MET"}
													</Badge>
												</div>
											))}
										</div>

										<div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-xs space-y-1">
											<p className="font-bold text-purple-900 dark:text-purple-200">Permitted Investment Scope:</p>
											<p className="text-muted-foreground">{accResult.statutoryNotice}</p>
										</div>
									</div>
								) : (
									<div className="text-center py-12 text-muted-foreground space-y-2">
										<Award className="h-10 w-10 mx-auto text-purple-400 opacity-60" />
										<p className="text-sm">Run the assessment to verify whether you qualify as an Accredited Investor under IFSCA guidelines.</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* IFSC Advantages Tab */}
				<TabsContent value="advantages" className="space-y-6">
					<div className="mb-8">
						<h2 className="text-2xl font-bold text-foreground mb-4">
							Why Choose GIFT City IFSC?
						</h2>
						<p className="text-muted-foreground">
							India's first International Financial Services Centre offers
							unparalleled advantages for sophisticated investors
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{regulatoryAdvantages.map((advantage, index) => (
							<Card
								key={index}
								className="hover:shadow-lg transition-shadow duration-300"
							>
								<CardHeader>
									<div className="flex items-center gap-3 mb-2">
										<div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg">
											<advantage.icon className="h-6 w-6 text-purple-600" />
										</div>
										<CardTitle className="text-lg">{advantage.title}</CardTitle>
									</div>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground">
										{advantage.description}
									</p>
								</CardContent>
							</Card>
						))}
					</div>

					{/* Additional Benefits Section */}
					<Card className="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Award className="h-6 w-6 text-purple-600" />
								Exclusive IFSC Benefits
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<CheckCircle className="h-4 w-4 text-green-600" />
										<span className="text-sm">
											Zero STT on equity transactions
										</span>
									</div>
									<div className="flex items-center gap-2">
										<CheckCircle className="h-4 w-4 text-green-600" />
										<span className="text-sm">No CTT on commodity trades</span>
									</div>
									<div className="flex items-center gap-2">
										<CheckCircle className="h-4 w-4 text-green-600" />
										<span className="text-sm">Tax pass-through for AIFs</span>
									</div>
								</div>
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<CheckCircle className="h-4 w-4 text-green-600" />
										<span className="text-sm">Global market access</span>
									</div>
									<div className="flex items-center gap-2">
										<CheckCircle className="h-4 w-4 text-green-600" />
										<span className="text-sm">Multi-currency operations</span>
									</div>
									<div className="flex items-center gap-2">
										<CheckCircle className="h-4 w-4 text-green-600" />
										<span className="text-sm">
											Liberal regulatory framework
										</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Contact Tab */}
				<TabsContent value="contact" className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
						{/* Relationship Manager Contact */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Users className="h-6 w-6 text-purple-600" />
									Dedicated Relationship Manager
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="text-center">
									<div className="w-24 h-24 bg-purple-100 dark:bg-purple-900 rounded-full mx-auto mb-4 flex items-center justify-center">
										<Users className="h-12 w-12 text-purple-600" />
									</div>
									<h3 className="text-xl font-bold mb-1">Priya Sharma</h3>
									<p className="text-sm text-muted-foreground mb-4">
										Senior Relationship Manager - GIFT City IFSC
									</p>
									<div className="space-y-3">
										<div className="flex items-center gap-2 text-sm">
											<Phone className="h-4 w-4 text-purple-600" />
											<span>+91 79 4040 5000</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<Mail className="h-4 w-4 text-purple-600" />
											<span>priya.sharma@fintekpro.com</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<MapPin className="h-4 w-4 text-purple-600" />
											<span>GIFT City, Gandhinagar</span>
										</div>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<Button
										className="bg-purple-600 hover:bg-purple-700"
										data-testid="button-schedule-call"
									>
										<Calendar className="h-4 w-4 mr-1" />
										Schedule Call
									</Button>
									<Button variant="outline" data-testid="button-send-message">
										<Mail className="h-4 w-4 mr-1" />
										Send Message
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Office Information */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Building2 className="h-6 w-6 text-purple-600" />
									GIFT City Office
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<h4 className="font-semibold mb-2">Address</h4>
									<p className="text-sm text-muted-foreground">
										FintekPro IFSC Branch
										<br />
										Block A, 15th Floor
										<br />
										GIFT One Building
										<br />
										GIFT City, Gandhinagar - 382355
										<br />
										Gujarat, India
									</p>
								</div>

								<div>
									<h4 className="font-semibold mb-2">Business Hours</h4>
									<div className="space-y-1 text-sm text-muted-foreground">
										<div className="flex justify-between">
											<span>Monday - Friday:</span>
											<span>9:00 AM - 6:00 PM</span>
										</div>
										<div className="flex justify-between">
											<span>Saturday:</span>
											<span>10:00 AM - 4:00 PM</span>
										</div>
										<div className="flex justify-between">
											<span>Sunday:</span>
											<span>Closed</span>
										</div>
									</div>
								</div>

								<div>
									<h4 className="font-semibold mb-2">Services Available</h4>
									<div className="space-y-2">
										<div className="flex items-center gap-2 text-sm">
											<CheckCircle className="h-4 w-4 text-green-600" />
											<span>Portfolio Review & Strategy</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<CheckCircle className="h-4 w-4 text-green-600" />
											<span>Global Investment Planning</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<CheckCircle className="h-4 w-4 text-green-600" />
											<span>Tax Optimization Strategies</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<CheckCircle className="h-4 w-4 text-green-600" />
											<span>Regulatory Compliance Support</span>
										</div>
									</div>
								</div>

								<Button
									className="w-full bg-purple-600 hover:bg-purple-700"
									data-testid="button-book-visit"
								>
									<MapPin className="h-4 w-4 mr-1" />
									Book Office Visit
								</Button>
							</CardContent>
						</Card>
					</div>

					{/* Quick Contact Form */}
					<Card>
						<CardHeader>
							<CardTitle>Get in Touch</CardTitle>
							<p className="text-sm text-muted-foreground">
								Our relationship managers will contact you within 24 hours
							</p>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<Input placeholder="Full Name" data-testid="input-name" />
								<Input placeholder="Phone Number" data-testid="input-phone" />
								<Input
									placeholder="Email Address"
									className="md:col-span-2"
									data-testid="input-email"
								/>
								<Input
									placeholder="Investment Interest (Optional)"
									className="md:col-span-2"
									data-testid="input-interest"
								/>
							</div>
							<Button
								className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
								data-testid="button-submit-contact"
							>
								<Phone className="h-4 w-4 mr-1" />
								Request Callback
							</Button>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* ── Dialog 1: Investment Intent / Application Modal ── */}
			<Dialog open={!!selectedProductForApply} onOpenChange={() => setSelectedProductForApply(null)}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Building2 className="h-5 w-5 text-purple-600" />
							GIFT City Investment Intent
						</DialogTitle>
						<DialogDescription>
							Register investment interest for <span className="font-semibold text-foreground">{selectedProductForApply?.name}</span>
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-xs space-y-1">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Category:</span>
								<span className="font-semibold">{selectedProductForApply?.category}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Minimum Ticket:</span>
								<span className="font-semibold">${selectedProductForApply?.minimumInvestment?.toLocaleString()} {selectedProductForApply?.currency}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Flow Direction:</span>
								<Badge variant="outline" className="text-xs">{selectedProductForApply?.flowDirection === "outbound" ? "Outbound LRS" : "Inbound Foreign"}</Badge>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label className="text-xs font-semibold">Full Name *</Label>
								<Input
									value={applyForm.applicantName}
									onChange={(e) => setApplyForm((p) => ({ ...p, applicantName: e.target.value }))}
									placeholder="Your Full Name"
									className="mt-1 text-sm"
								/>
							</div>
							<div>
								<Label className="text-xs font-semibold">Phone Number *</Label>
								<Input
									value={applyForm.phone}
									onChange={(e) => setApplyForm((p) => ({ ...p, phone: e.target.value }))}
									placeholder="+91 / +1 ..."
									className="mt-1 text-sm"
								/>
							</div>
						</div>

						<div>
							<Label className="text-xs font-semibold">Email Address *</Label>
							<Input
								value={applyForm.email}
								onChange={(e) => setApplyForm((p) => ({ ...p, email: e.target.value }))}
								placeholder="investor@example.com"
								className="mt-1 text-sm"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label className="text-xs font-semibold">Investor Classification</Label>
								<Select
									value={applyForm.investorType}
									onValueChange={(val) => setApplyForm((p) => ({ ...p, investorType: val }))}
								>
									<SelectTrigger className="mt-1 text-sm">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="Resident Indian">Resident Indian (LRS)</SelectItem>
										<SelectItem value="NRI">NRI (Non-Resident Indian)</SelectItem>
										<SelectItem value="Foreign HNI">Foreign Portfolio HNI</SelectItem>
										<SelectItem value="Family Office">Family Office / Corporate</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label className="text-xs font-semibold">Proposed Amount ($ USD)</Label>
								<Input
									type="number"
									value={applyForm.proposedInvestmentUSD}
									onChange={(e) => setApplyForm((p) => ({ ...p, proposedInvestmentUSD: Number(e.target.value) }))}
									className="mt-1 text-sm"
								/>
							</div>
						</div>

						<div>
							<Label className="text-xs font-semibold">Notes / Advisor Requests</Label>
							<Textarea
								value={applyForm.notes}
								onChange={(e) => setApplyForm((p) => ({ ...p, notes: e.target.value }))}
								placeholder="e.g. Inquiring regarding Form A2 or USD escrow setup..."
								rows={2}
								className="mt-1 text-sm"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setSelectedProductForApply(null)}>
							Cancel
						</Button>
						<Button
							className="bg-purple-600 hover:bg-purple-700"
							disabled={applyMutation.isPending || !applyForm.applicantName || !applyForm.email || !applyForm.phone}
							onClick={() =>
								applyMutation.mutate({
									productId: selectedProductForApply?.id,
									productName: selectedProductForApply?.name,
									applicantName: applyForm.applicantName,
									email: applyForm.email,
									phone: applyForm.phone,
									investorType: applyForm.investorType,
									flowDirection: selectedProductForApply?.flowDirection || "outbound",
									proposedInvestmentUSD: applyForm.proposedInvestmentUSD,
									isAccredited: applyForm.isAccredited,
									lrsApplicable: selectedProductForApply?.lrsApplicable ?? true,
									notes: applyForm.notes,
								})
							}
						>
							{applyMutation.isPending ? "Submitting..." : "Submit Application"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Dialog 2: Full Product Details Modal ── */}
			<Dialog open={!!selectedProductForDetails} onOpenChange={() => setSelectedProductForDetails(null)}>
				<DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Crown className="h-5 w-5 text-purple-600" />
							{selectedProductForDetails?.name}
						</DialogTitle>
						<DialogDescription>
							{selectedProductForDetails?.category} • Provided by {selectedProductForDetails?.provider}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<p className="text-sm text-foreground">{selectedProductForDetails?.description}</p>

						<div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
							<div>
								<span className="text-muted-foreground block">Minimum Ticket:</span>
								<span className="font-bold text-sm">${selectedProductForDetails?.minimumInvestment?.toLocaleString()} {selectedProductForDetails?.currency}</span>
							</div>
							<div>
								<span className="text-muted-foreground block">Expected Returns:</span>
								<span className="font-bold text-sm text-green-600">{selectedProductForDetails?.expectedReturns || "Market Linked"}</span>
							</div>
							<div>
								<span className="text-muted-foreground block">Risk Level:</span>
								<span className="font-bold text-sm text-purple-600">{selectedProductForDetails?.riskLevel || "Moderate"}</span>
							</div>
						</div>

						{/* Features */}
						<div>
							<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Key Features</h4>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
								{selectedProductForDetails?.features?.map((f: string, i: number) => (
									<div key={i} className="flex items-center gap-2 text-xs p-2 border rounded">
										<CheckCircle className="h-3.5 w-3.5 text-purple-600 shrink-0" />
										<span>{f}</span>
									</div>
								))}
							</div>
						</div>

						{/* Regulatory Benefits */}
						<div>
							<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">IFSC Regulatory & Tax Benefits</h4>
							<div className="space-y-1">
								{selectedProductForDetails?.regulatoryBenefits?.map((b: string, i: number) => (
									<div key={i} className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
										<LucideShield className="h-3.5 w-3.5 shrink-0" />
										<span>{b}</span>
									</div>
								))}
							</div>
						</div>

						{/* Tax Treatment */}
						{selectedProductForDetails?.taxImplications && (
							<div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-xs">
								<span className="font-semibold text-amber-900 dark:text-amber-200 block mb-1">Taxation Framework:</span>
								<p className="text-muted-foreground">{selectedProductForDetails.taxImplications}</p>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setSelectedProductForDetails(null)}>
							Close
						</Button>
						<Button
							className="bg-purple-600 hover:bg-purple-700"
							onClick={() => {
								const prod = selectedProductForDetails;
								setSelectedProductForDetails(null);
								handleOpenApply(prod);
							}}
						>
							<Wallet className="h-4 w-4 mr-1" />
							Apply for this Product
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ── Dialog 3: Application Success Confirmation ── */}
			<Dialog open={!!applicationSuccessData} onOpenChange={() => setApplicationSuccessData(null)}>
				<DialogContent className="max-w-md text-center">
					<DialogHeader>
						<div className="w-12 h-12 rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300 mx-auto flex items-center justify-center mb-2">
							<CheckCircle className="h-6 w-6" />
						</div>
						<DialogTitle className="text-xl">Application Registered</DialogTitle>
						<DialogDescription>
							Reference ID: <span className="font-bold text-purple-600">{applicationSuccessData?.referenceNumber}</span>
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 py-2 text-left text-xs">
						<p className="text-muted-foreground">
							Thank you, <span className="font-semibold text-foreground">{applicationSuccessData?.applicantName}</span>. Your expression of interest for <span className="font-semibold text-foreground">{applicationSuccessData?.productName}</span> has been logged with our IFSC compliance desk.
						</p>

						<div className="p-3 bg-muted rounded-lg space-y-2">
							<p className="font-semibold text-foreground">Next Action Steps:</p>
							{applicationSuccessData?.nextSteps?.map((step: string, i: number) => (
								<div key={i} className="flex items-start gap-2">
									<span className="w-4 h-4 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-[10px] flex items-center justify-center shrink-0 mt-0.5">
										{i + 1}
									</span>
									<span className="text-muted-foreground">{step}</span>
								</div>
							))}
						</div>

						<p className="text-[11px] text-muted-foreground">
							<span className="font-semibold">Assigned Office:</span> {applicationSuccessData?.assignedBranch}
						</p>
					</div>

					<DialogFooter>
						<Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => setApplicationSuccessData(null)}>
							Done
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
