import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/LoadingState";
import { UnlistedOrderTracker } from "@/components/UnlistedOrderTracker";
import { SettlementDashboard } from "@/components/SettlementDashboard";
import {
	ArrowLeft,
	ShoppingCart,
	TrendingUp,
	Clock,
	CheckCircle2,
	XCircle,
	AlertTriangle,
	Building2,
	IndianRupee,
	Eye,
	RefreshCw,
	Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface BuyRequest {
	id: string;
	companyId: string;
	companyName?: string;
	quantity: number;
	maxPrice: string;
	targetPrice?: string;
	status: string;
	validUntil: string;
	createdAt: string;
	matchedAt?: string;
	paymentAt?: string;
	settledAt?: string;
}

interface SellListing {
	id: string;
	companyId: string;
	companyName?: string;
	quantity: number;
	askPrice: string;
	minPrice?: string;
	status: string;
	validUntil: string;
	createdAt: string;
	matchedAt?: string;
	settledAt?: string;
}

export default function MyOrders() {
	const [, navigate] = useLocation();
	const { user } = useAuth();
	const [activeTab, setActiveTab] = useState("buy");
	const [statusFilter, setStatusFilter] = useState<string>("all");

	const {
		data: buyRequestsData,
		isLoading: isLoadingBuys,
		refetch: refetchBuys,
	} = useQuery<{ data: BuyRequest[] }>({
		queryKey: ["/api/unlisted/my-buy-requests"],
		enabled: !!user,
	});

	const {
		data: sellListingsData,
		isLoading: isLoadingSells,
		refetch: refetchSells,
	} = useQuery<{ data: SellListing[] }>({
		queryKey: ["/api/unlisted/my-sell-listings"],
		enabled: !!user,
	});

	const buyRequests = buyRequestsData?.data || [];
	const sellListings = sellListingsData?.data || [];

	const filteredBuyRequests =
		statusFilter === "all"
			? buyRequests
			: buyRequests.filter((r) => r.status === statusFilter);

	const filteredSellListings =
		statusFilter === "all"
			? sellListings
			: sellListings.filter((l) => l.status === statusFilter);

	const getStatusBadge = (status: string) => {
		const statusConfig: Record<
			string,
			{
				variant: "default" | "secondary" | "destructive" | "outline";
				icon: any;
				label: string;
			}
		> = {
			pending: { variant: "outline", icon: Clock, label: "Pending" },
			active: { variant: "outline", icon: Clock, label: "Active" },
			matched: { variant: "default", icon: CheckCircle2, label: "Matched" },
			deal_matched: {
				variant: "default",
				icon: CheckCircle2,
				label: "Deal Matched",
			},
			payment_pending: {
				variant: "secondary",
				icon: AlertTriangle,
				label: "Payment Pending",
			},
			paid: { variant: "default", icon: CheckCircle2, label: "Paid" },
			transfer_pending: {
				variant: "secondary",
				icon: Clock,
				label: "Transfer Pending",
			},
			settled: { variant: "default", icon: CheckCircle2, label: "Settled" },
			completed: { variant: "default", icon: CheckCircle2, label: "Completed" },
			cancelled: { variant: "destructive", icon: XCircle, label: "Cancelled" },
			expired: { variant: "destructive", icon: XCircle, label: "Expired" },
			rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
		};

		const config = statusConfig[status] || statusConfig.pending;
		const Icon = config.icon;

		return (
			<Badge variant={config.variant} className="capitalize">
				<Icon className="w-3 h-3 mr-1" />
				{config.label}
			</Badge>
		);
	};

	const formatCurrency = (amount: string | number) => {
		const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
		return `₹${num.toLocaleString("en-IN")}`;
	};

	const isLoading = isLoadingBuys || isLoadingSells;

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background p-6">
				<LoadingState variant="card" count={4} />
			</div>
		);
	}

	return (
		<div
			className="min-h-screen bg-background p-4 md:p-6"
			data-testid="my-orders"
		>
			<div className="max-w-6xl mx-auto">
				<Button
					variant="ghost"
					onClick={() => navigate("/unlisted/browse")}
					className="mb-4"
					data-testid="button-back"
				>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to Marketplace
				</Button>

				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-2xl font-bold text-foreground">My Orders</h1>
						<p className="text-muted-foreground">
							Track your unlisted share buy requests and sell listings
						</p>
					</div>
					<Button
						variant="outline"
						onClick={() => {
							refetchBuys();
							refetchSells();
						}}
						data-testid="button-refresh"
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<div className="flex items-center justify-between mb-4">
						<TabsList>
							<TabsTrigger
								value="buy"
								className="flex items-center gap-2"
								data-testid="tab-buy"
							>
								<ShoppingCart className="h-4 w-4" />
								Buy Requests ({buyRequests.length})
							</TabsTrigger>
							<TabsTrigger
								value="sell"
								className="flex items-center gap-2"
								data-testid="tab-sell"
							>
								<TrendingUp className="h-4 w-4" />
								Sell Listings ({sellListings.length})
							</TabsTrigger>
							<TabsTrigger
								value="settlements"
								className="flex items-center gap-2"
								data-testid="tab-settlements"
							>
								<Wallet className="h-4 w-4" />
								Settlements
							</TabsTrigger>
						</TabsList>

						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger
								className="w-[150px]"
								data-testid="select-status-filter"
							>
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="matched">Matched</SelectItem>
								<SelectItem value="payment_pending">Payment Pending</SelectItem>
								<SelectItem value="settled">Settled</SelectItem>
								<SelectItem value="cancelled">Cancelled</SelectItem>
								<SelectItem value="expired">Expired</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<TabsContent value="buy" className="space-y-4">
						{filteredBuyRequests.length === 0 ? (
							<Card className="border-dashed">
								<CardContent className="flex flex-col items-center justify-center py-12">
									<ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium text-foreground mb-2">
										No Buy Requests
									</h3>
									<p className="text-muted-foreground mb-4">
										You haven't created any buy requests yet.
									</p>
									<Button
										onClick={() => navigate("/unlisted/buy")}
										data-testid="button-create-buy"
									>
										Create Buy Request
									</Button>
								</CardContent>
							</Card>
						) : (
							filteredBuyRequests.map((request) => (
								<Card
									key={request.id}
									className="overflow-hidden"
									data-testid={`buy-request-${request.id}`}
								>
									<CardHeader className="pb-2">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
													<Building2 className="h-5 w-5 text-blue-600" />
												</div>
												<div>
													<CardTitle className="text-lg">
														{request.companyName || "Unknown Company"}
													</CardTitle>
													<p className="text-sm text-muted-foreground">
														Buy Request •{" "}
														{new Date(request.createdAt).toLocaleDateString(
															"en-IN",
														)}
													</p>
												</div>
											</div>
											{getStatusBadge(request.status)}
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
											<div>
												<p className="text-sm text-muted-foreground">
													Quantity
												</p>
												<p className="font-semibold">
													{request.quantity.toLocaleString("en-IN")} shares
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Max Price
												</p>
												<p className="font-semibold flex items-center">
													<IndianRupee className="h-4 w-4" />
													{Number.parseFloat(request.maxPrice).toLocaleString(
														"en-IN",
													)}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Total Value
												</p>
												<p className="font-semibold flex items-center">
													<IndianRupee className="h-4 w-4" />
													{(
														request.quantity *
														Number.parseFloat(request.maxPrice)
													).toLocaleString("en-IN")}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Valid Until
												</p>
												<p className="font-semibold">
													{new Date(request.validUntil).toLocaleDateString(
														"en-IN",
													)}
												</p>
											</div>
										</div>

										{[
											"matched",
											"deal_matched",
											"payment_pending",
											"paid",
											"transfer_pending",
											"settled",
											"completed",
										].includes(request.status) && (
											<UnlistedOrderTracker
												status={request.status}
												createdAt={request.createdAt}
												matchedAt={request.matchedAt}
												paymentAt={request.paymentAt}
												settledAt={request.settledAt}
											/>
										)}

										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													navigate(`/unlisted/company/${request.companyId}`)
												}
												data-testid={`view-company-${request.id}`}
											>
												<Eye className="h-4 w-4 mr-1" />
												View Company
											</Button>
											{request.status === "payment_pending" && (
												<Button
													size="sm"
													onClick={() =>
														navigate(`/unlisted/pay/${request.id}`)
													}
													data-testid={`pay-${request.id}`}
												>
													Complete Payment
												</Button>
											)}
										</div>
									</CardContent>
								</Card>
							))
						)}
					</TabsContent>

					<TabsContent value="sell" className="space-y-4">
						{filteredSellListings.length === 0 ? (
							<Card className="border-dashed">
								<CardContent className="flex flex-col items-center justify-center py-12">
									<TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium text-foreground mb-2">
										No Sell Listings
									</h3>
									<p className="text-muted-foreground mb-4">
										You haven't created any sell listings yet.
									</p>
									<Button
										onClick={() => navigate("/unlisted/sell")}
										data-testid="button-create-sell"
									>
										Create Sell Listing
									</Button>
								</CardContent>
							</Card>
						) : (
							filteredSellListings.map((listing) => (
								<Card
									key={listing.id}
									className="overflow-hidden"
									data-testid={`sell-listing-${listing.id}`}
								>
									<CardHeader className="pb-2">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
													<Building2 className="h-5 w-5 text-emerald-600" />
												</div>
												<div>
													<CardTitle className="text-lg">
														{listing.companyName || "Unknown Company"}
													</CardTitle>
													<p className="text-sm text-muted-foreground">
														Sell Listing •{" "}
														{new Date(listing.createdAt).toLocaleDateString(
															"en-IN",
														)}
													</p>
												</div>
											</div>
											{getStatusBadge(listing.status)}
										</div>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
											<div>
												<p className="text-sm text-muted-foreground">
													Quantity
												</p>
												<p className="font-semibold">
													{listing.quantity.toLocaleString("en-IN")} shares
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Ask Price
												</p>
												<p className="font-semibold flex items-center">
													<IndianRupee className="h-4 w-4" />
													{Number.parseFloat(listing.askPrice).toLocaleString(
														"en-IN",
													)}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Total Value
												</p>
												<p className="font-semibold flex items-center">
													<IndianRupee className="h-4 w-4" />
													{(
														listing.quantity *
														Number.parseFloat(listing.askPrice)
													).toLocaleString("en-IN")}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Valid Until
												</p>
												<p className="font-semibold">
													{new Date(listing.validUntil).toLocaleDateString(
														"en-IN",
													)}
												</p>
											</div>
										</div>

										{[
											"matched",
											"deal_matched",
											"payment_pending",
											"transfer_pending",
											"settled",
											"completed",
										].includes(listing.status) && (
											<UnlistedOrderTracker
												status={listing.status}
												createdAt={listing.createdAt}
												matchedAt={listing.matchedAt}
												settledAt={listing.settledAt}
											/>
										)}

										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													navigate(`/unlisted/company/${listing.companyId}`)
												}
												data-testid={`view-company-sell-${listing.id}`}
											>
												<Eye className="h-4 w-4 mr-1" />
												View Company
											</Button>
										</div>
									</CardContent>
								</Card>
							))
						)}
					</TabsContent>

					<TabsContent value="settlements" className="space-y-4">
						<SettlementDashboard
							userRole={
								sellListings.length > buyRequests.length ? "seller" : "buyer"
							}
							userId={user?.id}
						/>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
