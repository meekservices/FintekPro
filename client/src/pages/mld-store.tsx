import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Search,
	TrendingUp,
	TrendingDown,
	Clock,
	Building2,
	Shield as LucideShield,
	AlertTriangle,
	Info,
	ArrowRight,
	ChartLine,
	Calendar,
	Percent,
	IndianRupee,
	BarChart3,
	Layers,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ExpressInterestButton } from "@/components/ExpressInterestDialog";

interface MldMaster {
	id: string;
	isin: string;
	name: string;
	issuer: string;
	issueDate: string;
	maturityDate: string;
	faceValue: string;
	issuePrice?: string;
	couponRate?: string;
	couponFrequency?: string;
	underlying: string;
	payoffType: string;
	barrierLevel?: string;
	participationRate?: string;
	capLevel?: string;
	floorLevel?: string;
	strikePrice?: string;
	knockInLevel?: string;
	knockOutLevel?: string;
	minInvestment?: string;
	lotSize?: number;
	creditRating?: string;
	ratingAgency?: string;
	listingType: string;
	exchange?: string;
	sector?: string;
	category?: string;
	status: string;
	riskScore?: number;
	description?: string;
	lastTradedPrice?: string;
	lastNavDate?: string;
	isPublished: boolean;
	createdAt: string;
}

interface MldListResponse {
	mlds: MldMaster[];
	total: number;
	limit: number;
	offset: number;
}

const PAYOFF_TYPE_LABELS: Record<
	string,
	{ label: string; color: string; description: string }
> = {
	digital: {
		label: "Digital",
		color: "bg-blue-500",
		description: "Fixed payoff if condition is met",
	},
	barrier: {
		label: "Barrier",
		color: "bg-purple-500",
		description: "Payoff depends on barrier breach",
	},
	sharkfin: {
		label: "Shark Fin",
		color: "bg-indigo-500",
		description: "Capped upside with protection",
	},
	range: {
		label: "Range Accrual",
		color: "bg-cyan-500",
		description: "Accrues return in price range",
	},
	participation: {
		label: "Participation",
		color: "bg-green-500",
		description: "Direct market participation",
	},
	autocall: {
		label: "Autocall",
		color: "bg-orange-500",
		description: "Early redemption on trigger",
	},
	snowball: {
		label: "Snowball",
		color: "bg-pink-500",
		description: "Accumulating coupon structure",
	},
};

const UNDERLYING_ICONS: Record<string, string> = {
	"NIFTY 50": "📈",
	"BANK NIFTY": "🏦",
	SENSEX: "📊",
	GOLD: "🥇",
	"S&P 500": "🇺🇸",
};

