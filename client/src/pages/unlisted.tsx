import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Gem,
	TrendingUp,
	Calendar,
	IndianRupee,
	Building2,
	Calculator,
	Star,
	Eye,
	Lock,
	Store,
	ShoppingCart,
	Search,
	Sparkles,
	AlertTriangle,
	CheckCircle,
	Target,
	ArrowUpRight,
	Database,
} from "lucide-react";
import { ClientTransactionHistory } from "@/components/store/ClientTransactionHistory";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { CartBadge } from "@/components/UnlistedCart";
import {
	Rocket,
	ArrowRight,
	Share2,
	Send,
	Clock,
	Landmark,
} from "lucide-react";

// Unlisted Securities Categories Component
function UnlistedCategoriesSection({ onSelectTab }: { onSelectTab?: (tab: string) => void }) {
	const [_selectedCategory, setSelectedCategory] = useState("all");

	const unlistedCategories = [
		{
			id: "pre-ipo",
			name: "Pre-IPO Shares",
			description: "Exclusive access to companies before they go public",
			icon: "TrendingUp",
			color: "blue",
			yieldRange: "15-40% p.a.",
			minInvestment: "₹1,00,000",
			count: 45,
			riskLevel: "High",
			companies: ["Flipkart", "OYO", "Paytm Mall", "Swiggy"],
		},
		{
			id: "startup-equity",
			name: "Startup Equity",
			description: "Early-stage startup investments with high growth potential",
			icon: "Building2",
			color: "green",
			yieldRange: "20-100% p.a.",
			minInvestment: "₹2,50,000",
			count: 32,
			riskLevel: "Very High",
			companies: ["Zerodha", "Razorpay", "CRED", "Meesho"],
		},
		{
			id: "unicorn-stakes",
			name: "Unicorn Stakes",
			description: "Secondary market trading in unicorn company shares",
			icon: "Star",
			color: "purple",
			yieldRange: "10-30% p.a.",
			minInvestment: "₹5,00,000",
			count: 18,
			riskLevel: "High",
			companies: ["Byju's", "Dream11", "Unacademy", "Vedantu"],
		},
		{
			id: "esop-buybacks",
			name: "ESOP Buybacks",
			description: "Employee stock option buyback opportunities",
			icon: "Gem",
			color: "yellow",
			yieldRange: "5-25% p.a.",
			minInvestment: "₹50,000",
			count: 67,
			riskLevel: "Medium",
			companies: ["Flipkart", "Eternal", "PolicyBazaar", "Freshworks"],
		},
	];

	const getIcon = (iconName: string) => {
		const icons = { TrendingUp, Building2, Star, Gem };
		return icons[iconName as keyof typeof icons] || Gem;
	};

	return (
		<section>
			<h2 className="text-2xl font-bold text-foreground mb-6">
				Unlisted Securities Categories
			</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{unlistedCategories.map((category) => {
					const IconComponent = getIcon(category.icon);
					return (
						<Card
							key={category.id}
							className="hover:shadow-md transition-shadow cursor-pointer"
							data-testid={`${category.id}-unlisted`}
							onClick={() => {
								if (category.id === "pre-ipo" && onSelectTab) {
									onSelectTab("pre-ipo");
								} else {
									setSelectedCategory(category.id);
								}
							}}
						>
							<CardContent className="p-6">
								<div
									className={`w-12 h-12 bg-${category.color}-100 rounded-lg flex items-center justify-center mb-4`}
								>
									<IconComponent
										className={`h-6 w-6 text-${category.color === "blue" ? "finance-blue" : category.color === "green" ? "finance-green" : category.color}-600`}
									/>
								</div>
								<h3 className="font-bold text-foreground mb-2">
									{category.name}
								</h3>
								<p className="text-muted-foreground text-sm mb-4">
									{category.description}
								</p>
								<div className="space-y-2 text-xs">
									<div className="flex justify-between">
										<span>Expected Return:</span>
										<span className="font-semibold text-finance-green">
											{category.yieldRange}
										</span>
									</div>
									<div className="flex justify-between">
										<span>Min Investment:</span>
										<span className="font-semibold">
											{category.minInvestment}
										</span>
									</div>
									<div className="flex justify-between">
										<span>Available:</span>
										<span className="font-semibold text-finance-blue">
											{category.count} opportunities
										</span>
									</div>
									<Badge
										variant="outline"
										className="w-full justify-center mt-2"
									>
										{category.riskLevel} Risk
									</Badge>
								</div>
								<div className="mt-4">
									<p className="text-xs text-muted-foreground mb-2">
										Featured Companies:
									</p>
									<div className="flex flex-wrap gap-1">
										{category.companies.slice(0, 3).map((company, idx) => (
											<Badge key={idx} variant="secondary" className="text-xs">
												{company}
											</Badge>
										))}
									</div>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</section>
	);
}

// Marketplace Section - Shows published sell listings
function MarketplaceSection() {
	const [, setLocation] = useLocation();
	const [searchQuery, setSearchQuery] = useState("");

	const { data: listings, isLoading } = useQuery<any[]>({
		queryKey: ["/api/unlisted/listings/published"],
		queryFn: async () => {
			const response = await fetch("/api/unlisted/listings/published");
			if (!response.ok) throw new Error("Failed to fetch listings");
			const result = await response.json();
			// API returns { data: { listings: [...], pagination: {...} } }
			return result.data?.listings || [];
		},
	});

	const filteredListings =
		listings?.filter((listing) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				listing.companyName?.toLowerCase().includes(query) ||
				listing.company?.name?.toLowerCase().includes(query)
			);
		}) || [];

	if (isLoading) {
		return <LoadingState />;
	}

	if (!listings || listings.length === 0) {
		return (
			<EmptyState
				icon={Store}
				title="No Listings Available"
				description="There are currently no published sell listings in the marketplace. Check back later for new opportunities."
			/>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
					<Input
						placeholder="Search listings..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
						data-testid="input-marketplace-search"
					/>
				</div>
				<Link href="/unlisted/cart">
					<Button
						variant="outline"
						className="relative"
						data-testid="button-view-cart"
					>
						<ShoppingCart className="h-4 w-4 mr-2" />
						Cart
						<CartBadge />
					</Button>
				</Link>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filteredListings.map((listing) => (
					<Card
						key={listing.id}
						className="hover:shadow-md transition-shadow"
						data-testid={`listing-card-${listing.id}`}
					>
						<CardContent className="p-4">
							<div className="flex justify-between items-start mb-3">
								<div>
									<h4 className="font-semibold text-lg">
										{listing.companyName || listing.company?.name}
									</h4>
									<p className="text-sm text-muted-foreground">
										{listing.company?.sector || "Technology"}
									</p>
								</div>
								<Badge
									variant={
										listing.orderType === "sell" ? "destructive" : "default"
									}
								>
									{listing.orderType === "sell" ? "For Sale" : "Buy Request"}
								</Badge>
							</div>

							<div className="space-y-2 text-sm mb-4">
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										Price per share:
									</span>
									<span className="font-semibold text-green-600">
										₹
										{Number.parseFloat(
											listing.pricePerShare || 0,
										).toLocaleString("en-IN")}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Quantity:</span>
									<span className="font-medium">
										{listing.quantity?.toLocaleString("en-IN")} shares
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Total Value:</span>
									<span className="font-semibold">
										₹
										{(
											Number.parseFloat(listing.pricePerShare || 0) *
											(listing.quantity || 0)
										).toLocaleString("en-IN")}
									</span>
								</div>
							</div>

							<div className="flex gap-2">
								<Button
									size="sm"
									className="flex-1"
									onClick={() =>
										setLocation(`/unlisted/company/${listing.companyId}`)
									}
									data-testid={`button-view-listing-${listing.id}`}
								>
									<Eye className="w-4 h-4 mr-1" />
									View Details
								</Button>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{filteredListings.length === 0 && searchQuery && (
				<div className="text-center py-8 text-muted-foreground">
					No listings found matching "{searchQuery}"
				</div>
			)}
		</div>
	);
}

// AI Picks Section - AI-powered recommendations for unlisted stocks
function AIPicksSection() {
	const [, setLocation] = useLocation();
	const [riskProfile, setRiskProfile] = useState<string>("moderate");
	const [investmentGoal, setInvestmentGoal] = useState<string>("growth");

	const buildQueryString = () => {
		const params = new URLSearchParams();
		if (riskProfile) params.append("riskProfile", riskProfile);
		if (investmentGoal) params.append("investmentGoal", investmentGoal);
		return params.toString();
	};

	const { data, isLoading, refetch } = useQuery<any>({
		queryKey: ["/api/unlisted/ai-recommendations", riskProfile, investmentGoal],
		queryFn: async () => {
			const queryString = buildQueryString();
			const response = await fetch(
				`/api/unlisted/ai-recommendations?${queryString}`,
			);
			if (!response.ok) throw new Error("Failed to fetch recommendations");
			const result = await response.json();
			return result.data || result;
		},
	});

	const getSignalColor = (signal: string) => {
		switch (signal) {
			case "buy":
				return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
			case "hold":
				return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200";
			case "avoid":
				return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
			default:
				return "bg-muted text-foreground";
		}
	};

	const getRiskColor = (risk: string) => {
		switch (risk) {
			case "low":
				return "text-green-600";
			case "moderate":
				return "text-yellow-600";
			case "high":
				return "text-orange-600";
			case "very_high":
				return "text-red-600";
			default:
				return "text-muted-foreground";
		}
	};

	return (
		<div className="space-y-6">
			<Card data-testid="card-ai-unlisted-filters">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="w-5 h-5 text-purple-500" />
						AI-Powered Recommendations
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-4">
						Get personalized pre-IPO and unlisted stock recommendations based on
						your investment profile.
					</p>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<Label htmlFor="select-risk-profile-trigger" className="block text-sm font-medium mb-2">
								Risk Profile
							</Label>
							<Select value={riskProfile} onValueChange={setRiskProfile}>
								<SelectTrigger id="select-risk-profile-trigger" data-testid="select-unlisted-risk-profile">
									<SelectValue placeholder="Select risk profile" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="conservative">Conservative</SelectItem>
									<SelectItem value="moderate">Moderate</SelectItem>
									<SelectItem value="aggressive">Aggressive</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label htmlFor="select-invest-goal-trigger" className="block text-sm font-medium mb-2">
								Investment Goal
							</Label>
							<Select value={investmentGoal} onValueChange={setInvestmentGoal}>
								<SelectTrigger id="select-invest-goal-trigger" data-testid="select-unlisted-investment-goal">
									<SelectValue placeholder="Select goal" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="growth">Growth</SelectItem>
									<SelectItem value="income">Income</SelectItem>
									<SelectItem value="balanced">Balanced</SelectItem>
									<SelectItem value="capital_preservation">
										Capital Preservation
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-end">
							<Button
								onClick={() => refetch()}
								className="w-full"
								data-testid="button-get-unlisted-recommendations"
							>
								<Sparkles className="w-4 h-4 mr-2" />
								Get Recommendations
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{data?.summary && (
				<Card
					className="bg-gradient-to-r from-purple-50 dark:from-purple-950/30 to-blue-50 dark:to-blue-950/30"
					data-testid="card-ai-unlisted-summary"
				>
					<CardContent className="py-4">
						<div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
							<div>
								<div className="text-2xl font-bold text-purple-600">
									{data.summary.totalRecommendations}
								</div>
								<div className="text-xs text-muted-foreground">
									Recommendations
								</div>
							</div>
							<div>
								<div className="text-2xl font-bold text-green-600">
									{data.summary.buySignals}
								</div>
								<div className="text-xs text-muted-foreground">Buy Signals</div>
							</div>
							<div>
								<div className="text-2xl font-bold text-yellow-600">
									{data.summary.holdSignals}
								</div>
								<div className="text-xs text-muted-foreground">Hold</div>
							</div>
							<div>
								<div className="text-2xl font-bold text-red-600">
									{data.summary.avoidSignals}
								</div>
								<div className="text-xs text-muted-foreground">Avoid</div>
							</div>
							<div>
								<div className="text-2xl font-bold text-blue-600">
									{data.summary.avgConfidence}%
								</div>
								<div className="text-xs text-muted-foreground">
									Avg Confidence
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{isLoading ? (
				<LoadingState />
			) : !data?.recommendations || data.recommendations.length === 0 ? (
				<EmptyState
					icon={Sparkles}
					title="No Recommendations Available"
					description="There are currently no unlisted companies available for AI recommendations. Check back later."
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{data.recommendations.map((rec: any, index: number) => (
						<Card
							key={rec.companyId || index}
							className="hover:shadow-md transition-shadow"
							data-testid={`ai-unlisted-rec-${index}`}
						>
							<CardContent className="p-4">
								<div className="flex justify-between items-start mb-3">
									<div>
										<h4 className="font-semibold text-lg">{rec.name}</h4>
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<span>{rec.sector || "Technology"}</span>
											<span>•</span>
											<span className="capitalize">
												{rec.listingStage?.replace("_", " ") || "Unlisted"}
											</span>
										</div>
									</div>
									<Badge className={getSignalColor(rec.aiSignal)}>
										{rec.aiSignal === "buy" && (
											<CheckCircle className="w-3 h-3 mr-1" />
										)}
										{rec.aiSignal === "avoid" && (
											<AlertTriangle className="w-3 h-3 mr-1" />
										)}
										{rec.aiSignal?.toUpperCase()}
									</Badge>
								</div>

								<div className="grid grid-cols-2 gap-2 text-sm mb-3">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Price:</span>
										<span className="font-medium">
											₹
											{Number.parseFloat(rec.currentPrice || 0).toLocaleString(
												"en-IN",
											)}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Target:</span>
										<span className="font-medium text-green-600">
											₹
											{Number.parseFloat(rec.aiTargetPrice || 0).toLocaleString(
												"en-IN",
											)}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Upside:</span>
										<span className="font-medium text-green-600">
											{rec.potentialUpside}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Confidence:</span>
										<span className="font-medium">{rec.aiConfidence}%</span>
									</div>
								</div>

								<div className="flex items-center gap-2 mb-3">
									<Target className="w-4 h-4 text-blue-500" />
									<span className="text-sm">
										Suitability: {rec.suitabilityScore}/100
									</span>
									<div className="flex-1 bg-muted rounded-full h-2">
										<div
											className="bg-blue-500 h-2 rounded-full"
											style={{ width: `${rec.suitabilityScore}%` }}
										/>
									</div>
								</div>

								<div className="mb-3">
									<p className="text-sm text-muted-foreground italic">
										{rec.aiRationale}
									</p>
								</div>

								{rec.keyStrengths && rec.keyStrengths.length > 0 && (
									<div className="mb-2">
										<div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
											Strengths:
										</div>
										<div className="flex flex-wrap gap-1">
											{rec.keyStrengths
												.slice(0, 2)
												.map((s: string, i: number) => (
													<Badge
														key={i}
														variant="outline"
														className="text-xs bg-green-50 dark:bg-green-950/30"
													>
														{s}
													</Badge>
												))}
										</div>
									</div>
								)}

								{rec.keyRisks && rec.keyRisks.length > 0 && (
									<div className="mb-3">
										<div className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
											Risks:
										</div>
										<div className="flex flex-wrap gap-1">
											{rec.keyRisks.slice(0, 2).map((r: string, i: number) => (
												<Badge
													key={i}
													variant="outline"
													className="text-xs bg-orange-50 dark:bg-orange-950/30"
												>
													{r}
												</Badge>
											))}
										</div>
									</div>
								)}

								<div className="flex items-center justify-between pt-2 border-t">
									<div
										className={`text-xs font-medium ${getRiskColor(rec.riskLevel)}`}
									>
										{rec.riskLevel?.replace("_", " ").toUpperCase()} RISK
									</div>
									<Button
										size="sm"
										onClick={() =>
											setLocation(`/unlisted/company/${rec.companyId}`)
										}
										data-testid={`button-view-unlisted-${rec.companyId}`}
									>
										View Details
										<ArrowUpRight className="w-4 h-4 ml-1" />
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{data?.summary?.disclaimer && (
				<Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
					<CardContent className="py-3">
						<div className="flex items-start gap-2">
							<AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
							<p className="text-xs text-amber-800 dark:text-amber-200">
								{data.summary.disclaimer}
							</p>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-IPO Runway Section: Displays the transition from Unlisted to Pre-IPO to IPO
// ─────────────────────────────────────────────────────────────────────────────

interface PreIpoDeal {
	id: string;
	companyName: string;
	sector?: string;
	expectedIssueSize?: string;
	priceBand?: string;
	targetListingDate?: string;
	minTicketSize?: string;
	leadBankers?: string[];
	currentStage?: string;
	stageProgress?: number;
	gmp?: string;
	rhpUrl?: string;
	proposedExchange?: string;
	description?: string;
}

function PreIpoRunwaySection() {
	const { toast } = useToast();
	const { data: preIpoRes, isLoading } = useQuery<{ success: boolean; data: PreIpoDeal[] }>({
		queryKey: ["/api/pre-ipo/upcoming"],
		refetchInterval: 60000,
	});

	const [interestDialogOpen, setInterestDialogOpen] = useState(false);
	const [selectedDeal, setSelectedDeal] = useState<PreIpoDeal | null>(null);
	const [clientName, setClientName] = useState("");
	const [clientPhone, setClientPhone] = useState("");
	const [clientEmail, setClientEmail] = useState("");
	const [investorCategory, setInvestorCategory] = useState("retail");
	const [lots, setLots] = useState(1);
	const [riskAck, setRiskAck] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const deals = preIpoRes?.data || [];

	const handleOpenInterest = (deal: PreIpoDeal) => {
		setSelectedDeal(deal);
		setClientName("");
		setClientPhone("");
		setClientEmail("");
		setInvestorCategory("retail");
		setLots(1);
		setRiskAck(false);
		setInterestDialogOpen(true);
	};

	const handleSubmitInterest = async () => {
		if (!selectedDeal) return;
		if (!clientName.trim() || !clientPhone.trim()) {
			toast({
				title: "Required Fields Missing",
				description: "Please enter your name and phone number.",
				variant: "destructive",
			});
			return;
		}
		if (!riskAck) {
			toast({
				title: "SEBI Risk Acknowledgment Required",
				description: "Please confirm that you understand the illiquidity and market risk of pre-IPO securities.",
				variant: "destructive",
			});
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch("/api/pre-ipo/interest", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					companyId: selectedDeal.id,
					companyName: selectedDeal.companyName,
					clientName: clientName.trim(),
					clientPhone: clientPhone.trim(),
					clientEmail: clientEmail.trim() || undefined,
					investorCategory,
					requestedLots: Number(lots) || 1,
					estimatedAmount: selectedDeal.minTicketSize,
				}),
			});
			const result = await res.json();
			if (!res.ok || !result.success) {
				throw new Error(result.error?.message || "Failed to submit interest");
			}
			toast({
				title: "Allocation Interest Recorded",
				description: `Interest registered for ${selectedDeal.companyName}. Our institutional desk will reach out.`,
			});
			setInterestDialogOpen(false);
		} catch (err: any) {
			toast({
				title: "Submission Error",
				description: err?.message || "Failed to record allocation interest.",
				variant: "destructive",
			});
		} finally {
			setSubmitting(false);
		}
	};

	const handleShareTeaser = (deal: PreIpoDeal) => {
		const text = `🚀 *Pre-IPO Opportunity: ${deal.companyName}*\n` +
			`Sector: ${deal.sector || "Growth Equity"}\n` +
			`Expected Issue: ${deal.expectedIssueSize || "TBD"}\n` +
			`Price Band: ${deal.priceBand || "Indicative"}\n` +
			`Target Date: ${deal.targetListingDate || "Preparing"}\n` +
			`Min Ticket: ${deal.minTicketSize || "₹10,000"}\n\n` +
			`Explore allocation: https://app.fintekpro.com/unlisted?tab=pre-ipo\n\n` +
			`⚠️ *SEBI Regulatory Disclaimer:* Pre-IPO investments carry market & illiquidity risk. For Accredited / HNI investors only.`;

		navigator.clipboard.writeText(text);
		toast({
			title: "Teaser Copied to Clipboard",
			description: `Teaser for ${deal.companyName} copied with SEBI disclaimer.`,
		});
	};

	return (
		<div className="space-y-8" data-testid="pre-ipo-runway-section">
			{/* 4-Stage Continuum Stepper Card */}
			<Card className="border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-background dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-background">
				<CardHeader className="pb-3">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
						<div>
							<Badge className="bg-blue-600 text-white hover:bg-blue-700 text-xs mb-1">
								Private to Public Continuum
							</Badge>
							<CardTitle className="text-xl font-bold flex items-center gap-2">
								<Rocket className="h-5 w-5 text-blue-600 dark:text-blue-400" />
								Pre-IPO Runway: Transition from Unlisted to Listed
							</CardTitle>
						</div>
						<Link href="/ipo">
							<Button variant="outline" size="sm" className="text-xs text-blue-600 border-blue-300 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400">
								View Live Public IPOs
								<ArrowRight className="w-3.5 h-3.5 ml-1" />
							</Button>
						</Link>
					</div>
					<p className="text-xs text-muted-foreground mt-1">
						FintekPro tracks companies as they advance through private growth rounds, DRHP filings, price discovery, and final exchange listing.
					</p>
				</CardHeader>
				<CardContent>
					{/* Stepper Visualization */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 pb-1">
						<div className="p-3 rounded-lg border bg-background/80 relative">
							<div className="text-xs font-semibold text-muted-foreground mb-1">Stage 1</div>
							<div className="font-bold text-sm text-foreground flex items-center gap-1.5">
								<Building2 className="w-4 h-4 text-slate-500" />
								Unlisted Equity
							</div>
							<p className="text-[11px] text-muted-foreground mt-1">
								Private cap-table shares, secondary trading, and growth rounds.
							</p>
						</div>

						<div className="p-3 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/40 relative shadow-sm">
							<Badge className="absolute -top-2.5 right-2 bg-blue-600 text-[10px] text-white py-0 px-1.5">
								Current Hub
							</Badge>
							<div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Stage 2</div>
							<div className="font-bold text-sm text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
								<Rocket className="w-4 h-4 text-blue-600" />
								Pre-IPO Runway
							</div>
							<p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-1">
								DRHP filed, banker syndicate mandated, price band & GMP tracked.
							</p>
						</div>

						<div className="p-3 rounded-lg border bg-background/80 relative">
							<div className="text-xs font-semibold text-muted-foreground mb-1">Stage 3</div>
							<div className="font-bold text-sm text-foreground flex items-center gap-1.5">
								<Clock className="w-4 h-4 text-emerald-600" />
								Public IPO Bidding
							</div>
							<p className="text-[11px] text-muted-foreground mt-1">
								SEBI Mainboard & SME open bidding, subscription, and allotment.
							</p>
						</div>

						<div className="p-3 rounded-lg border bg-background/80 relative">
							<div className="text-xs font-semibold text-muted-foreground mb-1">Stage 4</div>
							<div className="font-bold text-sm text-foreground flex items-center gap-1.5">
								<Landmark className="w-4 h-4 text-indigo-600" />
								NSE / BSE Listed
							</div>
							<p className="text-[11px] text-muted-foreground mt-1">
								Real-time continuous secondary market liquidity on exchanges.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Pre-IPO Deals Grid */}
			{isLoading ? (
				<LoadingState variant="card" count={6} />
			) : deals.length === 0 ? (
				<EmptyState
					icon={Rocket}
					title="No Pre-IPO Deals Available"
					description="New pre-IPO investment opportunities will appear as companies file their DRHP with SEBI."
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{deals.map((deal) => {
						const progressPercent = deal.stageProgress ?? 50;
						const stageLabel = deal.currentStage || "DRHP Prepared";

						return (
							<Card
								key={deal.id}
								className="hover:shadow-lg transition-all duration-200 border-border/80 flex flex-col justify-between"
								data-testid={`pre-ipo-deal-${deal.id}`}
							>
								<CardHeader className="pb-2">
									<div className="flex items-center justify-between gap-2 mb-2">
										<Badge variant="outline" className="text-xs uppercase font-medium">
											{deal.sector || "Unlisted Growth"}
										</Badge>
										{deal.gmp && (
											<Badge className="bg-emerald-600 text-white text-xs font-semibold">
												{deal.gmp.startsWith("+") ? deal.gmp : `+${deal.gmp}`} GMP
											</Badge>
										)}
									</div>
									<CardTitle className="text-lg font-bold text-foreground">
										{deal.companyName}
									</CardTitle>
									<p className="text-xs text-muted-foreground">
										Proposed Exchange: {deal.proposedExchange || "NSE / BSE (Proposed)"}
									</p>
								</CardHeader>

								<CardContent className="space-y-4 pt-1">
									{/* IPO Progress Stepper */}
									<div className="space-y-1.5 p-2.5 rounded-md bg-muted/40 border">
										<div className="flex justify-between items-center text-xs">
											<span className="text-muted-foreground font-medium">IPO Progress</span>
											<span className="text-blue-600 dark:text-blue-400 font-semibold">{stageLabel}</span>
										</div>
										<Progress value={progressPercent} className="h-1.5 bg-muted" />
										<div className="flex justify-between text-[10px] text-muted-foreground pt-0.5">
											<span>DRHP Filed</span>
											<span>SEBI Review</span>
											<span>Price Band</span>
											<span>Listing</span>
										</div>
									</div>

									{/* 4 Metrics Quadrant */}
									<div className="grid grid-cols-2 gap-2 text-xs">
										<div className="p-2 rounded bg-muted/30">
											<span className="text-muted-foreground block text-[11px]">Expected Issue</span>
											<span className="font-semibold text-foreground">{deal.expectedIssueSize || "Estimated ₹1,500 Cr"}</span>
										</div>
										<div className="p-2 rounded bg-muted/30">
											<span className="text-muted-foreground block text-[11px]">Price Band</span>
											<span className="font-semibold text-foreground">{deal.priceBand || "Indicative"}</span>
										</div>
										<div className="p-2 rounded bg-muted/30">
											<span className="text-muted-foreground block text-[11px]">Target Date</span>
											<span className="font-semibold text-foreground">{deal.targetListingDate || "Expected H2 2025"}</span>
										</div>
										<div className="p-2 rounded bg-muted/30">
											<span className="text-muted-foreground block text-[11px]">Min Ticket</span>
											<span className="font-semibold text-foreground">{deal.minTicketSize || "₹10,000"}</span>
										</div>
									</div>

									{/* Lead Bankers */}
									{deal.leadBankers && deal.leadBankers.length > 0 && (
										<div className="text-xs text-muted-foreground flex items-center gap-1.5">
											<Landmark className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
											<span className="truncate">Bankers: {deal.leadBankers.join(", ")}</span>
										</div>
									)}

									{/* CTAs */}
									<div className="flex gap-2 pt-2">
										<Button
											variant="outline"
											size="sm"
											className="flex-1 text-xs cursor-pointer"
											onClick={() => handleShareTeaser(deal)}
										>
											<Share2 className="w-3.5 h-3.5 mr-1" />
											Share Teaser
										</Button>
										<Button
											size="sm"
											className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
											onClick={() => handleOpenInterest(deal)}
										>
											<Send className="w-3.5 h-3.5 mr-1" />
											Request Allocation
										</Button>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			{/* Allocation Request Modal */}
			<Dialog open={interestDialogOpen} onOpenChange={setInterestDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Rocket className="h-5 w-5 text-blue-600" />
							Request Pre-IPO Allocation
						</DialogTitle>
						<DialogDescription>
							Submit your interest for <span className="font-semibold text-foreground">{selectedDeal?.companyName}</span>. Our institutional desk will reach out with allocation specifics.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2 text-sm">
						<div className="space-y-1.5">
							<Label htmlFor="req-name">Full Name *</Label>
							<Input
								id="req-name"
								placeholder="Enter full name"
								value={clientName}
								onChange={(e) => setClientName(e.target.value)}
							/>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1.5">
								<Label htmlFor="req-phone">Phone Number *</Label>
								<Input
									id="req-phone"
									placeholder="+91 98765 43210"
									value={clientPhone}
									onChange={(e) => setClientPhone(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="req-email">Email Address</Label>
								<Input
									id="req-email"
									type="email"
									placeholder="client@example.com"
									value={clientEmail}
									onChange={(e) => setClientEmail(e.target.value)}
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1.5">
								<Label>Investor Category</Label>
								<Select value={investorCategory} onValueChange={setInvestorCategory}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="retail">Retail (&lt; ₹2 Lakhs)</SelectItem>
										<SelectItem value="hni">HNI (&gt; ₹2 Lakhs)</SelectItem>
										<SelectItem value="accredited">SEBI Accredited</SelectItem>
										<SelectItem value="corporate">Corporate / Family Office</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="req-lots">Requested Lots</Label>
								<Input
									id="req-lots"
									type="number"
									min={1}
									max={50}
									value={lots}
									onChange={(e) => setLots(Math.max(1, Number(e.target.value) || 1))}
								/>
							</div>
						</div>

						<div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
							<div className="flex items-start gap-2">
								<Checkbox
									id="req-ack"
									checked={riskAck}
									onCheckedChange={(c) => setRiskAck(Boolean(c))}
									className="mt-0.5"
								/>
								<Label htmlFor="req-ack" className="text-xs text-amber-900 dark:text-amber-200 leading-tight cursor-pointer">
									I understand that Pre-IPO securities are unlisted, illiquid, and carry substantial market risk. Allocation is subject to availability and regulatory approvals.
								</Label>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setInterestDialogOpen(false)} disabled={submitting}>
							Cancel
						</Button>
						<Button
							className="bg-blue-600 hover:bg-blue-700 text-white"
							onClick={handleSubmitInterest}
							disabled={submitting}
						>
							{submitting ? "Submitting..." : "Submit Allocation Request"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// Main Unlisted Securities Page
export default function Unlisted() {
	const [location, setLocation] = useLocation();

	// Navigation state for responsive layout
	const [_isNavCollapsed, setIsNavCollapsed] = useState(() => {
		try {
			const saved = localStorage.getItem("navigation-collapsed");
			return saved ? JSON.parse(saved) : false;
		} catch {
			return false;
		}
	});

	// Listen for navigation state changes
	useEffect(() => {
		const handleNavChange = (event: CustomEvent) => {
			setIsNavCollapsed(event.detail.isCollapsed);
		};

		window.addEventListener(
			"navigation-state-changed",
			handleNavChange as EventListener,
		);
		return () =>
			window.removeEventListener(
				"navigation-state-changed",
				handleNavChange as EventListener,
			);
	}, []);

	const [selectedTab, setSelectedTab] = useState(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			return params.get("tab") || "explore";
		}
		return "explore";
	});

	useEffect(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			const tab = params.get("tab");
			if (tab && tab !== selectedTab) {
				setSelectedTab(tab);
			}
		}
	}, [location]);

	const handleTabChange = (tab: string) => {
		setSelectedTab(tab);
		if (typeof window !== "undefined") {
			const url = new URL(window.location.href);
			url.searchParams.set("tab", tab);
			window.history.replaceState({}, "", url.toString());
		}
	};

	return (
		<div className="min-h-screen bg-finance-light" data-testid="unlisted-page">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-8" data-testid="unlisted-header">
					<div className="flex items-center gap-3 mb-4">
						<Gem className="w-8 h-8 text-finance-blue" />
						<div>
							<h1 className="text-3xl font-bold text-foreground">
								Unlisted & Pre-IPO Securities
							</h1>
							<p className="text-muted-foreground">
								Exclusive access to private equity, late-stage growth rounds, and Pre-IPO pipeline tracking
							</p>
						</div>
					</div>
				</div>

				<Tabs
					value={selectedTab}
					onValueChange={handleTabChange}
					className="w-full"
				>
					<ScrollableTabsList className="grid w-full grid-cols-8">
						<TabsTrigger value="explore" data-testid="tab-explore">
							Explore
						</TabsTrigger>
						<TabsTrigger value="pre-ipo" data-testid="tab-pre-ipo" className="gap-1">
							<Rocket className="w-4 h-4 text-blue-600" />
							Pre-IPO Runway
							<Badge variant="secondary" className="ml-1 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 py-0 px-1">
								DRHP
							</Badge>
						</TabsTrigger>
						<TabsTrigger value="marketplace" data-testid="tab-marketplace">
							<Store className="w-4 h-4 mr-1" />
							Marketplace
						</TabsTrigger>
						<TabsTrigger value="ai-picks" data-testid="tab-ai-picks">
							<Sparkles className="w-4 h-4 mr-1" />
							AI Picks
						</TabsTrigger>
						<TabsTrigger value="portfolio" data-testid="tab-portfolio">
							My Investments
						</TabsTrigger>
						<TabsTrigger value="watchlist" data-testid="tab-watchlist">
							Watchlist
						</TabsTrigger>
						<TabsTrigger value="education" data-testid="tab-education">
							Learn
						</TabsTrigger>
						<TabsTrigger value="history" data-testid="tab-history">
							<Database className="h-4 w-4 mr-2" />
							History
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent
						value="pre-ipo"
						className="space-y-6"
						data-testid="pre-ipo-unlisted"
					>
						<PreIpoRunwaySection />
					</TabsContent>

					<TabsContent
						value="marketplace"
						className="space-y-6"
						data-testid="marketplace-unlisted"
					>
						<MarketplaceSection />
					</TabsContent>

					<TabsContent
						value="ai-picks"
						className="space-y-6"
						data-testid="ai-picks-unlisted"
					>
						<AIPicksSection />
					</TabsContent>

					<TabsContent
						value="explore"
						className="space-y-6"
						data-testid="explore-unlisted"
					>
						<UnlistedCategoriesSection onSelectTab={handleTabChange} />

						{/* Featured Opportunities */}
						<Card data-testid="card-featured-opportunities">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Star className="w-5 h-5 text-yellow-500" />
									Featured Opportunities
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{[
										{
											name: "Flipkart Pre-IPO",
											sector: "E-commerce",
											valuation: "₹3.7L Cr",
											minInvestment: "₹2,00,000",
											expectedReturn: "25-35%",
											timeFrame: "12-18 months",
											badge: "Hot Deal",
										},
										{
											name: "Zerodha Secondary",
											sector: "Fintech",
											valuation: "₹58,000 Cr",
											minInvestment: "₹5,00,000",
											expectedReturn: "15-25%",
											timeFrame: "6-12 months",
											badge: "Limited Slots",
										},
										{
											name: "OYO ESOP Buyback",
											sector: "Hospitality",
											valuation: "₹45,000 Cr",
											minInvestment: "₹1,00,000",
											expectedReturn: "10-20%",
											timeFrame: "3-6 months",
											badge: "New",
										},
									].map((opportunity, index) => (
										<Card
											key={index}
											className="border-l-4 border-l-finance-blue"
										>
											<CardContent className="p-4">
												<div className="flex justify-between items-start mb-2">
													<h4 className="font-semibold">{opportunity.name}</h4>
													<Badge variant="secondary">{opportunity.badge}</Badge>
												</div>
												<p className="text-sm text-muted-foreground mb-3">
													{opportunity.sector}
												</p>
												<div className="space-y-1 text-sm">
													<div className="flex justify-between">
														<span>Valuation:</span>
														<span className="font-medium">
															{opportunity.valuation}
														</span>
													</div>
													<div className="flex justify-between">
														<span>Min Investment:</span>
														<span className="font-medium">
															{opportunity.minInvestment}
														</span>
													</div>
													<div className="flex justify-between">
														<span>Expected Return:</span>
														<span className="font-medium text-green-600">
															{opportunity.expectedReturn}
														</span>
													</div>
													<div className="flex justify-between">
														<span>Time Frame:</span>
														<span className="font-medium">
															{opportunity.timeFrame}
														</span>
													</div>
												</div>
												<div className="flex gap-2 mt-4">
													<Button size="sm" className="flex-1">
														<Eye className="w-4 h-4 mr-1" />
														View Details
													</Button>
													<Button size="sm" variant="outline">
														<Lock className="w-4 h-4" />
													</Button>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							</CardContent>
						</Card>

						{/* Investment Calculator */}
						<Card data-testid="card-unlisted-calculator">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Calculator className="w-5 h-5 text-finance-blue" />
									Unlisted Investment Calculator
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<Label htmlFor="unlisted-calc-amount" className="block text-sm font-medium mb-2">
											Investment Amount
										</Label>
										<Input id="unlisted-calc-amount" placeholder="₹1,00,000" />
									</div>
									<div>
										<Label htmlFor="unlisted-calc-return" className="block text-sm font-medium mb-2">
											Expected Return (%)
										</Label>
										<Input id="unlisted-calc-return" placeholder="25" />
									</div>
									<div>
										<Label htmlFor="unlisted-calc-period" className="block text-sm font-medium mb-2">
											Time Period (Years)
										</Label>
										<Input id="unlisted-calc-period" placeholder="2" />
									</div>
								</div>
								<Button className="mt-4">Calculate Returns</Button>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="portfolio"
						className="space-y-6"
						data-testid="unlisted-portfolio"
					>
						<Card>
							<CardHeader>
								<CardTitle>My Unlisted Investments</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground">
									Start investing in unlisted securities to track your portfolio
									here.
								</p>
								<Button
									className="mt-4"
									onClick={() => setLocation("/unlisted/browse")}
									data-testid="button-explore-opportunities"
								>
									Explore Opportunities
								</Button>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="watchlist"
						className="space-y-6"
						data-testid="unlisted-watchlist"
					>
						<Card>
							<CardHeader>
								<CardTitle>My Watchlist</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground">
									Add unlisted securities to your watchlist to get updates on
									pricing and availability.
								</p>
								<Button
									className="mt-4"
									onClick={() => setLocation("/unlisted/browse")}
									data-testid="button-browse-securities"
								>
									Browse Securities
								</Button>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="education"
						className="space-y-6"
						data-testid="unlisted-education"
					>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle>Understanding Unlisted Securities</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground mb-4">
										Learn about the risks and opportunities in unlisted
										securities investing.
									</p>
									<Button variant="outline">Read Guide</Button>
								</CardContent>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>Pre-IPO Investment Strategy</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground mb-4">
										Discover how to evaluate pre-IPO opportunities and build a
										diversified portfolio.
									</p>
									<Button variant="outline">Learn More</Button>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent
						value="history"
						className="space-y-6"
						data-testid="unlisted-history"
					>
						<ClientTransactionHistory category="unlisted" />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
