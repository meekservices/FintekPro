import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Shield as LucideShield,
	TrendingUp,
	Calendar,
	IndianRupee,
	Building2,
	Calculator,
	AlertCircle,
	CheckCircle2,
	Clock,
	Search,
	Filter,
	Star,
	StarOff,
	Briefcase,
	Wallet,
	Bell,
	FileText,
	TrendingDown,
	ArrowRight,
	Landmark,
	Coins,
	Receipt,
	ShieldCheck,
	Info,
	ChevronRight,
	PlusCircle,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOrderGuard } from "@/hooks/use-order-guard";
import { OrderBlocker } from "@/components/OrderBlocker";
import { KYCWarningBanner } from "@/components/KYCWarningBanner";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { Label } from "@/components/ui/label";

interface Bond {
	id: string;
	isin: string;
	securityName: string;
	issuer: string;
	couponRate: number;
	yieldToMaturity: number | null;
	faceValue: number;
	currentPrice: number | null;
	maturityDate: string;
	securityType: string;
	creditRating: string | null;
	taxStatus: string;
	bondType: "government" | "corporate";
	riskLevel: string;
	minInvestment: number;
}

interface NcdIssue {
	id: string;
	issueCode: string;
	issuer: string;
	issueSize: number;
	pricePerNcd: number;
	couponRate: number;
	tenure: number;
	tenureUnit: string;
	creditRating: string;
	issueOpenDate: string;
	issueCloseDate: string;
	allotmentDate: string | null;
	listingDate: string | null;
	listingExchange: string;
	minApplicationAmount: number;
	maxApplicationAmount: number | null;
	interestPaymentFrequency: string;
	status: string;
}

interface SgbIssue {
	id: string;
	seriesName: string;
	tranche: string;
	issueDate: string;
	subscriptionOpenDate: string;
	subscriptionCloseDate: string;
	issuePrice: number;
	goldPriceReference: number;
	maturityDate: string;
	interestRate: number;
	minQuantity: number;
	maxQuantity: number;
	status: string;
}

interface SuitabilityCheck {
	id: string;
	kycVerified: boolean;
	kycLevel: string;
	suitabilityResult: string;
	riskProfile: string;
	notes: string;
	checkedAt: string;
}

function SuitabilityCheckBanner() {
	const { toast } = useToast();

	const { data: suitabilityStatus, isLoading } = useQuery<{
		hasSuitability: boolean;
		suitability: SuitabilityCheck | null;
		canTrade: boolean;
	}>({
		queryKey: ["/api/fixed-income/suitability-status"],
	});

	const performCheckMutation = useMutation({
		mutationFn: () =>
			apiRequest("/api/fixed-income/suitability-check", { method: "POST" }),
		onSuccess: () => {
			toast({
				title: "Suitability Check Complete",
				description: "Your trading eligibility has been verified.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/fixed-income/suitability-status"],
			});
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Check Failed",
				description: error.message || "Failed to complete suitability check.",
			});
		},
	});

	if (isLoading) {
		return <Skeleton className="h-20 w-full" />;
	}

	if (suitabilityStatus?.canTrade) {
		return (
			<Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
				<CheckCircle2 className="h-4 w-4 text-green-600" />
				<AlertTitle className="text-green-800 dark:text-green-200">
					Eligible to Trade
				</AlertTitle>
				<AlertDescription className="text-green-700 dark:text-green-300">
					Your suitability check is valid. Risk Profile:{" "}
					{suitabilityStatus.suitability?.riskProfile || "Standard"}
				</AlertDescription>
			</Alert>
		);
	}

	if (
		suitabilityStatus?.hasSuitability &&
		suitabilityStatus?.suitability?.suitabilityResult === "rejected"
	) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Trading Restricted</AlertTitle>
				<AlertDescription>
					{suitabilityStatus.suitability?.notes ||
						"Please complete your KYC to enable trading."}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
			<AlertCircle className="h-4 w-4 text-amber-600" />
			<AlertTitle className="text-amber-800 dark:text-amber-200">
				Suitability Check Required
			</AlertTitle>
			<AlertDescription className="text-amber-700 dark:text-amber-300 flex items-center justify-between">
				<span>
					Complete a suitability assessment to start trading fixed income
					securities.
				</span>
				<Button
					size="sm"
					onClick={() => performCheckMutation.mutate()}
					disabled={performCheckMutation.isPending}
					data-testid="btn-suitability-check"
				>
					{performCheckMutation.isPending ? "Checking..." : "Run Check"}
				</Button>
			</AlertDescription>
		</Alert>
	);
}