const formatCurrency = (value: number | string | null | undefined) => {
	if (value === null || value === undefined) return "—";
	const num = typeof value === "string" ? Number.parseFloat(value) : value;
	if (Number.isNaN(num)) return "—";
	if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
	if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
	return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const getRiskBadge = (riskScore?: number) => {
	if (!riskScore) return null;
	if (riskScore <= 3) return <Badge className="bg-green-600">Low Risk</Badge>;
	if (riskScore <= 6)
		return <Badge className="bg-yellow-500">Medium Risk</Badge>;
	return <Badge className="bg-red-600">High Risk</Badge>;
};

const getRatingBadge = (rating?: string) => {
	if (!rating) return null;
	const color = rating.startsWith("AAA")
		? "bg-green-600"
		: rating.startsWith("AA")
			? "bg-blue-600"
			: rating.startsWith("A")
				? "bg-yellow-500"
				: "bg-orange-500";
	return <Badge className={color}>{rating}</Badge>;
};

const getDaysToMaturity = (maturityDate?: string) => {
	if (!maturityDate) return "—";
	try {
		const days = differenceInDays(parseISO(maturityDate), new Date());
		if (days < 0) return "Matured";
		if (days < 30) return `${days} days`;
		if (days < 365) return `${Math.floor(days / 30)} months`;
		return `${(days / 365).toFixed(1)} years`;
	} catch {
		return "—";
	}
};

const MldCard = ({ mld }: { mld: MldMaster }) => {
	const [, navigate] = useLocation();
	const payoffInfo = PAYOFF_TYPE_LABELS[mld.payoffType] || {
		label: mld.payoffType,
		color: "bg-muted",
		description: "",
	};
	const underlyingIcon = UNDERLYING_ICONS[mld.underlying] || "📊";

	return (
		<Card
			className="hover:shadow-lg transition-shadow cursor-pointer group"
			onClick={() => navigate(`/mld/${mld.id}`)}
			data-testid={`mld-card-${mld.id}`}
		>
			<CardHeader className="pb-2">
				<div className="flex justify-between items-start gap-2">
					<div className="flex-1 min-w-0">
						<CardTitle className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
							{mld.name}
						</CardTitle>
						<CardDescription className="flex items-center gap-2 mt-1">
							<Building2 className="w-3 h-3" />
							<span className="truncate">{mld.issuer}</span>
						</CardDescription>
					</div>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger>
								<Badge className={`${payoffInfo.color} text-foreground`}>
									{payoffInfo.label}
								</Badge>
							</TooltipTrigger>
							<TooltipContent>
								<p>{payoffInfo.description}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
				<div className="flex gap-2 mt-2 flex-wrap">
					{getRatingBadge(mld.creditRating)}
					{getRiskBadge(mld.riskScore)}
					<Badge variant="outline" className="text-xs">
						{mld.listingType === "listed" ? "Listed" : "Unlisted"}
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">ISIN:</span>
						<span className="font-mono text-xs">{mld.isin}</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xl">{underlyingIcon}</span>
						<span className="font-medium">{mld.underlying}</span>
					</div>
					<div>
						<span className="text-muted-foreground">Face Value:</span>
						<p className="font-semibold">{formatCurrency(mld.faceValue)}</p>
					</div>
					<div>
						<span className="text-muted-foreground">Min Investment:</span>
						<p className="font-semibold">{formatCurrency(mld.minInvestment)}</p>
					</div>
				</div>

				<Separator className="my-3" />

				<div className="flex justify-between items-center text-sm">
					<div className="flex items-center gap-1 text-muted-foreground">
						<Clock className="w-4 h-4" />
						<span>{getDaysToMaturity(mld.maturityDate)}</span>
					</div>
					{mld.couponRate && (
						<div className="flex items-center gap-1 text-green-600">
							<Percent className="w-4 h-4" />
							<span className="font-semibold">{mld.couponRate}% p.a.</span>
						</div>
					)}
					{mld.lastTradedPrice && (
						<div className="flex items-center gap-1">
							<IndianRupee className="w-4 h-4" />
							<span className="font-semibold">
								{formatCurrency(mld.lastTradedPrice)}
							</span>
						</div>
					)}
				</div>

				{mld.barrierLevel && (
					<div className="mt-2 p-2 bg-muted/50 rounded text-xs">
						<div className="flex items-center gap-1">
							<LucideShield className="w-3 h-3" />
							<span>Barrier: {mld.barrierLevel}%</span>
							{mld.participationRate && (
								<span>| Participation: {mld.participationRate}%</span>
							)}
						</div>
					</div>
				)}
			</CardContent>

			<CardFooter className="pt-0 flex gap-2">
				<Button
					variant="outline"
					className="flex-1"
					onClick={(e) => {
						e.stopPropagation();
						navigate(`/mld/${mld.id}`);
					}}
				>
					View Details <ArrowRight className="w-4 h-4 ml-2" />
				</Button>
				<ExpressInterestButton
					productType="mld"
					productId={mld.id}
					productName={mld.name}
					minInvestment={mld.minInvestment}
					size="default"
					className="flex-1"
				/>
			</CardFooter>
		</Card>
	);
};

const MldCardSkeleton = () => (
	<Card>
		<CardHeader>
			<Skeleton className="h-6 w-3/4" />
			<Skeleton className="h-4 w-1/2 mt-2" />
			<div className="flex gap-2 mt-2">
				<Skeleton className="h-5 w-16" />
				<Skeleton className="h-5 w-20" />
			</div>
		</CardHeader>
		<CardContent>
			<div className="space-y-3">
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		</CardContent>
		<CardFooter>
			<Skeleton className="h-10 w-full" />
		</CardFooter>
	</Card>
);

export default function MldStorePage() {
	const { user } = useAuth();
	const [search, setSearch] = useState("");
	const [payoffFilter, setPayoffFilter] = useState<string>("all");
	const [underlyingFilter, setUnderlyingFilter] = useState<string>("all");
	const [listingFilter, setListingFilter] = useState<string>("all");
	const [sortBy, setSortBy] = useState<string>("newest");
	const [activeTab, setActiveTab] = useState("browse");

	const { data, isLoading, error } = useQuery<MldListResponse>({
		queryKey: [
			"/api/store/mld",
			{ search, payoffType: payoffFilter !== "all" ? payoffFilter : undefined },
		],
	});

	const filteredAndSortedMlds = useMemo(() => {
		if (!data?.mlds) return [];

		let result = [...data.mlds];

		if (underlyingFilter !== "all") {
			result = result.filter((m) => m.underlying === underlyingFilter);
		}
		if (listingFilter !== "all") {
			result = result.filter((m) => m.listingType === listingFilter);
		}

		switch (sortBy) {
			case "maturity":
				result.sort(
					(a, b) =>
						new Date(a.maturityDate).getTime() -
						new Date(b.maturityDate).getTime(),
				);
				break;
			case "rating":
				result.sort((a, b) =>
					(b.creditRating || "").localeCompare(a.creditRating || ""),
				);
				break;
			case "risk_low":
				result.sort((a, b) => (a.riskScore || 10) - (b.riskScore || 10));
				break;
			case "risk_high":
				result.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
				break;
			default:
				result.sort(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
				);
		}

		return result;
	}, [data?.mlds, underlyingFilter, listingFilter, sortBy]);

	const uniqueUnderlyings = useMemo(() => {
		if (!data?.mlds) return [];
		return Array.from(new Set(data.mlds.map((m) => m.underlying)));
	}, [data?.mlds]);

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-2">
						<Layers className="w-8 h-8 text-primary" />
						Market Linked Debentures
					</h1>
					<p className="text-muted-foreground mt-1">
						Explore structured products with market-linked returns
					</p>
				</div>

				{user && (
					<Link href="/alternative-investments">
						<Button variant="outline" data-testid="link-portfolio">
							<BarChart3 className="w-4 h-4 mr-2" />
							My Portfolio
						</Button>
					</Link>
				)}
			</div>

			<Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
				<Info className="h-4 w-4 text-blue-600" />
				<AlertDescription className="text-blue-800 dark:text-blue-200">
					MLDs offer capital-efficient exposure to market indices with
					structured payoff profiles. These are suitable for investors with
					higher risk appetite seeking market-linked returns.
				</AlertDescription>
			</Alert>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<ScrollableTabsList>
					<TabsTrigger value="browse" data-testid="tab-browse">
						<Search className="w-4 h-4 mr-2" /> Browse MLDs
					</TabsTrigger>
					<TabsTrigger value="payoff-types" data-testid="tab-payoff">
						<ChartLine className="w-4 h-4 mr-2" /> Payoff Types
					</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value="browse" className="mt-6 space-y-4">
					<div className="grid gap-4 md:grid-cols-5">
						<div className="md:col-span-2">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
								<Input
									placeholder="Search by name, ISIN, or issuer..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-10"
									data-testid="input-search"
								/>
							</div>
						</div>

						<Select value={payoffFilter} onValueChange={setPayoffFilter}>
							<SelectTrigger data-testid="select-payoff">
								<SelectValue placeholder="Payoff Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Payoff Types</SelectItem>
								{Object.entries(PAYOFF_TYPE_LABELS).map(([key, { label }]) => (
									<SelectItem key={key} value={key}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={underlyingFilter}
							onValueChange={setUnderlyingFilter}
						>
							<SelectTrigger data-testid="select-underlying">
								<SelectValue placeholder="Underlying" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Underlyings</SelectItem>
								{uniqueUnderlyings.map((u) => (
									<SelectItem key={u} value={u}>
										{UNDERLYING_ICONS[u] || "📊"} {u}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select value={sortBy} onValueChange={setSortBy}>
							<SelectTrigger data-testid="select-sort">
								<SelectValue placeholder="Sort By" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="newest">Newest First</SelectItem>
								<SelectItem value="maturity">Maturity Date</SelectItem>
								<SelectItem value="rating">Rating (High to Low)</SelectItem>
								<SelectItem value="risk_low">Risk (Low to High)</SelectItem>
								<SelectItem value="risk_high">Risk (High to Low)</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex gap-2 flex-wrap">
						<Button
							variant={listingFilter === "all" ? "default" : "outline"}
							size="sm"
							onClick={() => setListingFilter("all")}
							data-testid="filter-all"
						>
							All
						</Button>
						<Button
							variant={listingFilter === "listed" ? "default" : "outline"}
							size="sm"
							onClick={() => setListingFilter("listed")}
							data-testid="filter-listed"
						>
							Listed
						</Button>
						<Button
							variant={listingFilter === "unlisted" ? "default" : "outline"}
							size="sm"
							onClick={() => setListingFilter("unlisted")}
							data-testid="filter-unlisted"
						>
							Unlisted
						</Button>
					</div>

					{isLoading && (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{[1, 2, 3, 4, 5, 6].map((i) => (
								<MldCardSkeleton key={i} />
							))}
						</div>
					)}

					{error && (
						<Alert variant="destructive">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>
								Failed to load MLDs. Please try again later.
							</AlertDescription>
						</Alert>
					)}

					{!isLoading && !error && filteredAndSortedMlds.length === 0 && (
						<div className="text-center py-12">
							<Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="text-lg font-semibold">No MLDs Found</h3>
							<p className="text-muted-foreground">
								{search || payoffFilter !== "all" || underlyingFilter !== "all"
									? "Try adjusting your filters"
									: "New MLDs will appear here once published"}
							</p>
						</div>
					)}

					{!isLoading && !error && filteredAndSortedMlds.length > 0 && (
						<>
							<p className="text-sm text-muted-foreground">
								Showing {filteredAndSortedMlds.length} of {data?.total || 0}{" "}
								MLDs
							</p>
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								{filteredAndSortedMlds.map((mld) => (
									<MldCard key={mld.id} mld={mld} />
								))}
							</div>
						</>
					)}
				</TabsContent>

				<TabsContent value="payoff-types" className="mt-6">
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{Object.entries(PAYOFF_TYPE_LABELS).map(
							([key, { label, color, description }]) => (
								<Card key={key} className="hover:shadow-md transition-shadow">
									<CardHeader>
										<div className="flex items-center gap-2">
											<div className={`w-3 h-3 rounded-full ${color}`} />
											<CardTitle className="text-lg">{label}</CardTitle>
										</div>
									</CardHeader>
									<CardContent>
										<p className="text-muted-foreground">{description}</p>
										<div className="mt-4 p-3 bg-muted rounded-lg">
											{key === "digital" && (
												<p className="text-sm">
													Example: If Nifty &gt; 18,000 at maturity, receive 12%
													return; otherwise receive principal only.
												</p>
											)}
											{key === "barrier" && (
												<p className="text-sm">
													Example: If Nifty never falls below 70% of initial,
													receive full principal + bonus. If breached, linked to
													index performance.
												</p>
											)}
											{key === "sharkfin" && (
												<p className="text-sm">
													Example: Participate in Nifty upside up to 25% cap
													with 100% principal protection if index doesn't breach
													-30% barrier.
												</p>
											)}
											{key === "range" && (
												<p className="text-sm">
													Example: Earn 0.5% for each day Nifty closes between
													17,000-19,000. Annual return = Days in range × 0.5%.
												</p>
											)}
											{key === "participation" && (
												<p className="text-sm">
													Example: Participate in 80% of Nifty upside with
													principal protection on downside.
												</p>
											)}
											{key === "autocall" && (
												<p className="text-sm">
													Example: If Nifty is above 105% of initial on any
													observation date, product auto-redeems with 15% bonus.
												</p>
											)}
											{key === "snowball" && (
												<p className="text-sm">
													Example: Miss a coupon if index falls &gt;10%;
													accumulated missed coupons paid when index recovers.
												</p>
											)}
										</div>
									</CardContent>
									<CardFooter>
										<Button
											variant="ghost"
											className="w-full"
											onClick={() => {
												setPayoffFilter(key);
												setActiveTab("browse");
											}}
											data-testid={`btn-filter-${key}`}
										>
											View {label} MLDs <ArrowRight className="w-4 h-4 ml-2" />
										</Button>
									</CardFooter>
								</Card>
							),
						)}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
