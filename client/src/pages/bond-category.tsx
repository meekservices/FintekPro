import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import {
	ArrowLeft,
	Search,
	Filter,
	SortAsc,
	SortDesc,
	Building2,
	Shield as LucideShield,
	TrendingUp,
	IndianRupee,
	Star,
	Clock,
	Percent,
	ChevronRight,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
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

const categoryConfig: Record<
	string,
	{
		title: string;
		description: string;
		icon: any;
		headerClass: string;
		instrumentTypes: string[];
	}
> = {
	government: {
		title: "Government Securities",
		description:
			"Risk-free investments backed by the Government of India including G-Secs, T-Bills, and SDLs",
		icon: LucideShield,
		headerClass: "bg-gradient-to-r from-blue-600 to-blue-700",
		instrumentTypes: ["gsec", "tbill", "sdl"],
	},
	corporate: {
		title: "Corporate Bonds",
		description:
			"Higher yield bonds issued by leading corporations with various credit ratings",
		icon: Building2,
		headerClass: "bg-gradient-to-r from-green-600 to-green-700",
		instrumentTypes: ["corporate_bond", "debenture"],
	},
	ncd: {
		title: "Non-Convertible Debentures (NCDs)",
		description:
			"Fixed-income instruments issued by corporations that cannot be converted to equity",
		icon: TrendingUp,
		headerClass: "bg-gradient-to-r from-purple-600 to-purple-700",
		instrumentTypes: ["ncd"],
	},
	"tax-free": {
		title: "Tax-Free Bonds",
		description:
			"Government-backed bonds with tax-exempt interest income under Section 10(15)",
		icon: IndianRupee,
		headerClass: "bg-gradient-to-r from-orange-600 to-orange-700",
		instrumentTypes: ["tax_free_bond"],
	},
	sgb: {
		title: "Sovereign Gold Bonds",
		description:
			"Government securities denominated in grams of gold with additional interest",
		icon: Star,
		headerClass: "bg-gradient-to-r from-yellow-500 to-yellow-600",
		instrumentTypes: ["sgb"],
	},
	"t-bill": {
		title: "Treasury Bills",
		description:
			"Short-term zero-coupon government securities with maturities up to 364 days",
		icon: Clock,
		headerClass: "bg-gradient-to-r from-cyan-600 to-cyan-700",
		instrumentTypes: ["tbill"],
	},
	infrastructure: {
		title: "Infrastructure Bonds",
		description: "Bonds issued by infrastructure companies with tax benefits",
		icon: Building2,
		headerClass: "bg-gradient-to-r from-teal-600 to-teal-700",
		instrumentTypes: ["infrastructure_bond"],
	},
};

export default function BondCategoryPage() {
	const [, params] = useRoute("/bonds/category/:category");
	const [, navigate] = useLocation();
	const category = params?.category || "government";

	const [searchTerm, setSearchTerm] = useState("");
	const [sortBy, setSortBy] = useState("yield");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
	const [ratingFilter, setRatingFilter] = useState("all");

	const config = categoryConfig[category] || categoryConfig.government;
	const Icon = config.icon;

	// Use the public enhanced-catalog endpoint which doesn't require KYC for viewing
	const {
		data: bondsResponse,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["/api/bonds/enhanced-catalog"],
		refetchInterval: 60000,
	});

	const allBonds: any[] =
		(bondsResponse as any)?.data?.bonds || (bondsResponse as any)?.bonds || [];

	// Filter bonds by instrument type for this category
	const categoryBonds = allBonds.filter((bond: any) => {
		const bondType = (bond.instrumentType || bond.bondType || "").toLowerCase();
		return config.instrumentTypes.some(
			(type) => bondType.includes(type) || type.includes(bondType),
		);
	});

	// Deduplicate by ISIN
	const seenIsins = new Set<string>();
	const bonds = categoryBonds.filter((bond: any) => {
		const isin = bond.isin || bond.id;
		if (seenIsins.has(isin)) return false;
		seenIsins.add(isin);
		return true;
	});

	// Filter and sort bonds
	const filteredBonds = bonds
		.filter((bond: any) => {
			const matchesSearch =
				(bond.name || bond.bondName || bond.issuerName || bond.issuer || "")
					.toLowerCase()
					.includes(searchTerm.toLowerCase()) ||
				(bond.isin || "").toLowerCase().includes(searchTerm.toLowerCase());

			const matchesRating =
				ratingFilter === "all" ||
				(bond.rating || bond.creditRating || "").includes(ratingFilter);

			return matchesSearch && matchesRating;
		})
		.sort((a: any, b: any) => {
			let aVal, bVal;
			switch (sortBy) {
				case "yield":
					aVal = Number.parseFloat(
						a.yieldToMaturity ||
							a.ytm ||
							a.currentYield ||
							a.indicativeYield ||
							0,
					);
					bVal = Number.parseFloat(
						b.yieldToMaturity ||
							b.ytm ||
							b.currentYield ||
							b.indicativeYield ||
							0,
					);
					break;
				case "coupon":
					aVal = Number.parseFloat(a.couponRate || 0);
					bVal = Number.parseFloat(b.couponRate || 0);
					break;
				case "maturity":
					aVal = new Date(a.maturityDate || 0).getTime();
					bVal = new Date(b.maturityDate || 0).getTime();
					break;
				case "price":
					aVal = Number.parseFloat(
						a.currentPrice || a.lastPrice || a.lastTradedPrice || 0,
					);
					bVal = Number.parseFloat(
						b.currentPrice || b.lastPrice || b.lastTradedPrice || 0,
					);
					break;
				default:
					aVal = a.name || a.bondName || "";
					bVal = b.name || b.bondName || "";
			}
			return sortOrder === "asc"
				? aVal > bVal
					? 1
					: -1
				: aVal < bVal
					? 1
					: -1;
		});

	const getRatingColor = (rating: string) => {
		if (!rating) return "bg-muted text-muted-foreground";
		if (rating.includes("AAA") || rating === "SOV")
			return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
		if (rating.includes("AA"))
			return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
		if (rating.includes("A"))
			return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
		return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300";
	};

	return (
		<div className="min-h-screen bg-muted">
			{/* Header */}
			<div className={`${config.headerClass} text-foreground`}>
				<div className="max-w-7xl mx-auto px-4 py-8">
					<Button
						variant="ghost"
						className="text-foreground hover:bg-card/20 mb-4"
						onClick={() => navigate("/bonds")}
						data-testid="back-to-bonds"
					>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Bonds
					</Button>

					<div className="flex items-center gap-4">
						<div className="p-4 rounded-xl bg-card/20">
							<Icon className="h-8 w-8" />
						</div>
						<div>
							<h1 className="text-3xl font-bold">{config.title}</h1>
							<p className="text-foreground/80 mt-1">{config.description}</p>
						</div>
					</div>

					<div className="mt-6 flex flex-wrap gap-4">
						<Badge className="bg-card/20 text-foreground border-0">
							{filteredBonds.length} Bonds Available
						</Badge>
						<Badge className="bg-card/20 text-foreground border-0">
							<Percent className="h-3 w-3 mr-1" />
							Avg Yield:{" "}
							{(
								filteredBonds.reduce(
									(sum: number, b: any) =>
										sum +
										Number.parseFloat(
											b.yieldToMaturity || b.ytm || b.currentYield || 0,
										),
									0,
								) / (filteredBonds.length || 1)
							).toFixed(2)}
							%
						</Badge>
					</div>
				</div>
			</div>

			{/* Filters */}
			<div className="max-w-7xl mx-auto px-4 py-6">
				<div className="flex flex-wrap gap-4 items-center bg-card p-4 rounded-lg shadow-sm">
					<div className="flex-1 min-w-[200px]">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search by name or ISIN..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
								data-testid="search-bonds"
							/>
						</div>
					</div>

					<Select value={ratingFilter} onValueChange={setRatingFilter}>
						<SelectTrigger className="w-[140px]" data-testid="filter-rating">
							<Filter className="h-4 w-4 mr-2" />
							<SelectValue placeholder="Rating" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Ratings</SelectItem>
							<SelectItem value="AAA">AAA</SelectItem>
							<SelectItem value="AA">AA+/AA/AA-</SelectItem>
							<SelectItem value="A">A+/A/A-</SelectItem>
							<SelectItem value="SOV">Sovereign</SelectItem>
						</SelectContent>
					</Select>

					<Select value={sortBy} onValueChange={setSortBy}>
						<SelectTrigger className="w-[140px]" data-testid="sort-by">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="yield">Yield</SelectItem>
							<SelectItem value="coupon">Coupon Rate</SelectItem>
							<SelectItem value="maturity">Maturity</SelectItem>
							<SelectItem value="price">Price</SelectItem>
						</SelectContent>
					</Select>

					<Button
						variant="outline"
						size="icon"
						onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
						data-testid="toggle-sort-order"
					>
						{sortOrder === "asc" ? (
							<SortAsc className="h-4 w-4" />
						) : (
							<SortDesc className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>

			{/* Bond List */}
			<div className="max-w-7xl mx-auto px-4 pb-8">
				{isLoading ? (
					<div className="grid gap-4">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<Card key={i}>
								<CardContent className="p-6">
									<Skeleton className="h-6 w-3/4 mb-4" />
									<Skeleton className="h-4 w-1/2 mb-4" />
									<div className="grid grid-cols-5 gap-4">
										<Skeleton className="h-10" />
										<Skeleton className="h-10" />
										<Skeleton className="h-10" />
										<Skeleton className="h-10" />
										<Skeleton className="h-10" />
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				) : error ? (
					<Card>
						<CardContent className="p-8 text-center">
							<p className="text-red-500">
								Failed to load bonds. Please try again.
							</p>
							<Button onClick={() => window.location.reload()} className="mt-4">
								Retry
							</Button>
						</CardContent>
					</Card>
				) : filteredBonds.length === 0 ? (
					<Card>
						<CardContent className="p-8 text-center">
							<Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
							<h3 className="text-lg font-semibold mb-2">No bonds found</h3>
							<p className="text-muted-foreground">
								{searchTerm
									? "Try adjusting your search or filters"
									: "No bonds available in this category"}
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4">
						{filteredBonds.map((bond: any) => (
							<Card
								key={bond.isin || bond.id}
								className="hover:shadow-lg transition-all cursor-pointer group"
								onClick={() =>
									navigate(`/bonds/detail/${bond.isin || bond.id}`)
								}
								data-testid={`bond-card-${bond.isin || bond.id}`}
							>
								<CardContent className="p-6">
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-3 mb-2">
												<h3 className="text-lg font-semibold text-foreground group-hover:text-blue-600 transition-colors">
													{bond.name ||
														bond.bondName ||
														bond.issuer ||
														bond.securityName ||
														"Unknown Bond"}
												</h3>
												<Badge
													className={getRatingColor(
														bond.rating || bond.creditRating,
													)}
												>
													{bond.rating || bond.creditRating || "NR"}
												</Badge>
												{bond.bondType && (
													<Badge variant="outline">
														{bond.bondType || bond.type}
													</Badge>
												)}
											</div>

											<p className="text-sm text-muted-foreground mb-4">
												ISIN: {bond.isin}{" "}
												{bond.issuer && `• Issuer: ${bond.issuer}`}
											</p>

											<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
												<div>
													<p className="text-xs text-muted-foreground">Yield</p>
													<p className="font-semibold text-green-600">
														{bond.yieldToMaturity ||
															bond.ytm ||
															bond.currentYield ||
															bond.indicativeYield ||
															"N/A"}
														%
													</p>
												</div>
												<div>
													<p className="text-xs text-muted-foreground">
														Coupon
													</p>
													<p className="font-semibold">
														{bond.couponRate &&
														Number.parseFloat(bond.couponRate) > 0
															? `${bond.couponRate}%`
															: "Zero Coupon"}
													</p>
												</div>
												<div>
													<p className="text-xs text-muted-foreground">
														Maturity
													</p>
													<p className="font-semibold">
														{bond.maturityDate
															? new Date(bond.maturityDate).toLocaleDateString()
															: "N/A"}
													</p>
												</div>
												<div>
													<p className="text-xs text-muted-foreground">
														Face Value
													</p>
													<p className="font-semibold">
														₹{(bond.faceValue || 1000).toLocaleString()}
													</p>
												</div>
												<div>
													<p className="text-xs text-muted-foreground">
														Last Price
													</p>
													<p className="font-semibold">
														₹
														{(
															bond.currentPrice ||
															bond.lastPrice ||
															bond.lastTradedPrice ||
															0
														).toLocaleString()}
													</p>
												</div>
											</div>
										</div>

										<div className="flex items-center gap-4 ml-4">
											<Button
												onClick={(e) => {
													e.stopPropagation();
													navigate(`/bonds/detail/${bond.isin || bond.id}`);
												}}
												data-testid={`view-details-${bond.isin || bond.id}`}
											>
												View Details
												<ChevronRight className="h-4 w-4 ml-1" />
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