function PortfolioSummaryCard() {
	const { data: summary, isLoading } = useQuery<{
		totalInvested: number;
		currentValue: number;
		unrealizedPnL: number;
		unrealizedPnLPercent: number;
		totalCouponsReceived: number;
		pendingCoupons: number;
		holdingsCount: number;
		avgYield: number;
		avgMaturity: number;
	}>({
		queryKey: ["/api/fixed-income/portfolio-summary"],
	});

	if (isLoading) {
		return (
			<Card>
				<CardContent className="p-6">
					<Skeleton className="h-32 w-full" />
				</CardContent>
			</Card>
		);
	}

	if (!summary || summary.holdingsCount === 0) {
		return (
			<Card className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-100 dark:border-blue-800">
				<CardContent className="p-6">
					<div className="flex items-center gap-4">
						<div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
							<Briefcase className="h-6 w-6 text-blue-600" />
						</div>
						<div>
							<h3 className="font-semibold text-foreground">
								Start Your Fixed Income Portfolio
							</h3>
							<p className="text-muted-foreground text-sm">
								Explore bonds, NCDs, and government securities to build stable
								returns.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="bg-gradient-to-r from-emerald-50 dark:from-emerald-950/30 to-teal-50 dark:to-teal-950/30 border-emerald-100 dark:border-emerald-800">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2 text-lg">
					<Wallet className="h-5 w-5 text-emerald-600" />
					Portfolio Summary
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div>
						<p className="text-xs text-muted-foreground">Total Invested</p>
						<p className="text-lg font-bold text-foreground">
							₹{(summary.totalInvested / 100000).toFixed(2)}L
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Current Value</p>
						<p className="text-lg font-bold text-foreground">
							₹{(summary.currentValue / 100000).toFixed(2)}L
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Unrealized P&L</p>
						<p
							className={`text-lg font-bold ${summary.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{summary.unrealizedPnL >= 0 ? "+" : ""}₹
							{Math.abs(summary.unrealizedPnL).toLocaleString()}
							<span className="text-xs ml-1">
								({summary.unrealizedPnLPercent.toFixed(2)}%)
							</span>
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Avg Yield</p>
						<p className="text-lg font-bold text-emerald-600">
							{summary.avgYield.toFixed(2)}%
						</p>
					</div>
				</div>
				<div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
					<div className="text-center">
						<p className="text-2xl font-bold text-foreground">
							{summary.holdingsCount}
						</p>
						<p className="text-xs text-muted-foreground">Holdings</p>
					</div>
					<div className="text-center">
						<p className="text-2xl font-bold text-green-600">
							₹{summary.totalCouponsReceived.toLocaleString()}
						</p>
						<p className="text-xs text-muted-foreground">Coupons Received</p>
					</div>
					<div className="text-center">
						<p className="text-2xl font-bold text-amber-600">
							₹{summary.pendingCoupons.toLocaleString()}
						</p>
						<p className="text-xs text-muted-foreground">Pending Coupons</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function BondCard({
	bond,
	onSelect,
	isWatchlisted,
	onToggleWatchlist,
}: {
	bond: Bond;
	onSelect: (bond: Bond) => void;
	isWatchlisted: boolean;
	onToggleWatchlist: (bond: Bond) => void;
}) {
	const getRatingColor = (rating: string | null) => {
		if (!rating) return "bg-muted text-muted-foreground";
		if (rating.startsWith("AAA"))
			return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
		if (rating.startsWith("AA"))
			return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
		if (rating.startsWith("A"))
			return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
		if (rating.startsWith("BBB"))
			return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
		return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
	};

	const getBondTypeIcon = () => {
		if (bond.bondType === "government")
			return <Landmark className="h-5 w-5 text-blue-600" />;
		return <Building2 className="h-5 w-5 text-purple-600" />;
	};

	return (
		<Card
			className="hover:shadow-lg transition-all cursor-pointer group"
			data-testid={`bond-card-${bond.isin}`}
		>
			<CardContent className="p-4">
				<div className="flex items-start justify-between mb-3">
					<div className="flex items-center gap-2">
						{getBondTypeIcon()}
						<div>
							<h4 className="font-semibold text-foreground text-sm line-clamp-1">
								{bond.securityName}
							</h4>
							<p className="text-xs text-muted-foreground">{bond.issuer}</p>
						</div>
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={(e) => {
							e.stopPropagation();
							onToggleWatchlist(bond);
						}}
						data-testid={`watchlist-toggle-${bond.isin}`}
					>
						{isWatchlisted ? (
							<Star className="h-4 w-4 text-amber-500 fill-amber-500" />
						) : (
							<StarOff className="h-4 w-4 text-muted-foreground group-hover:text-amber-500" />
						)}
					</Button>
				</div>

				<div className="flex flex-wrap gap-2 mb-3">
					<Badge
						variant="outline"
						className={getRatingColor(bond.creditRating)}
					>
						{bond.creditRating || "Unrated"}
					</Badge>
					<Badge variant="outline" className="bg-muted">
						{bond.securityType}
					</Badge>
					{bond.taxStatus === "tax_free" && (
						<Badge
							variant="outline"
							className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
						>
							Tax Free
						</Badge>
					)}
				</div>

				<div className="grid grid-cols-2 gap-3 text-sm mb-3">
					<div>
						<p className="text-muted-foreground text-xs">Coupon Rate</p>
						<p className="font-semibold text-foreground">{bond.couponRate}%</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">YTM</p>
						<p className="font-semibold text-emerald-600">
							{bond.yieldToMaturity?.toFixed(2) || "-"}%
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Price</p>
						<p className="font-semibold">
							₹
							{bond.currentPrice?.toLocaleString() ||
								bond.faceValue.toLocaleString()}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Maturity</p>
						<p className="font-semibold">
							{new Date(bond.maturityDate).toLocaleDateString("en-IN", {
								month: "short",
								year: "numeric",
							})}
						</p>
					</div>
				</div>

				<div className="flex items-center justify-between pt-3 border-t">
					<div className="text-xs">
						<span className="text-muted-foreground">Min: </span>
						<span className="font-semibold">
							₹{bond.minInvestment.toLocaleString()}
						</span>
					</div>
					<Button
						size="sm"
						onClick={() => onSelect(bond)}
						data-testid={`btn-invest-${bond.isin}`}
					>
						Invest <ArrowRight className="h-3 w-3 ml-1" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function NcdIssueCard({
	issue,
	onApply,
}: { issue: NcdIssue; onApply: (issue: NcdIssue) => void }) {
	const isOpen = issue.status === "open";
	const daysLeft = isOpen
		? Math.ceil(
				(new Date(issue.issueCloseDate).getTime() - Date.now()) /
					(1000 * 60 * 60 * 24),
			)
		: 0;

	return (
		<Card
			className="hover:shadow-lg transition-all"
			data-testid={`ncd-card-${issue.issueCode}`}
		>
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div>
						<CardTitle className="text-base">{issue.issuer}</CardTitle>
						<CardDescription>{issue.issueCode}</CardDescription>
					</div>
					<Badge
						variant={isOpen ? "default" : "secondary"}
						className={isOpen ? "bg-green-600" : ""}
					>
						{isOpen ? `${daysLeft} days left` : issue.status}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="pb-2">
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div>
						<p className="text-muted-foreground text-xs">Coupon Rate</p>
						<p className="font-bold text-lg text-emerald-600">
							{issue.couponRate}%
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Tenure</p>
						<p className="font-semibold">
							{issue.tenure} {issue.tenureUnit}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Issue Size</p>
						<p className="font-semibold">
							₹{(issue.issueSize / 10000000).toFixed(0)} Cr
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Rating</p>
						<Badge
							variant="outline"
							className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
						>
							{issue.creditRating}
						</Badge>
					</div>
				</div>
				<div className="mt-3 pt-3 border-t flex items-center justify-between">
					<div className="text-xs">
						<span className="text-muted-foreground">Min Application: </span>
						<span className="font-semibold">
							₹{issue.minApplicationAmount.toLocaleString()}
						</span>
					</div>
					<Button
						size="sm"
						disabled={!isOpen}
						onClick={() => onApply(issue)}
						data-testid={`btn-apply-ncd-${issue.issueCode}`}
					>
						Apply Now
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function SgbIssueCard({
	issue,
	onApply,
}: { issue: SgbIssue; onApply: (issue: SgbIssue) => void }) {
	const isOpen = issue.status === "open";
	const daysLeft = isOpen
		? Math.ceil(
				(new Date(issue.subscriptionCloseDate).getTime() - Date.now()) /
					(1000 * 60 * 60 * 24),
			)
		: 0;

	return (
		<Card
			className="hover:shadow-lg transition-all bg-gradient-to-br from-amber-50 dark:from-amber-950/30 to-yellow-50 dark:to-yellow-950/30"
			data-testid={`sgb-card-${issue.seriesName}`}
		>
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
							<Coins className="h-5 w-5 text-amber-600" />
						</div>
						<div>
							<CardTitle className="text-base">{issue.seriesName}</CardTitle>
							<CardDescription>Tranche: {issue.tranche}</CardDescription>
						</div>
					</div>
					<Badge
						variant={isOpen ? "default" : "secondary"}
						className={isOpen ? "bg-amber-600" : ""}
					>
						{isOpen ? `${daysLeft} days left` : issue.status}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="pb-2">
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div>
						<p className="text-muted-foreground text-xs">Issue Price</p>
						<p className="font-bold text-lg">
							₹{issue.issuePrice.toLocaleString()}/gm
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Interest Rate</p>
						<p className="font-semibold text-emerald-600">
							{issue.interestRate}% p.a.
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Gold Reference</p>
						<p className="font-semibold">
							₹{issue.goldPriceReference.toLocaleString()}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Maturity</p>
						<p className="font-semibold">
							{new Date(issue.maturityDate).toLocaleDateString("en-IN", {
								month: "short",
								year: "numeric",
							})}
						</p>
					</div>
				</div>
				<div className="mt-3 pt-3 border-t flex items-center justify-between">
					<div className="text-xs">
						<span className="text-muted-foreground">Qty: </span>
						<span className="font-semibold">
							{issue.minQuantity} - {issue.maxQuantity} grams
						</span>
					</div>
					<Button
						size="sm"
						variant="outline"
						className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:bg-amber-900/30"
						disabled={!isOpen}
						onClick={() => onApply(issue)}
						data-testid={`btn-apply-sgb-${issue.seriesName}`}
					>
						Subscribe
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function BondOrderDialog({
	bond,
	open,
	onClose,
}: {
	bond: Bond | null;
	open: boolean;
	onClose: () => void;
}) {
	const { toast } = useToast();
	const [quantity, setQuantity] = useState(1);
	const [orderType, setOrderType] = useState<"market" | "limit">("market");
	const [limitPrice, setLimitPrice] = useState("");
	const [orderError, setOrderError] = useState<any>(null);
	const orderGuard = useOrderGuard();

	const placeOrderMutation = useMutation({
		mutationFn: (orderData: any) =>
			apiRequest("/api/fixed-income/orders", {
				method: "POST",
				body: JSON.stringify(orderData),
			}),
		onSuccess: () => {
			toast({
				title: "Order Placed Successfully",
				description: "Your bond order has been submitted.",
			});
			onClose();
			queryClient.invalidateQueries({ queryKey: ["/api/fixed-income/orders"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/fixed-income/holdings"],
			});
		},
		onError: (error: any) => {
			const parsedError = orderGuard.handleError(error, false);
			setOrderError(parsedError);
		},
	});

	if (!bond) return null;

	const unitPrice = bond.currentPrice || bond.faceValue;
	const totalAmount = quantity * unitPrice;

	const handleSubmit = () => {
		if (orderType === "limit") {
			const parsedLimitPrice = Number.parseFloat(limitPrice);
			if (
				!limitPrice ||
				Number.isNaN(parsedLimitPrice) ||
				parsedLimitPrice <= 0
			) {
				toast({
					variant: "destructive",
					title: "Invalid Price",
					description: "Please enter a valid limit price",
				});
				return;
			}
		}

		placeOrderMutation.mutate({
			bondId: bond.id,
			bondType: bond.bondType,
			orderType: "buy",
			priceType: orderType,
			quantity,
			price: orderType === "limit" ? Number.parseFloat(limitPrice) : unitPrice,
			settlementType: "T+1",
		});
	};

	const isLimitPriceValid =
		orderType !== "limit" ||
		(limitPrice &&
			!Number.isNaN(Number.parseFloat(limitPrice)) &&
			Number.parseFloat(limitPrice) > 0);

	return (
		<Dialog open={open} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Place Order</DialogTitle>
					<DialogDescription>{bond.securityName}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg text-sm">
						<div>
							<p className="text-muted-foreground">ISIN</p>
							<p className="font-semibold">{bond.isin}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Coupon</p>
							<p className="font-semibold">{bond.couponRate}%</p>
						</div>
						<div>
							<p className="text-muted-foreground">YTM</p>
							<p className="font-semibold text-emerald-600">
								{bond.yieldToMaturity?.toFixed(2)}%
							</p>
						</div>
						<div>
							<p className="text-muted-foreground">Unit Price</p>
							<p className="font-semibold">₹{unitPrice.toLocaleString()}</p>
						</div>
					</div>

					<div className="space-y-2">
						<Label>Order Type</Label>
						<Select
							value={orderType}
							onValueChange={(v) => setOrderType(v as any)}
						>
							<SelectTrigger data-testid="select-order-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="market">Market Order</SelectItem>
								<SelectItem value="limit">Limit Order</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{orderType === "limit" && (
						<div className="space-y-2">
							<Label>Limit Price (₹)</Label>
							<Input
								type="number"
								value={limitPrice}
								onChange={(e) => setLimitPrice(e.target.value)}
								placeholder="Enter limit price"
								data-testid="input-limit-price"
							/>
						</div>
					)}

					<div className="space-y-2">
						<Label>Quantity</Label>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								onClick={() => setQuantity(Math.max(1, quantity - 1))}
								data-testid="btn-qty-decrease"
							>
								-
							</Button>
							<Input
								type="number"
								value={quantity}
								onChange={(e) =>
									setQuantity(Math.max(1, Number.parseInt(e.target.value) || 1))
								}
								className="text-center"
								data-testid="input-quantity"
							/>
							<Button
								variant="outline"
								size="icon"
								onClick={() => setQuantity(quantity + 1)}
								data-testid="btn-qty-increase"
							>
								+
							</Button>
						</div>
					</div>

					<Separator />

					<div className="flex justify-between items-center text-lg font-semibold">
						<span>Total Amount</span>
						<span className="text-emerald-600">
							₹{totalAmount.toLocaleString()}
						</span>
					</div>

					<Alert>
						<Info className="h-4 w-4" />
						<AlertDescription className="text-xs">
							Settlement: T+1. Securities will be credited to your demat account
							post settlement.
						</AlertDescription>
					</Alert>
				</div>

				{orderError && (
					<OrderBlocker
						error={orderError}
						onDismiss={() => setOrderError(null)}
						variant="inline"
					/>
				)}

				<DialogFooter className="gap-2">
					<Button
						variant="outline"
						onClick={onClose}
						data-testid="btn-cancel-order"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={
							placeOrderMutation.isPending || !isLimitPriceValid || !!orderError
						}
						data-testid="btn-confirm-order"
					>
						{placeOrderMutation.isPending ? "Placing..." : "Confirm Order"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function BondsTab() {
	const [searchTerm, setSearchTerm] = useState("");
	const [bondType, setBondType] = useState<string>("all");
	const [creditRating, setCreditRating] = useState<string>("all");
	const [selectedBond, setSelectedBond] = useState<Bond | null>(null);
	const { toast } = useToast();

	const { data: bondsData, isLoading } = useQuery<{
		bonds: Bond[];
		total: number;
		page: number;
		limit: number;
	}>({
		queryKey: ["/api/fixed-income/bonds", bondType, creditRating],
	});

	const { data: watchlist } = useQuery<Array<{ bondId: string }>>({
		queryKey: ["/api/fixed-income/watchlist"],
	});

	const watchlistIds = useMemo(
		() => new Set(watchlist?.map((w) => w.bondId) || []),
		[watchlist],
	);

	const addToWatchlistMutation = useMutation({
		mutationFn: (bond: Bond) =>
			apiRequest("/api/fixed-income/watchlist", {
				method: "POST",
				body: JSON.stringify({
					bondId: bond.id,
					bondType: bond.bondType,
					isin: bond.isin,
				}),
			}),
		onSuccess: () => {
			toast({ title: "Added to Watchlist" });
			queryClient.invalidateQueries({
				queryKey: ["/api/fixed-income/watchlist"],
			});
		},
	});

	const removeFromWatchlistMutation = useMutation({
		mutationFn: (watchlistId: string) =>
			apiRequest(`/api/fixed-income/watchlist/${watchlistId}`, {
				method: "DELETE",
			}),
		onSuccess: () => {
			toast({ title: "Removed from Watchlist" });
			queryClient.invalidateQueries({
				queryKey: ["/api/fixed-income/watchlist"],
			});
		},
	});

	const handleToggleWatchlist = (bond: Bond) => {
		if (watchlistIds.has(bond.id)) {
			const item = watchlist?.find((w) => w.bondId === bond.id);
			if (item) removeFromWatchlistMutation.mutate((item as any).id);
		} else {
			addToWatchlistMutation.mutate(bond);
		}
	};

	const filteredBonds = useMemo(() => {
		if (!bondsData?.bonds) return [];
		return bondsData.bonds.filter((bond) => {
			const matchesSearch =
				!searchTerm ||
				bond.securityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
				bond.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
				bond.isin.toLowerCase().includes(searchTerm.toLowerCase());
			return matchesSearch;
		});
	}, [bondsData?.bonds, searchTerm]);

	if (isLoading) {
		return <LoadingState variant="card" count={6} />;
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col sm:flex-row gap-3">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search by name, issuer, or ISIN..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-9"
						data-testid="input-bond-search"
					/>
				</div>
				<Select value={bondType} onValueChange={setBondType}>
					<SelectTrigger className="w-[160px]" data-testid="select-bond-type">
						<SelectValue placeholder="Bond Type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						<SelectItem value="government">Government</SelectItem>
						<SelectItem value="corporate">Corporate</SelectItem>
					</SelectContent>
				</Select>
				<Select value={creditRating} onValueChange={setCreditRating}>
					<SelectTrigger
						className="w-[160px]"
						data-testid="select-credit-rating"
					>
						<SelectValue placeholder="Credit Rating" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Ratings</SelectItem>
						<SelectItem value="AAA">AAA</SelectItem>
						<SelectItem value="AA">AA+/AA/AA-</SelectItem>
						<SelectItem value="A">A+/A/A-</SelectItem>
						<SelectItem value="BBB">BBB & Below</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{filteredBonds.length === 0 ? (
				<EmptyState
					icon={Briefcase}
					title="No bonds found"
					description="Try adjusting your filters or search term"
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredBonds.map((bond) => (
						<BondCard
							key={bond.id}
							bond={bond}
							onSelect={setSelectedBond}
							isWatchlisted={watchlistIds.has(bond.id)}
							onToggleWatchlist={handleToggleWatchlist}
						/>
					))}
				</div>
			)}

			<BondOrderDialog
				bond={selectedBond}
				open={!!selectedBond}
				onClose={() => setSelectedBond(null)}
			/>
		</div>
	);
}

function NcdTab() {
	const [selectedIssue, setSelectedIssue] = useState<NcdIssue | null>(null);
	const [status, setStatus] = useState("open");

	const { data: issues, isLoading } = useQuery<NcdIssue[]>({
		queryKey: ["/api/fixed-income/ncd-issues", status],
	});

	if (isLoading) {
		return <LoadingState variant="card" count={4} />;
	}

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<h3 className="text-lg font-semibold">Public NCD Issues</h3>
				<Select value={status} onValueChange={setStatus}>
					<SelectTrigger className="w-[140px]" data-testid="select-ncd-status">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="open">Open</SelectItem>
						<SelectItem value="upcoming">Upcoming</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{!issues || issues.length === 0 ? (
				<EmptyState
					icon={Receipt}
					title={`No ${status} NCD issues`}
					description={
						status === "open"
							? "Check upcoming issues for new opportunities"
							: "New issues will appear here when announced"
					}
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{issues.map((issue) => (
						<NcdIssueCard
							key={issue.id}
							issue={issue}
							onApply={setSelectedIssue}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function SgbTab() {
	const [status, setStatus] = useState("open");

	const { data: issues, isLoading } = useQuery<SgbIssue[]>({
		queryKey: ["/api/fixed-income/sgb-issues", status],
	});

	if (isLoading) {
		return <LoadingState variant="card" count={4} />;
	}

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<Coins className="h-5 w-5 text-amber-600" />
					<h3 className="text-lg font-semibold">Sovereign Gold Bonds</h3>
				</div>
				<Select value={status} onValueChange={setStatus}>
					<SelectTrigger className="w-[140px]" data-testid="select-sgb-status">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="open">Open</SelectItem>
						<SelectItem value="upcoming">Upcoming</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
				<Coins className="h-4 w-4 text-amber-600" />
				<AlertTitle className="text-amber-800 dark:text-amber-200">
					About Sovereign Gold Bonds
				</AlertTitle>
				<AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
					SGBs are government securities denominated in grams of gold. They
					offer interest of 2.5% p.a. and capital gains are tax-free on
					redemption.
				</AlertDescription>
			</Alert>

			{!issues || issues.length === 0 ? (
				<EmptyState
					icon={Coins}
					title={`No ${status} SGB issues`}
					description="RBI announces new SGB series periodically"
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{issues.map((issue) => (
						<SgbIssueCard key={issue.id} issue={issue} onApply={() => {}} />
					))}
				</div>
			)}
		</div>
	);
}

interface HoldingData {
	id: string;
	bondId: string;
	bondType: string;
	isin: string;
	securityName: string;
	quantity: number;
	averagePrice: number;
	currentValue: number;
	unrealizedPnL: number;
	couponRate: number;
	nextCouponDate: string | null;
	maturityDate: string;
}

function SellOrderDialog({
	holding,
	open,
	onClose,
}: {
	holding: HoldingData | null;
	open: boolean;
	onClose: () => void;
}) {
	const { toast } = useToast();
	const [quantity, setQuantity] = useState(1);
	const [orderType, setOrderType] = useState<"market" | "limit">("market");
	const [limitPrice, setLimitPrice] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const [orderError, setOrderError] = useState<any>(null);
	const orderGuard = useOrderGuard();

	const validateSellMutation = useMutation({
		mutationFn: (data: { isin: string; quantity: number }) =>
			apiRequest("/api/fixed-income/validate-sell", {
				method: "POST",
				body: JSON.stringify(data),
			}),
	});

	const placeOrderMutation = useMutation({
		mutationFn: (orderData: any) =>
			apiRequest("/api/fixed-income/orders", {
				method: "POST",
				body: JSON.stringify(orderData),
			}),
		onSuccess: () => {
			toast({
				title: "Sell Order Placed",
				description: "Your sell order has been submitted successfully.",
			});
			onClose();
			queryClient.invalidateQueries({ queryKey: ["/api/fixed-income/orders"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/fixed-income/holdings"],
			});
		},
		onError: (error: any) => {
			const parsedError = orderGuard.handleError(error, false);
			setOrderError(parsedError);
		},
	});

	useEffect(() => {
		if (holding && open) {
			setQuantity(1);
			setValidationError(null);
		}
	}, [holding, open]);

	useEffect(() => {
		if (holding && quantity > 0) {
			const timer = setTimeout(async () => {
				try {
					const result = await validateSellMutation.mutateAsync({
						isin: holding.isin,
						quantity,
					});
					if (!(result as any).valid) {
						setValidationError((result as any).error);
					} else {
						setValidationError(null);
					}
				} catch (err) {
					setValidationError("Failed to validate order");
				}
			}, 300);
			return () => clearTimeout(timer);
		}
	}, [holding, quantity]);

	if (!holding) return null;

	const currentPrice = holding.currentValue / holding.quantity;
	const totalAmount = quantity * currentPrice;

	const handleSubmit = () => {
		if (validationError) {
			toast({
				variant: "destructive",
				title: "Invalid Order",
				description: validationError,
			});
			return;
		}

		if (orderType === "limit") {
			const parsedLimitPrice = Number.parseFloat(limitPrice);
			if (
				!limitPrice ||
				Number.isNaN(parsedLimitPrice) ||
				parsedLimitPrice <= 0
			) {
				toast({
					variant: "destructive",
					title: "Invalid Price",
					description: "Please enter a valid limit price",
				});
				return;
			}
		}

		placeOrderMutation.mutate({
			bondId: holding.bondId,
			bondType: holding.bondType,
			isin: holding.isin,
			bondName: holding.securityName,
			orderType: "sell",
			priceType: orderType,
			quantity,
			faceValue: 1000,
			orderPrice:
				orderType === "limit" ? Number.parseFloat(limitPrice) : currentPrice,
		});
	};

	const isLimitPriceValid =
		orderType !== "limit" ||
		(limitPrice &&
			!Number.isNaN(Number.parseFloat(limitPrice)) &&
			Number.parseFloat(limitPrice) > 0);

	return (
		<Dialog open={open} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<TrendingDown className="h-5 w-5 text-red-600" />
						Sell Order
					</DialogTitle>
					<DialogDescription>{holding.securityName}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm">
						<div>
							<p className="text-muted-foreground">ISIN</p>
							<p className="font-semibold">{holding.isin}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Available Qty</p>
							<p className="font-semibold">{holding.quantity}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Avg Buy Price</p>
							<p className="font-semibold">
								₹{holding.averagePrice.toLocaleString()}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground">Current Price</p>
							<p className="font-semibold">₹{currentPrice.toLocaleString()}</p>
						</div>
					</div>

					{validationError && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{validationError}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<Label>Order Type</Label>
						<Select
							value={orderType}
							onValueChange={(v) => setOrderType(v as any)}
						>
							<SelectTrigger data-testid="select-sell-order-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="market">Market Order</SelectItem>
								<SelectItem value="limit">Limit Order</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{orderType === "limit" && (
						<div className="space-y-2">
							<Label>Limit Price (₹)</Label>
							<Input
								type="number"
								value={limitPrice}
								onChange={(e) => setLimitPrice(e.target.value)}
								placeholder="Enter limit price"
								data-testid="input-sell-limit-price"
							/>
						</div>
					)}

					<div className="space-y-2">
						<Label>Quantity to Sell</Label>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								onClick={() => setQuantity(Math.max(1, quantity - 1))}
								data-testid="btn-sell-qty-decrease"
							>
								-
							</Button>
							<Input
								type="number"
								value={quantity}
								onChange={(e) =>
									setQuantity(
										Math.max(
											1,
											Math.min(
												holding.quantity,
												Number.parseInt(e.target.value) || 1,
											),
										),
									)
								}
								className="text-center"
								data-testid="input-sell-quantity"
							/>
							<Button
								variant="outline"
								size="icon"
								onClick={() =>
									setQuantity(Math.min(holding.quantity, quantity + 1))
								}
								data-testid="btn-sell-qty-increase"
							>
								+
							</Button>
						</div>
						<Button
							variant="link"
							size="sm"
							className="px-0 text-red-600"
							onClick={() => setQuantity(holding.quantity)}
							data-testid="btn-sell-all"
						>
							Sell All ({holding.quantity})
						</Button>
					</div>

					<Separator />

					<div className="space-y-2">
						<div className="flex justify-between items-center text-sm">
							<span className="text-muted-foreground">Estimated Proceeds</span>
							<span className="font-semibold">
								₹{totalAmount.toLocaleString()}
							</span>
						</div>
						{holding.unrealizedPnL !== 0 && (
							<div className="flex justify-between items-center text-sm">
								<span className="text-muted-foreground">
									Estimated {holding.unrealizedPnL >= 0 ? "Gain" : "Loss"}
								</span>
								<span
									className={`font-semibold ${holding.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									{holding.unrealizedPnL >= 0 ? "+" : ""}₹
									{(
										(quantity / holding.quantity) *
										holding.unrealizedPnL
									).toFixed(0)}
								</span>
							</div>
						)}
					</div>

					<Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
						<AlertCircle className="h-4 w-4 text-amber-600" />
						<AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
							Settlement: T+1. Proceeds will be credited to your bank account
							post settlement.
						</AlertDescription>
					</Alert>
				</div>

				{orderError && (
					<OrderBlocker
						error={orderError}
						onDismiss={() => setOrderError(null)}
						variant="inline"
					/>
				)}

				<DialogFooter className="gap-2">
					<Button
						variant="outline"
						onClick={onClose}
						data-testid="btn-cancel-sell"
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleSubmit}
						disabled={
							placeOrderMutation.isPending ||
							!!validationError ||
							quantity > holding.quantity ||
							!isLimitPriceValid ||
							!!orderError
						}
						data-testid="btn-confirm-sell"
					>
						{placeOrderMutation.isPending ? "Placing..." : "Confirm Sell"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function HoldingsTab() {
	const [selectedHolding, setSelectedHolding] = useState<HoldingData | null>(
		null,
	);

	const { data: holdings, isLoading } = useQuery<HoldingData[]>({
		queryKey: ["/api/fixed-income/holdings"],
	});

	if (isLoading) {
		return <LoadingState variant="list" count={5} />;
	}

	if (!holdings || holdings.length === 0) {
		return (
			<EmptyState
				icon={Briefcase}
				title="No holdings yet"
				description="Your fixed income holdings will appear here after you make your first investment"
			/>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<h3 className="text-lg font-semibold">Your Holdings</h3>
				<Badge variant="outline">{holdings.length} Securities</Badge>
			</div>

			<div className="space-y-3">
				{holdings.map((holding) => (
					<Card key={holding.id} data-testid={`holding-${holding.isin}`}>
						<CardContent className="p-4">
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<h4 className="font-semibold">{holding.securityName}</h4>
									<p className="text-sm text-muted-foreground">
										{holding.isin}
									</p>
								</div>
								<Badge
									variant="outline"
									className={
										holding.unrealizedPnL >= 0
											? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
											: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
									}
								>
									{holding.unrealizedPnL >= 0 ? "+" : ""}₹
									{holding.unrealizedPnL.toLocaleString()}
								</Badge>
							</div>
							<div className="grid grid-cols-4 gap-4 mt-3 text-sm">
								<div>
									<p className="text-muted-foreground text-xs">Qty</p>
									<p className="font-semibold">{holding.quantity}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Avg Price</p>
									<p className="font-semibold">
										₹{holding.averagePrice.toLocaleString()}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Current Value</p>
									<p className="font-semibold">
										₹{holding.currentValue.toLocaleString()}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Coupon</p>
									<p className="font-semibold text-emerald-600">
										{holding.couponRate}%
									</p>
								</div>
							</div>
							<div className="mt-3 pt-3 border-t flex items-center justify-between">
								{holding.nextCouponDate ? (
									<div className="flex items-center text-sm text-muted-foreground">
										<Calendar className="h-4 w-4 mr-2" />
										Next Coupon:{" "}
										{new Date(holding.nextCouponDate).toLocaleDateString(
											"en-IN",
										)}
									</div>
								) : (
									<div />
								)}
								<Button
									variant="outline"
									size="sm"
									className="border-red-300 dark:border-red-700 text-red-600 hover:bg-red-50 dark:bg-red-950/30"
									onClick={() => setSelectedHolding(holding)}
									data-testid={`btn-sell-${holding.isin}`}
								>
									<TrendingDown className="h-4 w-4 mr-1" />
									Sell
								</Button>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			<SellOrderDialog
				holding={selectedHolding}
				open={!!selectedHolding}
				onClose={() => setSelectedHolding(null)}
			/>
		</div>
	);
}

function WatchlistTab() {
	const { data: watchlist, isLoading } = useQuery<
		Array<{
			id: string;
			bondId: string;
			bondType: string;
			isin: string;
			addedAt: string;
		}>
	>({
		queryKey: ["/api/fixed-income/watchlist"],
	});

	const removeMutation = useMutation({
		mutationFn: (id: string) =>
			apiRequest(`/api/fixed-income/watchlist/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/fixed-income/watchlist"],
			});
		},
	});

	if (isLoading) {
		return <LoadingState variant="list" count={3} />;
	}

	if (!watchlist || watchlist.length === 0) {
		return (
			<EmptyState
				icon={Star}
				title="Your watchlist is empty"
				description="Add bonds to your watchlist to track them easily"
			/>
		);
	}

	return (
		<div className="space-y-3">
			{watchlist.map((item) => (
				<Card key={item.id} data-testid={`watchlist-item-${item.isin}`}>
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<p className="font-semibold">{item.isin}</p>
							<p className="text-sm text-muted-foreground">
								Added {new Date(item.addedAt).toLocaleDateString()}
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => removeMutation.mutate(item.id)}
							data-testid={`btn-remove-watchlist-${item.isin}`}
						>
							Remove
						</Button>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function ReportsTab() {
	const [selectedReport, setSelectedReport] = useState<string | null>(null);
	const [loadingReports, setLoadingReports] = useState<Record<string, boolean>>(
		{},
	);

	const { data: holdingReport, refetch: refetchHolding } = useQuery<{
		success: boolean;
		reportId?: string;
		holdings?: any[];
		summary?: any;
		generatedAt?: string;
	}>({
		queryKey: ["/api/fixed-income/reports/holdings"],
		enabled: false,
		staleTime: 5 * 60 * 1000,
	});

	const { data: couponReport, refetch: refetchCoupon } = useQuery<{
		success: boolean;
		reportId?: string;
		schedule?: any[];
		totalExpected?: number;
		generatedAt?: string;
	}>({
		queryKey: ["/api/fixed-income/reports/coupon-schedule"],
		enabled: false,
		staleTime: 5 * 60 * 1000,
	});

	const { data: maturityReport, refetch: refetchMaturity } = useQuery<{
		success: boolean;
		reportId?: string;
		maturities?: any[];
		totalMaturityValue?: number;
		generatedAt?: string;
	}>({
		queryKey: ["/api/fixed-income/reports/maturity-calendar"],
		enabled: false,
		staleTime: 5 * 60 * 1000,
	});

	const { data: alerts } = useQuery<{
		success: boolean;
		couponAlerts?: any[];
		maturityAlerts?: any[];
	}>({
		queryKey: ["/api/fixed-income/alerts/pending"],
	});

	const selectReport = (type: string) => {
		setSelectedReport(type);
	};

	const handleGenerateReport = async (type: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setSelectedReport(type);
		setLoadingReports((prev) => ({ ...prev, [type]: true }));
		try {
			if (type === "holdings") await refetchHolding();
			else if (type === "coupon") await refetchCoupon();
			else if (type === "maturity") await refetchMaturity();
		} finally {
			setLoadingReports((prev) => ({ ...prev, [type]: false }));
		}
	};

	return (
		<div className="space-y-6">
			{alerts &&
				((alerts.couponAlerts?.length ?? 0) > 0 ||
					(alerts.maturityAlerts?.length ?? 0) > 0) && (
					<Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
						<Bell className="h-4 w-4 text-blue-600" />
						<AlertTitle className="text-blue-800 dark:text-blue-200">
							Upcoming Payments
						</AlertTitle>
						<AlertDescription className="text-blue-700 dark:text-blue-300">
							You have {alerts.couponAlerts?.length || 0} upcoming coupon
							payments and {alerts.maturityAlerts?.length || 0} bonds maturing
							soon.
						</AlertDescription>
					</Alert>
				)}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card
					className={`cursor-pointer transition-all hover:shadow-md ${selectedReport === "holdings" ? "ring-2 ring-blue-500" : ""}`}
					onClick={() => selectReport("holdings")}
					data-testid="card-holding-report"
				>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<Briefcase className="h-5 w-5 text-blue-600" />
							Bond Holdings Report
						</CardTitle>
						<CardDescription>
							Complete portfolio statement with valuations
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">
								{holdingReport ? "Cached" : "7-year retention"}
							</span>
							<Button
								size="sm"
								variant="outline"
								onClick={(e) => handleGenerateReport("holdings", e)}
								disabled={loadingReports.holdings}
								data-testid="btn-generate-holdings"
							>
								{loadingReports.holdings
									? "Generating..."
									: holdingReport
										? "Refresh"
										: "Generate"}
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card
					className={`cursor-pointer transition-all hover:shadow-md ${selectedReport === "coupon" ? "ring-2 ring-green-500" : ""}`}
					onClick={() => selectReport("coupon")}
					data-testid="card-coupon-report"
				>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<IndianRupee className="h-5 w-5 text-green-600" />
							Coupon Schedule
						</CardTitle>
						<CardDescription>
							Upcoming interest payments timeline
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">
								{couponReport ? "Cached" : "Next 12 months"}
							</span>
							<Button
								size="sm"
								variant="outline"
								onClick={(e) => handleGenerateReport("coupon", e)}
								disabled={loadingReports.coupon}
								data-testid="btn-generate-coupon"
							>
								{loadingReports.coupon
									? "Generating..."
									: couponReport
										? "Refresh"
										: "Generate"}
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card
					className={`cursor-pointer transition-all hover:shadow-md ${selectedReport === "maturity" ? "ring-2 ring-purple-500" : ""}`}
					onClick={() => selectReport("maturity")}
					data-testid="card-maturity-report"
				>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<Calendar className="h-5 w-5 text-purple-600" />
							Maturity Calendar
						</CardTitle>
						<CardDescription>Bond maturity dates and values</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">
								{maturityReport ? "Cached" : "All holdings"}
							</span>
							<Button
								size="sm"
								variant="outline"
								onClick={(e) => handleGenerateReport("maturity", e)}
								disabled={loadingReports.maturity}
								data-testid="btn-generate-maturity"
							>
								{loadingReports.maturity
									? "Generating..."
									: maturityReport
										? "Refresh"
										: "Generate"}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			{selectedReport === "holdings" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Bond Holdings Report
						</CardTitle>
						{holdingReport?.generatedAt && (
							<CardDescription>
								Generated:{" "}
								{new Date(holdingReport.generatedAt).toLocaleString()}
							</CardDescription>
						)}
					</CardHeader>
					<CardContent>
						{loadingReports.holdings ? (
							<Skeleton className="h-64 w-full" />
						) : !holdingReport ? (
							<EmptyState
								icon={FileText}
								title="Generate Report"
								description="Click Generate to create your holdings report."
							/>
						) : holdingReport?.holdings?.length === 0 ? (
							<EmptyState
								icon={Briefcase}
								title="No Holdings"
								description="You don't have any bond holdings yet."
							/>
						) : (
							<div className="space-y-4">
								{holdingReport?.summary && (
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
										<div>
											<p className="text-xs text-muted-foreground">
												Total Investment
											</p>
											<p className="text-lg font-bold">
												₹
												{(
													(holdingReport.summary.totalInvestment || 0) / 100000
												).toFixed(2)}
												L
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">
												Current Value
											</p>
											<p className="text-lg font-bold">
												₹
												{(
													(holdingReport.summary.currentValue || 0) / 100000
												).toFixed(2)}
												L
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">
												Unrealized P&L
											</p>
											<p
												className={`text-lg font-bold ${holdingReport.summary.unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
											>
												{holdingReport.summary.unrealizedGain >= 0 ? "+" : ""}₹
												{(
													(holdingReport.summary.unrealizedGain || 0) / 1000
												).toFixed(2)}
												K
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">Avg YTM</p>
											<p className="text-lg font-bold">
												{(holdingReport.summary.weightedAvgYTM || 0).toFixed(2)}
												%
											</p>
										</div>
									</div>
								)}
								<ScrollArea className="h-64">
									<div className="space-y-2">
										{holdingReport?.holdings?.map((holding: any) => (
											<div
												key={holding.bondId}
												className="p-3 border rounded-lg flex justify-between items-center"
												data-testid={`holding-${holding.isin}`}
											>
												<div>
													<p className="font-medium">{holding.bondName}</p>
													<p className="text-sm text-muted-foreground">
														ISIN: {holding.isin} | Qty: {holding.quantity}
													</p>
												</div>
												<div className="text-right">
													<p className="font-semibold">
														₹{holding.currentValue.toFixed(2)}
													</p>
													<p
														className={`text-sm ${holding.unrealizedGain >= 0 ? "text-green-600" : "text-red-600"}`}
													>
														{holding.unrealizedGain >= 0 ? "+" : ""}₹
														{holding.unrealizedGain.toFixed(2)}
													</p>
												</div>
											</div>
										))}
									</div>
								</ScrollArea>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{selectedReport === "coupon" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<IndianRupee className="h-5 w-5 text-green-600" />
							Coupon Payment Schedule
						</CardTitle>
						{couponReport?.generatedAt && (
							<CardDescription>
								Total Expected: ₹{(couponReport.totalExpected || 0).toFixed(2)}
							</CardDescription>
						)}
					</CardHeader>
					<CardContent>
						{loadingReports.coupon ? (
							<Skeleton className="h-64 w-full" />
						) : !couponReport ? (
							<EmptyState
								icon={FileText}
								title="Generate Report"
								description="Click Generate to create your coupon schedule report."
							/>
						) : couponReport?.schedule?.length === 0 ? (
							<EmptyState
								icon={IndianRupee}
								title="No Upcoming Coupons"
								description="You don't have any upcoming coupon payments."
							/>
						) : (
							<ScrollArea className="h-64">
								<div className="space-y-2">
									{couponReport?.schedule?.map((payment: any, idx: number) => (
										<div
											key={idx}
											className="p-3 border rounded-lg flex justify-between items-center"
											data-testid={`coupon-${payment.bondId}-${idx}`}
										>
											<div>
												<p className="font-medium">{payment.bondName}</p>
												<p className="text-sm text-muted-foreground">
													{new Date(payment.couponDate).toLocaleDateString()} |{" "}
													{payment.couponRate}% coupon
												</p>
											</div>
											<div className="text-right">
												<p className="font-semibold text-green-600">
													₹{payment.expectedAmount.toFixed(2)}
												</p>
												<p className="text-sm text-muted-foreground">
													{payment.daysUntilPayment} days away
												</p>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
						)}
					</CardContent>
				</Card>
			)}

			{selectedReport === "maturity" && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Calendar className="h-5 w-5 text-purple-600" />
							Maturity Calendar
						</CardTitle>
						{maturityReport?.generatedAt && (
							<CardDescription>
								Total Maturity Value: ₹
								{((maturityReport.totalMaturityValue || 0) / 100000).toFixed(2)}
								L
							</CardDescription>
						)}
					</CardHeader>
					<CardContent>
						{loadingReports.maturity ? (
							<Skeleton className="h-64 w-full" />
						) : !maturityReport ? (
							<EmptyState
								icon={FileText}
								title="Generate Report"
								description="Click Generate to create your maturity calendar report."
							/>
						) : maturityReport?.maturities?.length === 0 ? (
							<EmptyState
								icon={Calendar}
								title="No Upcoming Maturities"
								description="You don't have any bonds maturing."
							/>
						) : (
							<ScrollArea className="h-64">
								<div className="space-y-2">
									{maturityReport?.maturities?.map(
										(maturity: any, idx: number) => (
											<div
												key={idx}
												className="p-3 border rounded-lg flex justify-between items-center"
												data-testid={`maturity-${maturity.bondId}`}
											>
												<div>
													<p className="font-medium">{maturity.bondName}</p>
													<p className="text-sm text-muted-foreground">
														Matures:{" "}
														{new Date(
															maturity.maturityDate,
														).toLocaleDateString()}{" "}
														| Qty: {maturity.quantity}
													</p>
												</div>
												<div className="text-right">
													<p className="font-semibold">
														₹{maturity.maturityValue.toFixed(2)}
													</p>
													<Badge
														variant={
															maturity.daysUntilMaturity < 30
																? "destructive"
																: maturity.daysUntilMaturity < 90
																	? "secondary"
																	: "outline"
														}
													>
														{maturity.daysUntilMaturity} days
													</Badge>
												</div>
											</div>
										),
									)}
								</div>
							</ScrollArea>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function OrdersTab() {
	const [orderTypeFilter, setOrderTypeFilter] = useState<
		"all" | "buy" | "sell"
	>("all");
	const { data: orders, isLoading } = useQuery<any[]>({
		queryKey: ["/api/fixed-income/orders"],
	});

	if (isLoading) {
		return <Skeleton className="h-64 w-full" />;
	}

	if (!orders || orders.length === 0) {
		return (
			<EmptyState
				icon={Receipt}
				title="No Orders"
				description="You haven't placed any fixed income orders yet. Browse bonds and NCDs to get started."
			/>
		);
	}

	const filteredOrders =
		orderTypeFilter === "all"
			? orders
			: orders.filter((o) => o.orderType === orderTypeFilter);

	const buyOrders = orders.filter((o) => o.orderType === "buy");
	const sellOrders = orders.filter((o) => o.orderType === "sell");

	const getStatusColor = (status: string) => {
		switch (status) {
			case "executed":
			case "completed":
				return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
			case "pending":
			case "processing":
			case "awaiting_settlement":
				return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200";
			case "failed":
			case "rejected":
			case "cancelled":
				return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
			case "pending_payment":
				return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
			default:
				return "bg-muted text-foreground";
		}
	};

	const getOrderTypeStyles = (orderType: string) => {
		return orderType === "buy"
			? {
					bg: "bg-emerald-50 dark:bg-emerald-950/30",
					border: "border-emerald-200 dark:border-emerald-800",
					icon: TrendingUp,
					iconColor: "text-emerald-600",
					label: "BUY",
				}
			: {
					bg: "bg-red-50 dark:bg-red-950/30",
					border: "border-red-200 dark:border-red-800",
					icon: TrendingDown,
					iconColor: "text-red-600",
					label: "SELL",
				};
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-2">
				<h3 className="font-semibold">Your Orders</h3>
				<div className="flex items-center gap-2">
					<Button
						variant={orderTypeFilter === "all" ? "default" : "outline"}
						size="sm"
						onClick={() => setOrderTypeFilter("all")}
						data-testid="btn-filter-all"
					>
						All ({orders.length})
					</Button>
					<Button
						variant={orderTypeFilter === "buy" ? "default" : "outline"}
						size="sm"
						onClick={() => setOrderTypeFilter("buy")}
						className={
							orderTypeFilter !== "buy"
								? "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:bg-emerald-950/30"
								: ""
						}
						data-testid="btn-filter-buy"
					>
						<TrendingUp className="h-3 w-3 mr-1" />
						Buy ({buyOrders.length})
					</Button>
					<Button
						variant={orderTypeFilter === "sell" ? "destructive" : "outline"}
						size="sm"
						onClick={() => setOrderTypeFilter("sell")}
						className={
							orderTypeFilter !== "sell"
								? "border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-950/30"
								: ""
						}
						data-testid="btn-filter-sell"
					>
						<TrendingDown className="h-3 w-3 mr-1" />
						Sell ({sellOrders.length})
					</Button>
				</div>
			</div>

			<div className="space-y-3">
				{filteredOrders.map((order: any) => {
					const typeStyles = getOrderTypeStyles(order.orderType);
					const OrderIcon = typeStyles.icon;

					return (
						<Card
							key={order.id}
							className={`${typeStyles.bg} ${typeStyles.border}`}
							data-testid={`order-${order.id}`}
						>
							<CardContent className="p-4">
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-3">
										<div
											className={`p-2 rounded-full ${order.orderType === "buy" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}
										>
											<OrderIcon
												className={`h-4 w-4 ${typeStyles.iconColor}`}
											/>
										</div>
										<div>
											<div className="flex items-center gap-2">
												<p className="font-semibold">{order.bondName}</p>
												<Badge
													variant="outline"
													className={
														order.orderType === "buy"
															? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
															: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
													}
												>
													{typeStyles.label}
												</Badge>
											</div>
											<p className="text-sm text-muted-foreground">
												ISIN: {order.isin}
											</p>
										</div>
									</div>
									<Badge className={getStatusColor(order.orderStatus)}>
										{order.orderStatus.replace(/_/g, " ")}
									</Badge>
								</div>

								<div className="grid grid-cols-4 gap-4 text-sm">
									<div>
										<p className="text-muted-foreground">Type</p>
										<p
											className={`font-medium ${order.orderType === "buy" ? "text-emerald-600" : "text-red-600"}`}
										>
											{order.orderType === "buy" ? "Purchase" : "Redemption"}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">Quantity</p>
										<p className="font-medium">{order.quantity}</p>
									</div>
									<div>
										<p className="text-muted-foreground">Price</p>
										<p className="font-medium">
											₹
											{Number.parseFloat(
												order.orderPrice || order.price || "0",
											).toFixed(2)}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">
											{order.orderType === "buy" ? "Amount Paid" : "Proceeds"}
										</p>
										<p
											className={`font-medium ${order.orderType === "sell" ? "text-emerald-600" : ""}`}
										>
											₹
											{Number.parseFloat(
												order.netAmount || "0",
											).toLocaleString()}
										</p>
									</div>
								</div>

								{order.orderStatus === "pending_payment" &&
									order.orderType === "buy" && (
										<div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
											<Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
												<Clock className="h-4 w-4 text-blue-600" />
												<AlertDescription className="text-blue-700 dark:text-blue-300 flex items-center justify-between">
													<span>Payment pending for this order</span>
													<Button size="sm" data-testid={`btn-pay-${order.id}`}>
														Complete Payment
													</Button>
												</AlertDescription>
											</Alert>
										</div>
									)}

								{order.orderType === "sell" &&
									order.orderStatus === "awaiting_settlement" && (
										<div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
											<Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
												<Clock className="h-4 w-4 text-amber-600" />
												<AlertDescription className="text-amber-700 dark:text-amber-300">
													Sell order awaiting settlement. Proceeds will be
													credited to your bank account.
												</AlertDescription>
											</Alert>
										</div>
									)}

								{(order.settlementStatus || order.settlementDate) && (
									<div className="mt-3 pt-3 border-t border-border">
										<div className="flex items-center gap-2">
											<p className="text-sm text-muted-foreground">
												Settlement:
											</p>
											{order.settlementStatus && (
												<Badge variant="outline">
													{order.settlementStatus}
												</Badge>
											)}
											{order.settlementDate && (
												<span className="text-sm text-muted-foreground">
													{order.orderStatus === "completed"
														? "Completed"
														: "Expected"}
													:{" "}
													{new Date(order.settlementDate).toLocaleDateString()}
												</span>
											)}
										</div>
									</div>
								)}

								<div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
									<span>Order #{order.orderNumber}</span>
									<span>
										Order Date:{" "}
										{new Date(
											order.orderDate || order.createdAt,
										).toLocaleDateString()}
									</span>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}

export default function FixedIncomeMarketplace() {
	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Fixed Income Marketplace
					</h1>
					<p className="text-muted-foreground">
						Browse and invest in bonds, NCDs, G-Secs, and Sovereign Gold Bonds
					</p>
				</div>
				<Button
					variant="outline"
					className="gap-2"
					data-testid="btn-calculator"
				>
					<Calculator className="h-4 w-4" />
					Yield Calculator
				</Button>
			</div>

			<KYCWarningBanner />
			<SuitabilityCheckBanner />
			<PortfolioSummaryCard />

			<Tabs defaultValue="bonds" className="w-full">
				<ScrollableTabsList>
					<TabsTrigger value="bonds" data-testid="tab-bonds">
						<Landmark className="h-4 w-4 mr-2" />
						Bonds
					</TabsTrigger>
					<TabsTrigger value="ncd" data-testid="tab-ncd">
						<Receipt className="h-4 w-4 mr-2" />
						NCDs
					</TabsTrigger>
					<TabsTrigger value="sgb" data-testid="tab-sgb">
						<Coins className="h-4 w-4 mr-2" />
						SGBs
					</TabsTrigger>
					<TabsTrigger value="holdings" data-testid="tab-holdings">
						<Briefcase className="h-4 w-4 mr-2" />
						Holdings
					</TabsTrigger>
					<TabsTrigger value="orders" data-testid="tab-orders">
						<Clock className="h-4 w-4 mr-2" />
						Orders
					</TabsTrigger>
					<TabsTrigger value="reports" data-testid="tab-reports">
						<FileText className="h-4 w-4 mr-2" />
						Reports
					</TabsTrigger>
					<TabsTrigger value="watchlist" data-testid="tab-watchlist">
						<Star className="h-4 w-4 mr-2" />
						Watchlist
					</TabsTrigger>
				</ScrollableTabsList>

				<div className="mt-6">
					<TabsContent value="bonds">
						<BondsTab />
					</TabsContent>
					<TabsContent value="ncd">
						<NcdTab />
					</TabsContent>
					<TabsContent value="sgb">
						<SgbTab />
					</TabsContent>
					<TabsContent value="holdings">
						<HoldingsTab />
					</TabsContent>
					<TabsContent value="orders">
						<OrdersTab />
					</TabsContent>
					<TabsContent value="reports">
						<ReportsTab />
					</TabsContent>
					<TabsContent value="watchlist">
						<WatchlistTab />
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
