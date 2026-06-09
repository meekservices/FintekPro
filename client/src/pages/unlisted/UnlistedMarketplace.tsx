import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { LoadingState } from "@/components/LoadingState";
import {
	Building2,
	Search,
	TrendingUp,
	ShoppingCart,
	Eye,
	Heart,
	MessageSquarePlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
	UnlistedCompany,
	CompanyRatios,
	UnlistedPriceHistory,
} from "@shared/schema";

interface WatchlistCompany {
	id: string;
	[key: string]: any;
}

export default function UnlistedMarketplace() {
	const [, navigate] = useLocation();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedSector, setSelectedSector] = useState<string>("all");
	const { isAuthenticated } = useAuth();

	// Fetch companies
	const { data: companies = [], isLoading: isLoadingCompanies } = useQuery<
		UnlistedCompany[]
	>({
		queryKey: ["/api/unlisted/companies"],
	});

	// Fetch user's watchlist to determine which companies are watched
	const { data: watchlistData } = useQuery<WatchlistCompany[]>({
		queryKey: ["/api/unlisted/watchlist"],
		enabled: isAuthenticated,
	});

	// Extract company IDs from watchlist for quick lookup
	const watchlistIds = new Set((watchlistData || []).map((c) => c.id));

	// Filter companies
	const filteredCompanies = companies.filter((company) => {
		const matchesSearch =
			company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			company.sector?.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesSector =
			selectedSector === "all" || company.sector === selectedSector;
		return matchesSearch && matchesSector && company.status === "active";
	});

	// Get unique sectors
	const sectors = Array.from(
		new Set(companies.map((c) => c.sector).filter(Boolean)),
	) as string[];

	const formatCurrency = (amount: number | string | null | undefined) => {
		if (!amount) return "₹0";
		const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
		if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
		if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
		return `₹${num.toLocaleString("en-IN")}`;
	};

	if (isLoadingCompanies) {
		return (
			<div className="min-h-screen bg-background p-6">
				<LoadingState variant="card" count={6} />
			</div>
		);
	}

	return (
		<div
			className="min-h-screen bg-background p-4 md:p-6"
			data-testid="unlisted-marketplace"
		>
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-foreground mb-2">
						Unlisted Marketplace
					</h1>
					<p className="text-muted-foreground">
						Browse and invest in pre-IPO and unlisted equity opportunities
					</p>
				</div>

				{/* Filters */}
				<Card className="mb-6 bg-background">
					<CardContent className="pt-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							{/* Search */}
							<div className="md:col-span-2 relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search by company name or sector..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-10"
									data-testid="input-search"
								/>
							</div>

							{/* Sector Filter */}
							<Select value={selectedSector} onValueChange={setSelectedSector}>
								<SelectTrigger data-testid="select-sector">
									<SelectValue placeholder="All Sectors" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Sectors</SelectItem>
									{sectors.map((sector) => (
										<SelectItem key={sector} value={sector}>
											{sector}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</CardContent>
				</Card>

				{/* Quick Actions */}
				<div className="flex gap-3 mb-6">
					<Button
						onClick={() => navigate("/unlisted/sell")}
						data-testid="button-create-sell-listing"
					>
						<TrendingUp className="h-4 w-4 mr-2" />
						Create Sell Listing
					</Button>
					<Button
						variant="outline"
						onClick={() => navigate("/unlisted/buy")}
						data-testid="button-create-buy-request"
					>
						<ShoppingCart className="h-4 w-4 mr-2" />
						Create Buy Request
					</Button>
				</div>

				{/* Company Grid */}
				{filteredCompanies.length > 0 ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{filteredCompanies.map((company) => (
							<CompanyCard
								key={company.id}
								company={company}
								isInWatchlist={watchlistIds.has(company.id)}
							/>
						))}
					</div>
				) : (
					<Card className="bg-background">
						<CardContent className="py-12 text-center">
							<Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
							<p className="text-muted-foreground">
								{searchQuery || selectedSector !== "all"
									? "No companies found matching your filters"
									: "No companies available at the moment"}
							</p>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}

interface CompanyCardProps {
	company: UnlistedCompany;
	isInWatchlist: boolean;
}

function CompanyCard({ company, isInWatchlist }: CompanyCardProps) {
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const { isAuthenticated } = useAuth();

	// Fetch latest ratio data for this company
	const { data: ratios = [] } = useQuery<CompanyRatios[]>({
		queryKey: ["/api/unlisted/companies", company.id, "ratios"],
	});

	// Fetch price history
	const { data: priceHistory = [] } = useQuery<UnlistedPriceHistory[]>({
		queryKey: ["/api/unlisted/companies", company.id, "price-history"],
	});

	// Watchlist mutation - add
	const addToWatchlistMutation = useMutation({
		mutationFn: async () => {
			return apiRequest(`/api/unlisted/watchlist/${company.id}`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/watchlist"] });
			toast({
				title: "Added to watchlist",
				description: `${company.name} added to your watchlist`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to add to watchlist",
				variant: "destructive",
			});
		},
	});

	// Watchlist mutation - remove
	const removeFromWatchlistMutation = useMutation({
		mutationFn: async () => {
			return apiRequest(`/api/unlisted/watchlist/${company.id}`, {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/unlisted/watchlist"] });
			toast({
				title: "Removed from watchlist",
				description: `${company.name} removed from your watchlist`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to remove from watchlist",
				variant: "destructive",
			});
		},
	});

	// Express interest mutation
	const expressInterestMutation = useMutation({
		mutationFn: async () => {
			return apiRequest(`/api/unlisted/express-interest/${company.id}`, {
				method: "POST",
				body: JSON.stringify({ notes: "Interest expressed from marketplace" }),
			});
		},
		onSuccess: () => {
			toast({
				title: "Interest Registered",
				description: `You'll be notified when ${company.name} shares become available`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to express interest",
				variant: "destructive",
			});
		},
	});

	const handleWatchlistToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!isAuthenticated) {
			toast({
				title: "Login Required",
				description: "Please login to use the watchlist feature",
				variant: "destructive",
			});
			return;
		}
		if (isInWatchlist) {
			removeFromWatchlistMutation.mutate();
		} else {
			addToWatchlistMutation.mutate();
		}
	};

	const handleExpressInterest = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!isAuthenticated) {
			toast({
				title: "Login Required",
				description: "Please login to express interest",
				variant: "destructive",
			});
			return;
		}
		expressInterestMutation.mutate();
	};

	const latestRatio = ratios[0];
	const lastPrice = priceHistory.find((p) => p.sourceType === "DEAL")?.price;

	const formatCurrency = (amount: number | string | null | undefined) => {
		if (!amount) return "₹0";
		const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
		if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
		if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
		return `₹${num.toLocaleString("en-IN")}`;
	};

	return (
		<Card
			className="hover:shadow-lg transition-shadow cursor-pointer bg-background border border-border"
			onClick={() => navigate(`/unlisted/company/${company.id}`)}
			data-testid={`card-company-${company.id}`}
		>
			<CardHeader>
				<div className="flex items-start gap-4">
					{company.logo ? (
						<div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
							<img
								src={company.logo}
								alt={company.name}
								className="w-full h-full object-cover"
							/>
						</div>
					) : (
						<div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
							<Building2 className="h-6 w-6 text-primary" />
						</div>
					)}
					<div className="flex-1 min-w-0">
						<CardTitle
							className="text-lg mb-2 truncate"
							data-testid={`text-company-name-${company.id}`}
						>
							{company.name}
						</CardTitle>
						{company.sector && (
							<Badge variant="secondary" className="text-xs">
								{company.sector}
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{/* Last Price */}
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Last Price</span>
						<span
							className="font-semibold text-foreground"
							data-testid={`text-price-${company.id}`}
						>
							{formatCurrency(lastPrice)}
						</span>
					</div>

					{/* P/E Ratio */}
					{latestRatio?.peRatio && (
						<div className="flex justify-between items-center">
							<span className="text-sm text-muted-foreground">P/E Ratio</span>
							<span
								className="font-semibold text-foreground"
								data-testid={`text-pe-${company.id}`}
							>
								{Number(latestRatio.peRatio).toFixed(2)}
							</span>
						</div>
					)}

					{/* ROE */}
					{latestRatio?.roe && (
						<div className="flex justify-between items-center">
							<span className="text-sm text-muted-foreground">ROE</span>
							<span
								className="font-semibold text-foreground"
								data-testid={`text-roe-${company.id}`}
							>
								{(Number(latestRatio.roe) * 100).toFixed(2)}%
							</span>
						</div>
					)}

					{/* Listing Stage */}
					{company.listingStage && (
						<div className="pt-2">
							<Badge
								variant="outline"
								className="w-full justify-center capitalize"
							>
								{company.listingStage.replace("_", " ")}
							</Badge>
						</div>
					)}

					{/* Actions */}
					<div className="flex gap-2 pt-2">
						<Button
							size="sm"
							className="flex-1"
							onClick={(e) => {
								e.stopPropagation();
								navigate(`/unlisted/company/${company.id}`);
							}}
							data-testid={`button-view-details-${company.id}`}
						>
							<Eye className="h-3 w-3 mr-1" />
							View Details
						</Button>
						<Button
							size="sm"
							variant={isInWatchlist ? "default" : "outline"}
							onClick={handleWatchlistToggle}
							disabled={
								addToWatchlistMutation.isPending ||
								removeFromWatchlistMutation.isPending
							}
							data-testid={`button-watchlist-${company.id}`}
						>
							<Heart
								className={`h-3 w-3 ${isInWatchlist ? "fill-current" : ""}`}
							/>
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={handleExpressInterest}
							disabled={expressInterestMutation.isPending}
							title="Express Interest"
							data-testid={`button-interest-${company.id}`}
						>
							<MessageSquarePlus className="h-3 w-3" />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
