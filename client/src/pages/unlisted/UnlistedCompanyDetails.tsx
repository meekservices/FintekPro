import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/LoadingState";
import { useToast } from "@/hooks/use-toast";
import {
	Building2,
	TrendingUp,
	IndianRupee,
	Calendar,
	ArrowLeft,
	ShoppingCart,
	DollarSign,
	Activity,
	BarChart3,
	Zap,
	Database,
	Info,
	AlertTriangle,
	RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Tooltip as UITooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import { useState } from "react";
import type {
	UnlistedCompany,
	CompanyFinancials,
	CompanyRatios,
	UnlistedPriceHistory,
	UnlistedDeal,
} from "@shared/schema";

const getDataSourceLabel = (
	source: string | null | undefined,
): { label: string; color: string; description: string } => {
	const sourceConfig: Record<
		string,
		{ label: string; color: string; description: string }
	> = {
		mca: {
			label: "MCA",
			color: "text-green-500",
			description: "Official government filings",
		},
		credhive: {
			label: "Credhive",
			color: "text-blue-500",
			description: "Unlisted company intelligence",
		},
		moneycontrol: {
			label: "MoneyControl",
			color: "text-purple-500",
			description: "Market price data",
		},
		fintekpro: {
			label: "FintekPro",
			color: "text-amber-500",
			description: "Internal database",
		},
	};

	const config =
		sourceConfig[source?.toLowerCase() || ""] || sourceConfig.fintekpro;
	return config;
};

const DataSourceBadge = ({
	source,
}: { source: string | null | undefined }): JSX.Element => {
	const config = getDataSourceLabel(source);

	return (
		<TooltipProvider>
			<UITooltip>
				<TooltipTrigger asChild>
					<span
						className={`inline-flex items-center gap-1 text-xs ${config.color} cursor-help`}
					>
						<Database className="h-3 w-3" />
						{config.label}
					</span>
				</TooltipTrigger>
				<TooltipContent>
					<p className="text-xs">{config.description}</p>
				</TooltipContent>
			</UITooltip>
		</TooltipProvider>
	);
};

interface DataQualityInfo {
	fallbackUsed: boolean;
	fallbackReason?: string;
	warnings: string[];
	primarySourceFailed: boolean;
	sourcesUsed: string[];
	overallScore: number;
	missingData?: string[];
	lastUpdated?: string;
}

const DataQualityWarning = ({
	quality,
}: { quality: DataQualityInfo | null | undefined }): JSX.Element | null => {
	if (!quality) return null;

	const hasWarnings =
		quality.fallbackUsed ||
		quality.warnings.length > 0 ||
		(quality.missingData && quality.missingData.length > 0);
	if (!hasWarnings) return null;

	const isWarning = quality.fallbackUsed || quality.primarySourceFailed;

	return (
		<Alert
			className={`mb-4 ${isWarning ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-blue-500 bg-blue-50 dark:bg-blue-950/20"}`}
			data-testid="alert-data-quality"
		>
			<AlertTriangle
				className={`h-4 w-4 ${isWarning ? "text-amber-500" : "text-blue-500"}`}
			/>
			<AlertTitle className="text-sm font-medium">
				{quality.primarySourceFailed
					? "Using Fallback Data Sources"
					: "Data Quality Notice"}
			</AlertTitle>
			<AlertDescription className="text-xs mt-1">
				{quality.fallbackReason && (
					<p className="mb-1">{quality.fallbackReason}</p>
				)}
				{quality.warnings.length > 0 && (
					<ul className="list-disc list-inside space-y-0.5">
						{quality.warnings.map((warning, i) => (
							<li key={i}>{warning}</li>
						))}
					</ul>
				)}
				{quality.missingData && quality.missingData.length > 0 && (
					<p className="mt-1 text-muted-foreground">
						Missing: {quality.missingData.join(", ")}
					</p>
				)}
				<div className="mt-2 flex items-center gap-4 text-muted-foreground">
					<span>
						Sources:{" "}
						{quality.sourcesUsed.length > 0
							? quality.sourcesUsed.join(", ")
							: "Internal"}
					</span>
					<span>Quality: {quality.overallScore}%</span>
					{quality.lastUpdated && (
						<span>
							Updated: {new Date(quality.lastUpdated).toLocaleDateString()}
						</span>
					)}
				</div>
			</AlertDescription>
		</Alert>
	);
};

export default function UnlistedCompanyDetails() {
	const { id } = useParams<{ id: string }>();
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [selectedYear, setSelectedYear] = useState<string>("");

	// Fetch company details
	const { data: company, isLoading: isLoadingCompany } =
		useQuery<UnlistedCompany>({
			queryKey: ["/api/unlisted/companies", id],
			enabled: !!id,
		});

	// Fetch financials
	const { data: financials = [], isLoading: isLoadingFinancials } = useQuery<
		CompanyFinancials[]
	>({
		queryKey: ["/api/unlisted/companies", id, "financials"],
		enabled: !!id,
	});

	// Fetch ratios
	const { data: ratios = [], isLoading: isLoadingRatios } = useQuery<
		CompanyRatios[]
	>({
		queryKey: ["/api/unlisted/companies", id, "ratios"],
		enabled: !!id,
	});

	// Fetch price history
	const { data: priceHistory = [], isLoading: isLoadingPrice } = useQuery<
		UnlistedPriceHistory[]
	>({
		queryKey: ["/api/unlisted/companies", id, "price-history"],
		enabled: !!id,
	});

	// Fetch deals
	const { data: deals = [], isLoading: isLoadingDeals } = useQuery<
		UnlistedDeal[]
	>({
		queryKey: ["/api/unlisted/deals"],
		enabled: !!id,
	});

	// Fetch data quality from backend (uses unified company data service)
	const { data: dataQuality } = useQuery<DataQualityInfo>({
		queryKey: ["/api/unlisted/companies", id, "data-quality"],
		enabled: !!id && !!company,
	});

	// Research mutation
	const researchMutation = useMutation({
		mutationFn: async () => {
			if (!company?.cin) throw new Error("CIN missing");
			return apiRequest(
				`/api/unlisted/credhive/research/${company.cin}?force=true`,
				{ method: "GET" },
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/unlisted/companies", id],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/unlisted/companies", id, "financials"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/unlisted/companies", id, "ratios"],
			});
			toast({
				title: "Research Complete",
				description: "Financial data has been refreshed from Credhive",
			});
		},
		onError: (error: unknown) => {
			const message =
				error instanceof Error ? error.message : "Failed to refresh data";
			toast({
				title: "Research Failed",
				description: message,
				variant: "destructive",
			});
		},
	});

	const { user } = useAuth();
	const canResearch =
		user?.roles?.includes("admin") || user?.roles?.includes("agent");

	// Fetch MCA Intelligence financial ratios (if company has CIN)
	interface McaFinancialRatios {
		cin: string;
		companyName?: string;
		hasData: boolean;
		latestYear?: string;
		metrics?: {
			revenue: number | null;
			profitAfterTax: number | null;
			netWorth: number | null;
			totalAssets: number | null;
			totalLiabilities: number | null;
			totalBorrowing: number | null;
		};
		ratios?: {
			patMargin: number | null;
			returnOnEquity: number | null;
			debtToEquity: number | null;
			assetTurnover: number | null;
		};
		growth?: {
			revenueCAGR: number | null;
			patCAGR: number | null;
			yearsOfData: number;
		};
		source: string;
		attribution: string;
		lastUpdated?: string;
	}

	const { data: mcaFinancials, isLoading: isLoadingMca } = useQuery<{
		success: boolean;
		data: McaFinancialRatios;
	}>({
		queryKey: ["/api/mca/company", company?.cin, "financials"],
		enabled: !!company?.cin,
	});

	const isLoading = isLoadingCompany || isLoadingFinancials || isLoadingRatios;

	// Set default selected year when ratios are loaded
	if (!selectedYear && ratios.length > 0) {
		setSelectedYear(ratios[0].financialYear);
	}

	// Get selected year data
	const selectedYearRatios = ratios.find(
		(r) => r.financialYear === selectedYear,
	);
	const selectedYearFinancials = financials.find(
		(f) => f.financialYear === selectedYear,
	);

	// Calculate metrics
	const lastDealPrice = priceHistory.find(
		(p) => p.sourceType === "DEAL",
	)?.price;
	const lastSellerPrice = priceHistory.find(
		(p) => p.sourceType === "SELLER_FEED",
	)?.price;

	const bookValuePerShare =
		selectedYearFinancials && company
			? Number(selectedYearFinancials.networth) /
				Number(company.totalShares || 1)
			: null;

	const premiumDiscount =
		lastDealPrice && bookValuePerShare
			? ((Number(lastDealPrice) - bookValuePerShare) / bookValuePerShare) * 100
			: null;

	// Prepare chart data
	const revenueChartData = financials.slice(-3).map((f) => ({
		year: f.financialYear,
		revenue: Number(f.revenue) / 10000000, // Convert to Crores
	}));

	const patChartData = financials.slice(-3).map((f) => ({
		year: f.financialYear,
		pat: Number(f.pat) / 10000000,
	}));

	const networthChartData = financials.slice(-3).map((f) => ({
		year: f.financialYear,
		networth: Number(f.networth) / 10000000,
	}));

	// Calculate transaction insights
	const dealsData = deals.filter((d) => d.companyId === id);
	const avgDealPrice =
		dealsData.length > 0
			? dealsData.reduce((sum, d) => sum + Number(d.agreedPrice), 0) /
				dealsData.length
			: 0;
	const totalVolume = dealsData.reduce((sum, d) => sum + Number(d.quantity), 0);

	const formatCurrency = (
		amount: number | string | null | undefined,
	): string => {
		if (!amount) return "₹0";
		const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
		if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
		if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
		return `₹${num.toLocaleString("en-IN")}`;
	};

	const formatNumber = (num: number | string | null | undefined): string => {
		if (!num) return "0";
		const n = typeof num === "string" ? Number.parseFloat(num) : num;
		return n.toLocaleString("en-IN");
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background p-6">
				<LoadingState variant="card" count={3} />
			</div>
		);
	}

	if (!company) {
		return (
			<div className="min-h-screen bg-background p-6">
				<Card>
					<CardContent className="pt-6 text-center">
						<p className="text-muted-foreground">Company not found</p>
						<Button
							onClick={() => navigate("/unlisted/browse")}
							className="mt-4"
							data-testid="button-back-browse"
						>
							Browse Companies
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div
			className="min-h-screen bg-background p-4 md:p-6"
			data-testid="unlisted-company-details"
		>
			{/* Header */}
			<div className="max-w-7xl mx-auto mb-6">
				<Button
					variant="ghost"
					onClick={() => navigate("/unlisted/browse")}
					className="mb-4"
					data-testid="button-back"
				>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to Marketplace
				</Button>

				{/* Company Header Section */}
				<Card className="bg-background">
					<CardContent className="pt-6">
						<div className="flex flex-col md:flex-row gap-6">
							<div className="flex-1">
								<div className="flex items-start gap-4">
									{company.logo && (
										<div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
											<img
												src={company.logo}
												alt={company.name}
												className="w-full h-full object-cover"
											/>
										</div>
									)}
									{!company.logo && (
										<div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
											<Building2 className="h-8 w-8 text-primary" />
										</div>
									)}
									<div className="flex-1">
										<h1
											className="text-2xl md:text-3xl font-bold text-foreground mb-2"
											data-testid="text-company-name"
										>
											{company.name}
										</h1>
										<div className="flex flex-wrap gap-2 mb-3">
											{company.sector && (
												<Badge variant="secondary" data-testid="badge-sector">
													{company.sector}
												</Badge>
											)}
											{company.industry && (
												<Badge variant="outline" data-testid="badge-industry">
													{company.industry}
												</Badge>
											)}
											{company.listingStage && (
												<Badge
													variant="default"
													className="capitalize"
													data-testid="badge-listing-stage"
												>
													{company.listingStage.replace("_", " ")}
												</Badge>
											)}
										</div>
										{company.description && (
											<p className="text-sm text-muted-foreground line-clamp-2">
												{company.description}
											</p>
										)}
									</div>
								</div>
							</div>

							{/* Quick Stats */}
							<div className="grid grid-cols-3 gap-4">
								<div>
									<p className="text-xs text-muted-foreground mb-1">
										Market Price
									</p>
									<p
										className="text-lg font-bold text-foreground"
										data-testid="text-market-price"
									>
										{formatCurrency(lastDealPrice)}
									</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground mb-1">
										Face Value
									</p>
									<p
										className="text-lg font-bold text-foreground"
										data-testid="text-face-value"
									>
										{formatCurrency(company.faceValue)}
									</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground mb-1">
										Total Shares
									</p>
									<p
										className="text-lg font-bold text-foreground"
										data-testid="text-total-shares"
									>
										{formatNumber(company.totalShares)}
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Data Quality Warning Banner */}
				<DataQualityWarning quality={dataQuality} />
			</div>

			<div className="max-w-7xl mx-auto space-y-6">
				{/* Valuation & Ratios Row */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Valuation Panel */}
					<Card className="bg-background">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<DollarSign className="h-5 w-5" />
								Valuation & Pricing
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="p-3 bg-muted rounded-lg">
									<p className="text-xs text-muted-foreground mb-1">
										Last Deal Price
									</p>
									<p
										className="text-xl font-bold text-green-600 dark:text-green-400"
										data-testid="text-last-deal-price"
									>
										{formatCurrency(lastDealPrice)}
									</p>
								</div>
								<div className="p-3 bg-muted rounded-lg">
									<p className="text-xs text-muted-foreground mb-1">
										Seller Landing Price
									</p>
									<p
										className="text-xl font-bold text-blue-600 dark:text-blue-400"
										data-testid="text-seller-price"
									>
										{formatCurrency(lastSellerPrice)}
									</p>
								</div>
							</div>

							{premiumDiscount !== null && (
								<div className="p-3 bg-muted rounded-lg">
									<p className="text-xs text-muted-foreground mb-1">
										Premium/Discount vs Book Value
									</p>
									<p
										className={`text-xl font-bold ${premiumDiscount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
										data-testid="text-premium-discount"
									>
										{premiumDiscount >= 0 ? "+" : ""}
										{premiumDiscount.toFixed(2)}%
									</p>
								</div>
							)}

							<div className="flex gap-3 pt-2">
								<Button
									className="flex-1"
									onClick={() => navigate("/unlisted/buy")}
									data-testid="button-buy-now"
								>
									<ShoppingCart className="h-4 w-4 mr-2" />
									Buy Now
								</Button>
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => navigate("/unlisted/sell")}
									data-testid="button-sell-shares"
								>
									<IndianRupee className="h-4 w-4 mr-2" />
									Sell Shares
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* Ratios Panel */}
					<Card className="bg-background">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<BarChart3 className="h-5 w-5" />
								Financial Ratios
							</CardTitle>
							<div className="flex items-center gap-2">
								{canResearch && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => researchMutation.mutate()}
										disabled={researchMutation.isPending || !company.cin}
										className="h-8 gap-1"
										data-testid="button-refresh-financials"
									>
										<RefreshCw
											className={`h-3 w-3 ${researchMutation.isPending ? "animate-spin" : ""}`}
										/>
										Refresh
									</Button>
								)}
								<Select value={selectedYear} onValueChange={setSelectedYear}>
									<SelectTrigger
										className="w-40"
										data-testid="select-financial-year"
									>
										<SelectValue placeholder="Select Year" />
									</SelectTrigger>
									<SelectContent>
										{ratios.map((r) => (
											<SelectItem key={r.id} value={r.financialYear}>
												{r.financialYear}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</CardHeader>
						<CardContent>
							{selectedYearRatios ? (
								<div className="grid grid-cols-2 gap-3">
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-xs text-muted-foreground mb-1">
											P/E Ratio
										</p>
										<p
											className="text-lg font-bold text-foreground"
											data-testid="text-pe-ratio"
										>
											{selectedYearRatios.peRatio
												? Number(selectedYearRatios.peRatio).toFixed(2)
												: "N/A"}
										</p>
									</div>
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-xs text-muted-foreground mb-1">
											P/B Ratio
										</p>
										<p
											className="text-lg font-bold text-foreground"
											data-testid="text-pb-ratio"
										>
											{selectedYearRatios.pbRatio
												? Number(selectedYearRatios.pbRatio).toFixed(2)
												: "N/A"}
										</p>
									</div>
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-xs text-muted-foreground mb-1">ROE %</p>
										<p
											className="text-lg font-bold text-foreground"
											data-testid="text-roe"
										>
											{selectedYearRatios.roe
												? (Number(selectedYearRatios.roe) * 100).toFixed(2)
												: "N/A"}
											%
										</p>
									</div>
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-xs text-muted-foreground mb-1">ROCE %</p>
										<p
											className="text-lg font-bold text-foreground"
											data-testid="text-roce"
										>
											{selectedYearRatios.roce
												? (Number(selectedYearRatios.roce) * 100).toFixed(2)
												: "N/A"}
											%
										</p>
									</div>
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-xs text-muted-foreground mb-1">
											Debt/Equity
										</p>
										<p
											className="text-lg font-bold text-foreground"
											data-testid="text-debt-equity"
										>
											{selectedYearRatios.debtEquity
												? Number(selectedYearRatios.debtEquity).toFixed(2)
												: "N/A"}
										</p>
									</div>
									<div className="p-3 bg-muted rounded-lg">
										<p className="text-xs text-muted-foreground mb-1">
											EBITDA Margin %
										</p>
										<p
											className="text-lg font-bold text-foreground"
											data-testid="text-ebitda-margin"
										>
											{selectedYearRatios.marginEbitda
												? (
														Number(selectedYearRatios.marginEbitda) * 100
													).toFixed(2)
												: "N/A"}
											%
										</p>
									</div>
									<div className="p-3 bg-muted rounded-lg col-span-2">
										<p className="text-xs text-muted-foreground mb-1">
											PAT Margin %
										</p>
										<p
											className="text-lg font-bold text-foreground"
											data-testid="text-pat-margin"
										>
											{selectedYearRatios.marginPat
												? (Number(selectedYearRatios.marginPat) * 100).toFixed(
														2,
													)
												: "N/A"}
											%
										</p>
									</div>
								</div>
							) : (
								<p className="text-sm text-muted-foreground text-center py-4">
									No ratio data available
								</p>
							)}
							<div className="flex justify-between items-center mt-4">
								<div className="text-[10px] text-muted-foreground italic">
									{company.lastSyncedAt &&
										`Last synced: ${new Date(company.lastSyncedAt).toLocaleDateString()}`}
								</div>
								<DataSourceBadge source={selectedYearRatios?.dataSource} />
							</div>
						</CardContent>
					</Card>
				</div>

				{/* MCA Intelligence Financial Ratios (Official Filings) */}
				{company?.cin && (
					<Card className="bg-background border-green-200 dark:border-green-800">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="h-5 w-5 text-green-600" />
								MCA Official Financial Data
								<Badge
									variant="outline"
									className="text-green-600 border-green-300 dark:border-green-700 ml-2"
								>
									Government Source
								</Badge>
							</CardTitle>
							<CardDescription>
								Derived from statutory public filings (AOC-4/XBRL) submitted to
								Ministry of Corporate Affairs
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoadingMca ? (
								<div className="text-center py-4 text-muted-foreground">
									Loading MCA data...
								</div>
							) : mcaFinancials?.success && mcaFinancials.data?.hasData ? (
								<div className="space-y-4">
									{/* Key Metrics */}
									<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
										<div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
											<p className="text-xs text-muted-foreground mb-1">
												Revenue
											</p>
											<p
												className="text-lg font-bold text-foreground"
												data-testid="mca-revenue"
											>
												{mcaFinancials.data.metrics?.revenue
													? formatCurrency(mcaFinancials.data.metrics.revenue)
													: "N/A"}
											</p>
										</div>
										<div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
											<p className="text-xs text-muted-foreground mb-1">
												Profit After Tax
											</p>
											<p
												className="text-lg font-bold text-foreground"
												data-testid="mca-pat"
											>
												{mcaFinancials.data.metrics?.profitAfterTax
													? formatCurrency(
															mcaFinancials.data.metrics.profitAfterTax,
														)
													: "N/A"}
											</p>
										</div>
										<div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
											<p className="text-xs text-muted-foreground mb-1">
												Net Worth
											</p>
											<p
												className="text-lg font-bold text-foreground"
												data-testid="mca-networth"
											>
												{mcaFinancials.data.metrics?.netWorth
													? formatCurrency(mcaFinancials.data.metrics.netWorth)
													: "N/A"}
											</p>
										</div>
										<div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
											<p className="text-xs text-muted-foreground mb-1">
												Total Assets
											</p>
											<p
												className="text-lg font-bold text-foreground"
												data-testid="mca-total-assets"
											>
												{mcaFinancials.data.metrics?.totalAssets
													? formatCurrency(
															mcaFinancials.data.metrics.totalAssets,
														)
													: "N/A"}
											</p>
										</div>
									</div>

									{/* Computed Ratios */}
									<div>
										<h4 className="text-sm font-semibold mb-3 text-foreground">
											Computed Ratios
										</h4>
										<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
											<div className="p-3 bg-muted rounded-lg">
												<p className="text-xs text-muted-foreground mb-1">
													PAT Margin
												</p>
												<p
													className="text-lg font-bold text-foreground"
													data-testid="mca-pat-margin"
												>
													{mcaFinancials.data.ratios?.patMargin !== undefined &&
													mcaFinancials.data.ratios?.patMargin !== null
														? `${mcaFinancials.data.ratios.patMargin}%`
														: "N/A"}
												</p>
											</div>
											<div className="p-3 bg-muted rounded-lg">
												<p className="text-xs text-muted-foreground mb-1">
													Return on Equity
												</p>
												<p
													className="text-lg font-bold text-foreground"
													data-testid="mca-roe"
												>
													{mcaFinancials.data.ratios?.returnOnEquity !==
														undefined &&
													mcaFinancials.data.ratios?.returnOnEquity !== null
														? `${mcaFinancials.data.ratios.returnOnEquity}%`
														: "N/A"}
												</p>
											</div>
											<div className="p-3 bg-muted rounded-lg">
												<p className="text-xs text-muted-foreground mb-1">
													Debt to Equity
												</p>
												<p
													className="text-lg font-bold text-foreground"
													data-testid="mca-debt-equity"
												>
													{mcaFinancials.data.ratios?.debtToEquity !==
														undefined &&
													mcaFinancials.data.ratios?.debtToEquity !== null
														? mcaFinancials.data.ratios.debtToEquity.toFixed(2)
														: "N/A"}
												</p>
											</div>
											<div className="p-3 bg-muted rounded-lg">
												<p className="text-xs text-muted-foreground mb-1">
													Asset Turnover
												</p>
												<p
													className="text-lg font-bold text-foreground"
													data-testid="mca-asset-turnover"
												>
													{mcaFinancials.data.ratios?.assetTurnover !==
														undefined &&
													mcaFinancials.data.ratios?.assetTurnover !== null
														? mcaFinancials.data.ratios.assetTurnover.toFixed(2)
														: "N/A"}
												</p>
											</div>
										</div>
									</div>

									{/* Growth Metrics */}
									{mcaFinancials.data.growth &&
										mcaFinancials.data.growth.yearsOfData > 1 && (
											<div>
												<h4 className="text-sm font-semibold mb-3 text-foreground">
													Growth Metrics (
													{mcaFinancials.data.growth.yearsOfData} years of data)
												</h4>
												<div className="grid grid-cols-2 gap-3">
													<div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
														<p className="text-xs text-muted-foreground mb-1">
															Revenue CAGR
														</p>
														<p
															className={`text-lg font-bold ${(mcaFinancials.data.growth.revenueCAGR || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
															data-testid="mca-revenue-cagr"
														>
															{mcaFinancials.data.growth.revenueCAGR !== null
																? `${mcaFinancials.data.growth.revenueCAGR >= 0 ? "+" : ""}${mcaFinancials.data.growth.revenueCAGR}%`
																: "N/A"}
														</p>
													</div>
													<div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
														<p className="text-xs text-muted-foreground mb-1">
															PAT CAGR
														</p>
														<p
															className={`text-lg font-bold ${(mcaFinancials.data.growth.patCAGR || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
															data-testid="mca-pat-cagr"
														>
															{mcaFinancials.data.growth.patCAGR !== null
																? `${mcaFinancials.data.growth.patCAGR >= 0 ? "+" : ""}${mcaFinancials.data.growth.patCAGR}%`
																: "N/A"}
														</p>
													</div>
												</div>
											</div>
										)}

									{/* Attribution Footer */}
									<div className="flex items-center justify-between pt-2 border-t border-border">
										<p className="text-xs text-muted-foreground">
											FY: {mcaFinancials.data.latestYear} | Source:{" "}
											{mcaFinancials.data.source}
										</p>
										<TooltipProvider>
											<UITooltip>
												<TooltipTrigger>
													<span className="inline-flex items-center gap-1 text-xs text-green-600 cursor-help">
														<Info className="h-3 w-3" />
														{mcaFinancials.data.attribution}
													</span>
												</TooltipTrigger>
												<TooltipContent>
													<p className="text-xs max-w-xs">
														This data is derived from official statutory filings
														submitted to the Ministry of Corporate Affairs
														(MCA).
													</p>
												</TooltipContent>
											</UITooltip>
										</TooltipProvider>
									</div>
								</div>
							) : (
								<div className="text-center py-6">
									<Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
									<p className="text-sm text-muted-foreground">
										{mcaFinancials?.data?.hasData === false
											? "No MCA financial data available for this company yet."
											: "Unable to fetch MCA financial data."}
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										CIN: {company.cin}
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				)}

				{/* Financial Trend Charts */}
				<Card className="bg-background">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<TrendingUp className="h-5 w-5" />
									Financial Trends
								</CardTitle>
								<CardDescription>
									Last 3 years performance metrics
								</CardDescription>
							</div>
							{financials.length > 0 && (
								<DataSourceBadge source={financials[0]?.dataSource} />
							)}
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							{/* Revenue Growth Chart */}
							<div>
								<h4 className="text-sm font-semibold mb-3 text-foreground">
									Revenue Growth (₹Cr)
								</h4>
								<ResponsiveContainer width="100%" height={200}>
									<LineChart data={revenueChartData}>
										<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
										<XAxis
											dataKey="year"
											stroke="#9CA3AF"
											style={{ fontSize: "12px" }}
										/>
										<YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
										<Tooltip
											contentStyle={{
												backgroundColor: "#1F2937",
												border: "none",
												borderRadius: "8px",
											}}
											labelStyle={{ color: "#F9FAFB" }}
										/>
										<Line
											type="monotone"
											dataKey="revenue"
											stroke="#10B981"
											strokeWidth={2}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>

							{/* PAT Growth Chart */}
							<div>
								<h4 className="text-sm font-semibold mb-3 text-foreground">
									PAT Growth (₹Cr)
								</h4>
								<ResponsiveContainer width="100%" height={200}>
									<LineChart data={patChartData}>
										<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
										<XAxis
											dataKey="year"
											stroke="#9CA3AF"
											style={{ fontSize: "12px" }}
										/>
										<YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
										<Tooltip
											contentStyle={{
												backgroundColor: "#1F2937",
												border: "none",
												borderRadius: "8px",
											}}
											labelStyle={{ color: "#F9FAFB" }}
										/>
										<Line
											type="monotone"
											dataKey="pat"
											stroke="#3B82F6"
											strokeWidth={2}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>

							{/* Networth Chart */}
							<div>
								<h4 className="text-sm font-semibold mb-3 text-foreground">
									Networth (₹Cr)
								</h4>
								<ResponsiveContainer width="100%" height={200}>
									<BarChart data={networthChartData}>
										<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
										<XAxis
											dataKey="year"
											stroke="#9CA3AF"
											style={{ fontSize: "12px" }}
										/>
										<YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
										<Tooltip
											contentStyle={{
												backgroundColor: "#1F2937",
												border: "none",
												borderRadius: "8px",
											}}
											labelStyle={{ color: "#F9FAFB" }}
										/>
										<Bar dataKey="networth" fill="#8B5CF6" />
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Transaction Insights */}
				<Card className="bg-background">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity className="h-5 w-5" />
							Transaction Insights
						</CardTitle>
					</CardHeader>
					<CardContent>
						{/* Summary Stats */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
							<div className="p-4 bg-muted rounded-lg">
								<p className="text-xs text-muted-foreground mb-1">
									Average Deal Price
								</p>
								<p
									className="text-xl font-bold text-foreground"
									data-testid="text-avg-deal-price"
								>
									{formatCurrency(avgDealPrice)}
								</p>
							</div>
							<div className="p-4 bg-muted rounded-lg">
								<p className="text-xs text-muted-foreground mb-1">
									Total Volume Traded
								</p>
								<p
									className="text-xl font-bold text-foreground"
									data-testid="text-total-volume"
								>
									{formatNumber(totalVolume)} shares
								</p>
							</div>
							<div className="p-4 bg-muted rounded-lg">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs text-muted-foreground mb-1">Demand</p>
										<p className="text-xl font-bold text-foreground">
											{dealsData.length > 5
												? "High"
												: dealsData.length > 2
													? "Medium"
													: "Low"}
										</p>
									</div>
									<Zap
										className={`h-8 w-8 ${dealsData.length > 5 ? "text-green-500" : dealsData.length > 2 ? "text-yellow-500" : "text-muted-foreground"}`}
									/>
								</div>
							</div>
						</div>

						{/* Last 10 Deals Table */}
						<div>
							<h4 className="text-sm font-semibold mb-3 text-foreground">
								Last 10 Deals
							</h4>
							{dealsData.length > 0 ? (
								<div className="rounded-lg border border-border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Date</TableHead>
												<TableHead>Price</TableHead>
												<TableHead>Quantity</TableHead>
												<TableHead>Type</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{dealsData.slice(0, 10).map((deal) => (
												<TableRow key={deal.id}>
													<TableCell>
														{deal.matchedAt
															? new Date(deal.matchedAt).toLocaleDateString()
															: "N/A"}
													</TableCell>
													<TableCell className="font-medium">
														{formatCurrency(deal.agreedPrice)}
													</TableCell>
													<TableCell>{formatNumber(deal.quantity)}</TableCell>
													<TableCell>
														<Badge
															variant={
																deal.status === "completed"
																	? "default"
																	: "secondary"
															}
														>
															{deal.status}
														</Badge>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							) : (
								<p className="text-sm text-muted-foreground text-center py-4">
									No transaction history available
								</p>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
