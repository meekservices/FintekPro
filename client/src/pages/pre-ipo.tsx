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
import { ActionButtonWithNudge } from "@/components/kyc/kyc-gap-nudge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	TrendingUp,
	TrendingDown,
	Building,
	Calendar,
	Target,
	IndianRupee,
	AlertTriangle,
	PieChart,
	BarChart3,
	Info,
	Star,
	ArrowRight,
	Building2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

export default function PreIPOPage() {
	const { toast } = useToast();
	const [selectedTab, setSelectedTab] = useState("overview");
	const [investmentAmount, setInvestmentAmount] = useState("");
	const [selectedCompany, setSelectedCompany] = useState<any>(null);

	// Pre-IPO Allocation Interest state
	const [interestDialogOpen, setInterestDialogOpen] = useState(false);
	const [interestCompany, setInterestCompany] = useState<any>(null);
	const [interestClientName, setInterestClientName] = useState("");
	const [interestClientPhone, setInterestClientPhone] = useState("");
	const [interestClientEmail, setInterestClientEmail] = useState("");
	const [interestCategory, setInterestCategory] = useState("retail");
	const [interestLots, setInterestLots] = useState(1);
	const [interestAck, setInterestAck] = useState(false);
	const [submittingInterest, setSubmittingInterest] = useState(false);

	const handleOpenInterest = (company: any) => {
		setInterestCompany(company);
		setInterestClientName("");
		setInterestClientPhone("");
		setInterestClientEmail("");
		setInterestCategory("retail");
		setInterestLots(1);
		setInterestAck(false);
		setInterestDialogOpen(true);
	};

	const handleSubmitInterest = async () => {
		if (!interestCompany) return;
		if (!interestClientName.trim() || !interestClientPhone.trim()) {
			toast({
				title: "Required Fields Missing",
				description: "Please enter your name and contact phone number.",
				variant: "destructive",
			});
			return;
		}
		if (!interestAck) {
			toast({
				title: "Acknowledgment Required",
				description: "Please confirm that you understand the illiquidity and market risk of pre-IPO securities.",
				variant: "destructive",
			});
			return;
		}

		setSubmittingInterest(true);
		try {
			const res = await fetch("/api/pre-ipo/interest", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					companyId: interestCompany.id,
					companyName: interestCompany.companyName,
					clientName: interestClientName.trim(),
					clientPhone: interestClientPhone.trim(),
					clientEmail: interestClientEmail.trim() || undefined,
					investorCategory: interestCategory,
					requestedLots: Number(interestLots) || 1,
					estimatedAmount: interestCompany.minInvestment,
				}),
			});
			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error?.message || "Failed to record interest");
			}

			toast({
				title: "Allocation Interest Submitted",
				description: `Application ${data.data?.applicationId || "received"} recorded. Our institutional allocation desk will contact you.`,
			});
			setInterestDialogOpen(false);
			setInterestCompany(null);
		} catch (err: any) {
			toast({
				title: "Submission Error",
				description: err?.message || "Failed to submit allocation interest.",
				variant: "destructive",
			});
		} finally {
			setSubmittingInterest(false);
		}
	};

	// Fetch Pre-IPO data
	const { data: companies, isLoading: companiesLoading } = useQuery<any>({
		queryKey: ["/api/pre-ipo/companies"],
		refetchInterval: 30000,
	});

	const { data: myInvestments, isLoading: investmentsLoading } = useQuery<any>({
		queryKey: ["/api/pre-ipo/my-investments"],
		refetchInterval: 30000,
	});

	const { data: marketStats } = useQuery<any>({
		queryKey: ["/api/pre-ipo/market-stats"],
		refetchInterval: 60000,
	});

	const { data: marketInsights } = useQuery<any>({
		queryKey: ["/api/pre-ipo/market-insights"],
		refetchInterval: 300000,
	});

	const { data: upcomingIPOs } = useQuery<any>({
		queryKey: ["/api/pre-ipo/upcoming"],
		refetchInterval: 60000,
	});

	const { data: currentIPOs } = useQuery<any>({
		queryKey: ["/api/pre-ipo/current"],
		refetchInterval: 30000,
	});

	const { data: recentListings } = useQuery<any>({
		queryKey: ["/api/pre-ipo/recent-listings"],
		refetchInterval: 60000,
	});

	const handleInvestment = async (companyId: string) => {
		try {
			const response = await fetch("/api/pre-ipo/invest", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					companyId,
					investmentAmount: Number.parseInt(investmentAmount),
					portfolioId: "default",
				}),
			});

			if (response.ok) {
				window.location.reload();
			}
		} catch (error) {
			console.error("Investment error:", error);
		}
	};

	const getRiskColor = (risk: string) => {
		switch (risk) {
			case "low":
				return "text-green-600 bg-green-50 dark:bg-green-950/30";
			case "medium":
				return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
			case "high":
				return "text-red-600 bg-red-50 dark:bg-red-950/30";
			default:
				return "text-muted-foreground bg-muted";
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "confirmed":
				return "text-green-600 bg-green-50 dark:bg-green-950/30";
			case "pending":
				return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
			case "rejected":
				return "text-red-600 bg-red-50 dark:bg-red-950/30";
			default:
				return "text-muted-foreground bg-muted";
		}
	};

	if (companiesLoading || investmentsLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
					<p className="mt-4 text-muted-foreground">Loading Pre-IPO data...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6 space-y-6" data-testid="pre-ipo-page">
			{/* Header */}
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div>
					<h1
						className="text-3xl font-bold text-foreground"
						data-testid="page-title"
					>
						Pre-IPO Investments
					</h1>
					<p className="text-muted-foreground mt-2">
						Invest in promising companies before they go public
					</p>
				</div>
				<div className="flex gap-2">
					<Badge
						variant="outline"
						className="text-green-600"
						data-testid="market-status"
					>
						<TrendingUp className="w-4 h-4 mr-1" />
						Market Strong
					</Badge>
					<Badge variant="outline" className="text-blue-600">
						{companies?.data?.length || 0} Companies Available
					</Badge>
				</div>
			</div>

			{/* Market Overview Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card data-testid="market-overview-upcoming">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Upcoming IPOs
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-blue-600">
							{marketStats?.data?.totalUpcomingIPOs || 15}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Companies preparing
						</p>
					</CardContent>
				</Card>

				<Card data-testid="market-overview-current">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Active Applications
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							{marketStats?.data?.totalCurrentIPOs || 2}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Open for subscription
						</p>
					</CardContent>
				</Card>

				<Card data-testid="market-overview-amount">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Raised
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-orange-600">
							{marketStats?.data?.totalAmountRaised || "₹45,680 Cr"}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							This fiscal year
						</p>
					</CardContent>
				</Card>

				<Card data-testid="market-overview-gains">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Avg Listing Gains
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-purple-600">
							{marketStats?.data?.averageListingGains || "14.8%"}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Historical average
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Main Content Tabs */}
			<Tabs
				value={selectedTab}
				onValueChange={setSelectedTab}
				className="w-full"
			>
				<ScrollableTabsList className="grid w-full grid-cols-6">
					<TabsTrigger value="overview" data-testid="tab-overview">
						Overview
					</TabsTrigger>
					<TabsTrigger value="companies" data-testid="tab-companies">
						Companies
					</TabsTrigger>
					<TabsTrigger value="portfolio" data-testid="tab-portfolio">
						My Portfolio
					</TabsTrigger>
					<TabsTrigger value="upcoming" data-testid="tab-upcoming">
						Upcoming
					</TabsTrigger>
					<TabsTrigger value="current" data-testid="tab-current">
						Current
					</TabsTrigger>
					<TabsTrigger value="insights" data-testid="tab-insights">
						Insights
					</TabsTrigger>
				</ScrollableTabsList>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* My Investments Summary */}
						<Card data-testid="investments-summary">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<PieChart className="w-5 h-5" />
									My Pre-IPO Portfolio
								</CardTitle>
							</CardHeader>
							<CardContent>
								{myInvestments?.data?.length > 0 ? (
									<div className="space-y-4">
										<div className="grid grid-cols-2 gap-4">
											<div>
												<p className="text-sm text-muted-foreground">
													Total Investment
												</p>
												<p className="text-xl font-semibold">
													₹
													{myInvestments.summary?.totalInvestment?.toLocaleString() ||
														"0"}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Current Value
												</p>
												<p className="text-xl font-semibold text-green-600">
													₹
													{myInvestments.summary?.totalCurrentValue?.toLocaleString() ||
														"0"}
												</p>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-4">
											<div>
												<p className="text-sm text-muted-foreground">
													Unrealized Gains
												</p>
												<p className="text-lg font-semibold text-blue-600">
													₹
													{myInvestments.summary?.totalUnrealizedGains?.toLocaleString() ||
														"0"}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Average ROI
												</p>
												<p className="text-lg font-semibold text-purple-600">
													{myInvestments.summary?.averageROI?.toFixed(1) ||
														"0.0"}
													%
												</p>
											</div>
										</div>
									</div>
								) : (
									<div className="text-center py-8">
										<Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
										<p className="text-muted-foreground">
											No Pre-IPO investments yet
										</p>
										<Button
											className="mt-4"
											onClick={() => setSelectedTab("companies")}
											data-testid="button-browse-companies"
										>
											Browse Companies
										</Button>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Market Trends */}
						<Card data-testid="market-trends">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<BarChart3 className="w-5 h-5" />
									Market Trends
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{marketStats?.data?.monthlyTrend
										?.slice(-3)
										.map((trend: any, index: number) => (
											<div
												key={index}
												className="flex justify-between items-center"
											>
												<div>
													<p className="font-medium">{trend.month} 2025</p>
													<p className="text-sm text-muted-foreground">
														{trend.ipos} IPOs
													</p>
												</div>
												<div className="text-right">
													<p className="font-semibold">{trend.amount}</p>
													<p className="text-sm text-muted-foreground">
														Amount raised
													</p>
												</div>
											</div>
										))}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Recent Activity */}
					<Card data-testid="recent-activity">
						<CardHeader>
							<CardTitle>Recent Listings Performance</CardTitle>
							<CardDescription>
								How recent IPOs performed after listing
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{recentListings?.data?.slice(0, 3).map((listing: any) => (
									<div
										key={listing.id}
										className="flex justify-between items-center p-3 border rounded-lg"
									>
										<div>
											<p className="font-medium">{listing.companyName}</p>
											<p className="text-sm text-muted-foreground">
												{listing.category} • Listed {listing.listingDate}
											</p>
										</div>
										<div className="text-right">
											<p className="font-semibold">₹{listing.currentPrice}</p>
											<Badge
												variant={
													listing.currentGains > 0 ? "default" : "destructive"
												}
												className={
													listing.currentGains > 0
														? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
														: ""
												}
											>
												{listing.currentGains > 0 ? "+" : ""}
												{listing.currentGains}%
											</Badge>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Companies Tab */}
				<TabsContent value="companies" className="space-y-6">
					<div className="grid gap-6">
						{companies?.data?.map((company: any) => (
							<Card
								key={company.id}
								className="hover:shadow-lg transition-shadow"
								data-testid={`company-card-${company.id}`}
							>
								<CardHeader>
									<div className="flex justify-between items-start">
										<div>
											<CardTitle className="text-xl">
												{company.companyName}
											</CardTitle>
											<CardDescription className="mt-2">
												{company.description}
											</CardDescription>
											<div className="flex gap-2 mt-3">
												<Badge variant="outline">{company.sector}</Badge>
												<Badge variant="outline">{company.industry}</Badge>
												<Badge className={getRiskColor(company.riskRating)}>
													{company.riskRating} risk
												</Badge>
											</div>
										</div>
										<div className="text-right">
											<p className="text-sm text-muted-foreground">
												Expected Returns
											</p>
											<p className="text-2xl font-bold text-green-600">
												{company.expectedReturns}%
											</p>
										</div>
									</div>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
										<div>
											<p className="text-sm text-muted-foreground">Valuation</p>
											<p className="font-semibold">
												₹{(company.currentValuation / 10000000).toFixed(0)} Cr
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">
												Revenue Growth
											</p>
											<p className="font-semibold text-green-600">
												{company.revenueGrowthRate}%
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">
												Expected IPO
											</p>
											<p className="font-semibold">{company.expectedIpoDate}</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">
												Min Investment
											</p>
											<p className="font-semibold">
												₹{company.minimumInvestment.toLocaleString()}
											</p>
										</div>
									</div>

									<div className="flex justify-between items-center">
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												data-testid={`button-details-${company.id}`}
											>
												<Info className="w-4 h-4 mr-1" />
												Details
											</Button>
											<Dialog>
												<DialogTrigger asChild>
													<Button
														size="sm"
														disabled={!company.isAvailableForInvestment}
														onClick={() => setSelectedCompany(company)}
														data-testid={`button-invest-${company.id}`}
													>
														<IndianRupee className="w-4 h-4 mr-1" />
														Invest Now
													</Button>
												</DialogTrigger>
												<DialogContent>
													<DialogHeader>
														<DialogTitle>
															Invest in {company.companyName}
														</DialogTitle>
														<DialogDescription>
															Enter your investment amount (minimum ₹
															{company.minimumInvestment.toLocaleString()})
														</DialogDescription>
													</DialogHeader>
													<div className="space-y-4">
														<div>
															<Label htmlFor="investment-amount">
																Investment Amount (₹)
															</Label>
															<Input
																id="investment-amount"
																type="number"
																placeholder={company.minimumInvestment.toString()}
																value={investmentAmount}
																onChange={(e) =>
																	setInvestmentAmount(e.target.value)
																}
																min={company.minimumInvestment}
																data-testid="input-investment-amount"
															/>
														</div>
														<Alert>
															<AlertTriangle className="h-4 w-4" />
															<AlertDescription>
																Pre-IPO investments are high-risk and illiquid
																until the company goes public. Please invest
																only what you can afford to lose.
															</AlertDescription>
														</Alert>
														<ActionButtonWithNudge
															productCode="UNLISTED_SECURITIES"
															onProceed={() => handleInvestment(company.id)}
															className="w-full"
															disabled={
																!investmentAmount ||
																Number.parseInt(investmentAmount) <
																	company.minimumInvestment
															}
															data-testid="button-confirm-investment"
														>
															Confirm Investment
														</ActionButtonWithNudge>
													</div>
												</DialogContent>
											</Dialog>
										</div>
										<div className="text-sm text-muted-foreground">
											{company.availableSlots}/{company.totalInvestmentSlots}{" "}
											slots available
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</TabsContent>

				{/* My Portfolio Tab */}
				<TabsContent value="portfolio" className="space-y-6">
					{myInvestments?.data?.length > 0 ? (
						<div className="space-y-4">
							{myInvestments.data.map((investment: any) => (
								<Card
									key={investment.id}
									data-testid={`investment-card-${investment.id}`}
								>
									<CardHeader>
										<div className="flex justify-between items-start">
											<div>
												<CardTitle>{investment.companyName}</CardTitle>
												<CardDescription>{investment.sector}</CardDescription>
											</div>
											<Badge className={getStatusColor(investment.status)}>
												{investment.status}
											</Badge>
										</div>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
											<div>
												<p className="text-sm text-muted-foreground">
													Investment
												</p>
												<p className="font-semibold">
													₹{investment.investmentAmount.toLocaleString()}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Current Value
												</p>
												<p className="font-semibold">
													₹{investment.currentValuation.toLocaleString()}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Unrealized Gains
												</p>
												<p
													className={`font-semibold ${investment.unrealizedGains >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													₹{investment.unrealizedGains.toLocaleString()}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">ROI</p>
												<p
													className={`font-semibold ${investment.roi >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{investment.roi.toFixed(1)}%
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Expected Listing
												</p>
												<p className="font-semibold">
													{investment.expectedListingDate}
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<Card>
							<CardContent className="text-center py-12">
								<Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
								<h3 className="text-lg font-semibold mb-2">
									No Investments Yet
								</h3>
								<p className="text-muted-foreground mb-4">
									Start building your Pre-IPO portfolio
								</p>
								<Button
									onClick={() => setSelectedTab("companies")}
									data-testid="button-start-investing"
								>
									Start Investing
								</Button>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Upcoming IPOs Tab */}
				<TabsContent value="upcoming" className="space-y-6">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
						<div className="flex items-center gap-3">
							<div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm">
								<Target className="h-5 w-5" />
							</div>
							<div>
								<h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
									Upcoming Pre-IPO & DRHP Pipeline
								</h3>
								<p className="text-xs text-slate-600 dark:text-slate-400">
									Direct institutional allocations in fast-growing unlisted companies prior to public listing on NSE / BSE.
								</p>
							</div>
						</div>
						<Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
							{upcomingIPOs?.data?.length || 0} Opportunities
						</Badge>
					</div>

					<div className="grid gap-4">
						{upcomingIPOs?.data?.map((ipo: any) => {
							const stageSteps = [
								{ key: "drhp_filed", label: "DRHP Filed" },
								{ key: "sebi_review", label: "SEBI Review" },
								{ key: "pricing", label: "Price Band" },
								{ key: "listing", label: "Listing" },
							];
							const getStageIndex = (status?: string) => {
								if (!status) return 0;
								const s = status.toLowerCase();
								if (s.includes("listed")) return 3;
								if (s.includes("pric") || s.includes("roadshow") || s.includes("open")) return 2;
								if (s.includes("sebi") || s.includes("approv") || s.includes("clear")) return 1;
								return 0;
							};
							const currentStageIdx = getStageIndex(ipo.ipoStatus);

							return (
								<Card key={ipo.id} data-testid={`upcoming-ipo-${ipo.id}`} className="hover:shadow-sm transition-shadow border border-slate-200 dark:border-slate-800">
									<CardHeader className="pb-3">
										<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
											<div>
												<div className="flex items-center gap-2 mb-1.5 flex-wrap">
													<Badge variant="outline" className="text-[10px] uppercase font-semibold text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30">
														{ipo.category || "Pre-IPO"}
													</Badge>
													<Badge variant="outline" className="text-[10px]">
														{ipo.exchange || "NSE / BSE"}
													</Badge>
												</div>
												<CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">{ipo.companyName}</CardTitle>
												<CardDescription className="text-xs text-muted-foreground mt-1 max-w-2xl">{ipo.aboutCompany}</CardDescription>
											</div>
											<div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
												{ipo.gmpPercentage > 0 && (
													<Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs px-2.5 py-1">
														GMP +{ipo.gmpPercentage}%
													</Badge>
												)}
												<Button
													size="sm"
													className="bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-sm"
													onClick={() => handleOpenInterest(ipo)}
												>
													Express Interest
												</Button>
											</div>
										</div>

										{/* Stage Stepper */}
										<div className="pt-3 border-t mt-3">
											<div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
												<span className="font-semibold text-slate-700 dark:text-slate-300">IPO Timeline Progress</span>
												<span className="capitalize font-medium text-blue-600 dark:text-blue-400">
													{ipo.subscriptionStatus || stageSteps[currentStageIdx]?.label}
												</span>
											</div>
											<div className="grid grid-cols-4 gap-2">
												{stageSteps.map((step, sIdx) => {
													const isPassed = sIdx <= currentStageIdx;
													const isCurrent = sIdx === currentStageIdx;
													return (
														<div key={step.key} className="flex flex-col items-center">
															<div
																className={`h-1.5 w-full rounded-full transition-colors ${
																	isCurrent
																		? "bg-blue-600 animate-pulse"
																		: isPassed
																		? "bg-blue-400 dark:bg-blue-600"
																		: "bg-slate-200 dark:bg-slate-800"
																}`}
															/>
															<span className={`text-[10px] mt-1 text-center truncate max-w-full ${isCurrent ? "font-bold text-blue-600 dark:text-blue-400" : isPassed ? "text-slate-700 dark:text-slate-300" : "text-muted-foreground/60"}`}>
																{step.label}
															</span>
														</div>
													);
												})}
											</div>
										</div>
									</CardHeader>
									<CardContent className="pt-0">
										<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-xs">
											<div>
												<p className="text-[10px] text-muted-foreground">Expected Issue Size</p>
												<p className="font-bold text-slate-900 dark:text-slate-100">{ipo.issueSize}</p>
											</div>
											<div>
												<p className="text-[10px] text-muted-foreground">Indicative Price Band</p>
												<p className="font-bold text-slate-900 dark:text-slate-100">{ipo.priceRange}</p>
											</div>
											<div>
												<p className="text-[10px] text-muted-foreground">GMP Premium</p>
												<p className="font-bold text-green-600">
													+{ipo.gmpPercentage}%
												</p>
											</div>
											<div>
												<p className="text-[10px] text-muted-foreground">Target Listing Timeline</p>
												<p className="font-bold text-slate-900 dark:text-slate-100">{ipo.openDate}</p>
											</div>
										</div>

										{ipo.leadUnderwriters && ipo.leadUnderwriters.length > 0 && (
											<div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
												<Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
												<span>Lead Underwriters: {ipo.leadUnderwriters.join(", ")}</span>
											</div>
										)}
									</CardContent>
								</Card>
							);
						})}
					</div>
				</TabsContent>

				{/* Current IPOs Tab */}
				<TabsContent value="current" className="space-y-6">
					<div className="grid gap-4">
						{currentIPOs?.data?.map((ipo: any) => (
							<Card key={ipo.id} data-testid={`current-ipo-${ipo.id}`}>
								<CardHeader>
									<div className="flex justify-between items-start">
										<div>
											<CardTitle>{ipo.companyName}</CardTitle>
											<CardDescription>
												{ipo.category} • {ipo.exchange}
											</CardDescription>
										</div>
										<Badge className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300">
											{ipo.dayRemaining} day{ipo.dayRemaining !== 1 ? "s" : ""}{" "}
											left
										</Badge>
									</div>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
											<div>
												<p className="text-sm text-muted-foreground">
													Issue Size
												</p>
												<p className="font-semibold">{ipo.issueSize}</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Price Range
												</p>
												<p className="font-semibold">{ipo.priceRange}</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">GMP</p>
												<p className="font-semibold text-green-600">
													+₹{ipo.gmp} ({ipo.gmpPercentage}%)
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Subscription
												</p>
												<p className="font-semibold">
													{ipo.subscriptionStatus}
												</p>
											</div>
										</div>

										<div className="space-y-2">
											<div className="flex justify-between text-sm">
												<span>Retail: {ipo.retailSubscription}</span>
												<span>HNI: {ipo.hniSubscription}</span>
												<span>
													Institutional: {ipo.institutionalSubscription}
												</span>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</TabsContent>

				{/* Market Insights Tab */}
				<TabsContent value="insights" className="space-y-6">
					<div className="grid gap-6">
						{marketInsights?.data?.map((insight: any, index: number) => (
							<Card
								key={index}
								data-testid={`market-insight-${insight.sector.toLowerCase()}`}
							>
								<CardHeader>
									<div className="flex justify-between items-start">
										<div>
											<CardTitle className="flex items-center gap-2">
												<Target className="w-5 h-5" />
												{insight.sector} Sector
											</CardTitle>
											<CardDescription>
												Market analysis and investment outlook
											</CardDescription>
										</div>
										<Badge
											className={
												insight.marketSentiment === "bullish"
													? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
													: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300"
											}
										>
											{insight.marketSentiment}
										</Badge>
									</div>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
											<div>
												<p className="text-sm text-muted-foreground">
													Avg Valuation
												</p>
												<p className="font-semibold">
													₹{(insight.averageValuation / 10000000).toFixed(0)} Cr
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Success Rate
												</p>
												<p className="font-semibold text-green-600">
													{insight.successRate}%
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Avg IPO Gains
												</p>
												<p className="font-semibold text-blue-600">
													{insight.averageIpoGains}%
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Upcoming IPOs
												</p>
												<p className="font-semibold">{insight.upcomingIpos}</p>
											</div>
										</div>

										<div>
											<h4 className="font-semibold mb-2">AI Analysis</h4>
											<p className="text-muted-foreground text-sm">
												{insight.aiAnalysis}
											</p>
										</div>

										<div>
											<h4 className="font-semibold mb-2">Key Trends</h4>
											<div className="flex flex-wrap gap-2">
												{insight.keyTrends.map((trend: string, i: number) => (
													<Badge key={i} variant="outline">
														{trend}
													</Badge>
												))}
											</div>
										</div>

										<div className="flex justify-between items-center pt-2">
											<Badge
												className={
													insight.investmentRecommendation === "buy"
														? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
														: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300"
												}
											>
												Recommendation: {insight.investmentRecommendation}
											</Badge>
											<div className="flex items-center gap-1">
												<Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
												<span className="text-sm font-medium">
													{insight.confidenceScore}/10
												</span>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</TabsContent>
			</Tabs>

			{/* Client Allocation Interest Dialog */}
			<Dialog open={interestDialogOpen} onOpenChange={setInterestDialogOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-base font-bold">
							<Target className="h-5 w-5 text-blue-600" />
							Express Interest — {interestCompany?.companyName}
						</DialogTitle>
						<DialogDescription className="text-xs">
							Submit your allocation preference for this upcoming Pre-IPO. Our capital markets desk will reach out to guide your bid and allotment verification.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 py-2 text-xs">
						<div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 grid grid-cols-2 gap-2 text-[11px]">
							<div>
								<span className="text-muted-foreground">Price Band:</span>
								<p className="font-semibold text-slate-800 dark:text-slate-200">{interestCompany?.priceRange}</p>
							</div>
							<div>
								<span className="text-muted-foreground">Min Ticket:</span>
								<p className="font-semibold text-slate-800 dark:text-slate-200">{interestCompany?.minInvestment}</p>
							</div>
							<div>
								<span className="text-muted-foreground">GMP Premium:</span>
								<p className="font-semibold text-emerald-600">+{interestCompany?.gmpPercentage}%</p>
							</div>
							<div>
								<span className="text-muted-foreground">Target Date:</span>
								<p className="font-semibold text-slate-800 dark:text-slate-200">{interestCompany?.openDate}</p>
							</div>
						</div>

						<div className="space-y-1">
							<Label className="text-xs">Full Name *</Label>
							<Input
								placeholder="Your legal name"
								value={interestClientName}
								onChange={(e) => setInterestClientName(e.target.value)}
								className="h-8 text-xs"
							/>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1">
								<Label className="text-xs">Mobile / WhatsApp *</Label>
								<Input
									placeholder="+91 98765 43210"
									value={interestClientPhone}
									onChange={(e) => setInterestClientPhone(e.target.value)}
									className="h-8 text-xs"
								/>
							</div>
							<div className="space-y-1">
								<Label className="text-xs">Email Address</Label>
								<Input
									placeholder="you@example.com"
									value={interestClientEmail}
									onChange={(e) => setInterestClientEmail(e.target.value)}
									className="h-8 text-xs"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1">
								<Label className="text-xs">Investor Category</Label>
								<Select value={interestCategory} onValueChange={setInterestCategory}>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="retail">Retail (Up to ₹2 Lakhs)</SelectItem>
										<SelectItem value="hni">HNI (&gt; ₹2 Lakhs)</SelectItem>
										<SelectItem value="ultra_hni">Ultra HNI (&gt; ₹10 Lakhs)</SelectItem>
										<SelectItem value="corporate">Corporate / Institutional</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1">
								<Label className="text-xs">Number of Lots</Label>
								<Input
									type="number"
									min={1}
									value={interestLots}
									onChange={(e) => setInterestLots(Math.max(1, Number(e.target.value) || 1))}
									className="h-8 text-xs"
								/>
							</div>
						</div>

						<div className="flex items-start gap-2 pt-2 border-t">
							<Checkbox
								id="client-pre-ipo-ack"
								checked={interestAck}
								onCheckedChange={(c) => setInterestAck(c === true)}
								className="mt-0.5"
							/>
							<label htmlFor="client-pre-ipo-ack" className="text-[10px] text-muted-foreground leading-relaxed cursor-pointer">
								I acknowledge that Pre-IPO investments are unlisted, illiquid, and carry substantial financial risks. Allocation is subject to availability and SEBI regulatory eligibility.
							</label>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setInterestDialogOpen(false)}
							disabled={submittingInterest}
						>
							Cancel
						</Button>
						<Button
							size="sm"
							className="bg-blue-600 hover:bg-blue-700 text-white"
							onClick={handleSubmitInterest}
							disabled={submittingInterest}
						>
							{submittingInterest ? "Submitting…" : "Confirm Allocation Interest"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
