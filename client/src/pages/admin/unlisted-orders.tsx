import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { format } from "date-fns";
import {
	Search,
	Package,
	ShoppingCart,
	CheckCircle,
	XCircle,
	Clock,
	ArrowLeft,
	RefreshCw,
	Filter,
	Eye,
	Loader2,
	Building2,
	DollarSign,
	User,
	Calendar,
	AlertTriangle,
	Check,
	X,
	Handshake,
} from "lucide-react";

interface SellListing {
	id: string;
	companyId: string;
	companyName?: string;
	sellerUserId: string;
	quantity: number;
	quantityRemaining: number;
	askPrice: string;
	floorPrice?: string;
	landingPrice?: string;
	status: string;
	createdAt: string;
	expiresAt?: string;
}

interface BuyRequest {
	id: string;
	companyId: string;
	companyName?: string;
	buyerUserId: string;
	quantity: number;
	maxPrice: string;
	targetPrice?: string;
	status: string;
	createdAt: string;
	expiresAt?: string;
}

const formatCurrency = (value: string | number | null | undefined): string => {
	if (value === null || value === undefined) return "—";
	const num = typeof value === "string" ? Number.parseFloat(value) : value;
	if (Number.isNaN(num)) return "—";
	return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const StatusBadge = ({ status }: { status: string }) => {
	const statusConfig: Record<
		string,
		{
			label: string;
			variant: "default" | "secondary" | "destructive" | "outline";
		}
	> = {
		active: { label: "Active", variant: "default" },
		pending: { label: "Pending", variant: "secondary" },
		matched: { label: "Matched", variant: "default" },
		completed: { label: "Completed", variant: "default" },
		cancelled: { label: "Cancelled", variant: "destructive" },
		expired: { label: "Expired", variant: "outline" },
	};

	const config = statusConfig[status] || {
		label: status,
		variant: "outline" as const,
	};

	return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default function UnlistedOrders() {
	const { user, isLoading: authLoading } = useAuth();
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("listings");
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [selectedListing, setSelectedListing] = useState<SellListing | null>(
		null,
	);
	const [selectedBuyRequest, setSelectedBuyRequest] =
		useState<BuyRequest | null>(null);
	const [actionDialogOpen, setActionDialogOpen] = useState(false);
	const [actionType, setActionType] = useState<
		"approve" | "reject" | "match" | null
	>(null);

	const {
		data: listingsResponse,
		isLoading: listingsLoading,
		refetch: refetchListings,
	} = useQuery<{
		success: boolean;
		data: { listings: SellListing[]; pagination: any };
	}>({
		queryKey: ["/api/unlisted/admin/all-listings"],
	});
	const listings = listingsResponse?.data?.listings || [];

	const {
		data: buyRequestsResponse,
		isLoading: buyRequestsLoading,
		refetch: refetchBuyRequests,
	} = useQuery<{
		success: boolean;
		data: { buyRequests: BuyRequest[]; pagination: any };
	}>({
		queryKey: ["/api/unlisted/admin/all-buy-requests"],
	});
	const buyRequests = buyRequestsResponse?.data?.buyRequests || [];

	const updateListingMutation = useMutation({
		mutationFn: async ({ id, status }: { id: string; status: string }) => {
			return apiRequest(`/api/unlisted/admin/listings/${id}/status`, {
				method: "PATCH",
				body: JSON.stringify({ status }),
			});
		},
		onSuccess: () => {
			toast({ title: "Success", description: "Listing updated successfully" });
			refetchListings();
			setActionDialogOpen(false);
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to update listing",
				variant: "destructive",
			});
		},
	});

	const updateBuyRequestMutation = useMutation({
		mutationFn: async ({ id, status }: { id: string; status: string }) => {
			return apiRequest(`/api/unlisted/admin/buy-requests/${id}/status`, {
				method: "PATCH",
				body: JSON.stringify({ status }),
			});
		},
		onSuccess: () => {
			toast({
				title: "Success",
				description: "Buy request updated successfully",
			});
			refetchBuyRequests();
			setActionDialogOpen(false);
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to update buy request",
				variant: "destructive",
			});
		},
	});

	if (authLoading) {
		return <LoadingState />;
	}

	if (!user || !user.roles?.includes("admin")) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-background">
				<Card className="bg-card border-border max-w-md">
					<CardHeader>
						<CardTitle className="text-foreground text-center">
							Access Denied
						</CardTitle>
						<CardDescription className="text-muted-foreground text-center">
							Admin privileges required to access this page.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	const filteredListings = listings.filter((listing) => {
		const matchesSearch =
			!searchQuery ||
			listing.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			listing.id.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus =
			statusFilter === "all" || listing.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const filteredBuyRequests = buyRequests.filter((request) => {
		const matchesSearch =
			!searchQuery ||
			request.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			request.id.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus =
			statusFilter === "all" || request.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const handleAction = (
		type: "approve" | "reject" | "match",
		item: SellListing | BuyRequest,
		isListing: boolean,
	) => {
		if (isListing) {
			setSelectedListing(item as SellListing);
			setSelectedBuyRequest(null);
		} else {
			setSelectedBuyRequest(item as BuyRequest);
			setSelectedListing(null);
		}
		setActionType(type);
		setActionDialogOpen(true);
	};

	const confirmAction = () => {
		if (actionType === "approve") {
			if (selectedListing) {
				updateListingMutation.mutate({
					id: selectedListing.id,
					status: "active",
				});
			} else if (selectedBuyRequest) {
				updateBuyRequestMutation.mutate({
					id: selectedBuyRequest.id,
					status: "active",
				});
			}
		} else if (actionType === "reject") {
			if (selectedListing) {
				updateListingMutation.mutate({
					id: selectedListing.id,
					status: "cancelled",
				});
			} else if (selectedBuyRequest) {
				updateBuyRequestMutation.mutate({
					id: selectedBuyRequest.id,
					status: "cancelled",
				});
			}
		}
	};

	const activeListingsCount = listings.filter(
		(l) => l.status === "active",
	).length;
	const pendingListingsCount = listings.filter(
		(l) => l.status === "pending",
	).length;
	const activeBuyCount = buyRequests.filter(
		(r) => r.status === "active",
	).length;
	const pendingBuyCount = buyRequests.filter(
		(r) => r.status === "pending",
	).length;

	return (
		<div className="space-y-6 p-6">
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-4">
					<Link href="/admin/unlisted/dashboard">
						<Button
							variant="ghost"
							size="sm"
							data-testid="button-back-dashboard"
						>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Dashboard
						</Button>
					</Link>
					<div>
						<h1 className="text-3xl font-bold text-foreground">
							Order Management
						</h1>
						<p className="text-muted-foreground mt-1">
							Manage sell listings and buy requests
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					onClick={() => {
						refetchListings();
						refetchBuyRequests();
					}}
					className="border-border"
					data-testid="button-refresh-orders"
				>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card className="bg-muted/50 border-border">
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<Package className="h-8 w-8 text-green-400" />
							<div>
								<p className="text-2xl font-bold text-foreground">
									{activeListingsCount}
								</p>
								<p className="text-xs text-muted-foreground">Active Listings</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="bg-muted/50 border-border">
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<Clock className="h-8 w-8 text-yellow-400" />
							<div>
								<p className="text-2xl font-bold text-foreground">
									{pendingListingsCount}
								</p>
								<p className="text-xs text-muted-foreground">
									Pending Listings
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="bg-muted/50 border-border">
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<ShoppingCart className="h-8 w-8 text-blue-400" />
							<div>
								<p className="text-2xl font-bold text-foreground">
									{activeBuyCount}
								</p>
								<p className="text-xs text-muted-foreground">
									Active Buy Requests
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="bg-muted/50 border-border">
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<Clock className="h-8 w-8 text-orange-400" />
							<div>
								<p className="text-2xl font-bold text-foreground">
									{pendingBuyCount}
								</p>
								<p className="text-xs text-muted-foreground">
									Pending Requests
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card className="bg-card border-border">
				<CardHeader>
					<div className="flex flex-col md:flex-row gap-4 justify-between">
						<div className="flex gap-2">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search by company or ID..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9 bg-muted border-border"
									data-testid="input-search-orders"
								/>
							</div>
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger
									className="w-[140px] bg-muted border-border"
									data-testid="select-status-filter"
								>
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="pending">Pending</SelectItem>
									<SelectItem value="matched">Matched</SelectItem>
									<SelectItem value="completed">Completed</SelectItem>
									<SelectItem value="cancelled">Cancelled</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="grid w-full grid-cols-2 bg-muted">
							<TabsTrigger
								value="listings"
								className="data-[state=active]:bg-muted"
								data-testid="tab-listings"
							>
								<Package className="h-4 w-4 mr-2" />
								Sell Listings ({filteredListings.length})
							</TabsTrigger>
							<TabsTrigger
								value="requests"
								className="data-[state=active]:bg-muted"
								data-testid="tab-requests"
							>
								<ShoppingCart className="h-4 w-4 mr-2" />
								Buy Requests ({filteredBuyRequests.length})
							</TabsTrigger>
						</TabsList>

						<TabsContent value="listings" className="mt-4">
							{listingsLoading ? (
								<div className="flex justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : filteredListings.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
									<p>No sell listings found</p>
								</div>
							) : (
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="border-border">
												<TableHead className="text-muted-foreground">
													Company
												</TableHead>
												<TableHead className="text-muted-foreground">
													Seller
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													Quantity
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													Ask Price
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													Floor Price
												</TableHead>
												<TableHead className="text-muted-foreground">
													Status
												</TableHead>
												<TableHead className="text-muted-foreground">
													Created
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													Actions
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredListings.map((listing) => (
												<TableRow
													key={listing.id}
													className="border-border"
													data-testid={`row-listing-${listing.id}`}
												>
													<TableCell>
														<div className="flex items-center gap-2">
															<Building2 className="h-4 w-4 text-muted-foreground" />
															<span className="text-foreground font-medium">
																{listing.companyName || "Unknown"}
															</span>
														</div>
													</TableCell>
													<TableCell className="text-muted-foreground text-sm">
														{listing.sellerUserId.substring(0, 8)}...
													</TableCell>
													<TableCell className="text-right text-foreground">
														{listing.quantityRemaining}/{listing.quantity}
													</TableCell>
													<TableCell className="text-right text-green-400 font-medium">
														{formatCurrency(listing.askPrice)}
													</TableCell>
													<TableCell className="text-right text-muted-foreground">
														{formatCurrency(listing.floorPrice)}
													</TableCell>
													<TableCell>
														<StatusBadge status={listing.status} />
													</TableCell>
													<TableCell className="text-muted-foreground text-sm">
														{format(new Date(listing.createdAt), "MMM d, yyyy")}
													</TableCell>
													<TableCell className="text-right">
														<div className="flex justify-end gap-1">
															<Link
																href={`/admin/unlisted/preview/${listing.companyId}`}
															>
																<Button
																	variant="ghost"
																	size="sm"
																	data-testid={`button-view-listing-${listing.id}`}
																>
																	<Eye className="h-4 w-4" />
																</Button>
															</Link>
															{listing.status === "pending" && (
																<>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="text-green-400 hover:text-green-300"
																		onClick={() =>
																			handleAction("approve", listing, true)
																		}
																		data-testid={`button-approve-listing-${listing.id}`}
																	>
																		<Check className="h-4 w-4" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="text-red-400 hover:text-red-300"
																		onClick={() =>
																			handleAction("reject", listing, true)
																		}
																		data-testid={`button-reject-listing-${listing.id}`}
																	>
																		<X className="h-4 w-4" />
																	</Button>
																</>
															)}
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</TabsContent>

						<TabsContent value="requests" className="mt-4">
							{buyRequestsLoading ? (
								<div className="flex justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : filteredBuyRequests.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
									<p>No buy requests found</p>
								</div>
							) : (
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="border-border">
												<TableHead className="text-muted-foreground">
													Company
												</TableHead>
												<TableHead className="text-muted-foreground">
													Buyer
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													Quantity
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													Max Price
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													Target Price
												</TableHead>
												<TableHead className="text-muted-foreground">
													Status
												</TableHead>
												<TableHead className="text-muted-foreground">
													Created
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													Actions
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredBuyRequests.map((request) => (
												<TableRow
													key={request.id}
													className="border-border"
													data-testid={`row-request-${request.id}`}
												>
													<TableCell>
														<div className="flex items-center gap-2">
															<Building2 className="h-4 w-4 text-muted-foreground" />
															<span className="text-foreground font-medium">
																{request.companyName || "Unknown"}
															</span>
														</div>
													</TableCell>
													<TableCell className="text-muted-foreground text-sm">
														{request.buyerUserId.substring(0, 8)}...
													</TableCell>
													<TableCell className="text-right text-foreground">
														{request.quantity}
													</TableCell>
													<TableCell className="text-right text-blue-400 font-medium">
														{formatCurrency(request.maxPrice)}
													</TableCell>
													<TableCell className="text-right text-muted-foreground">
														{formatCurrency(request.targetPrice)}
													</TableCell>
													<TableCell>
														<StatusBadge status={request.status} />
													</TableCell>
													<TableCell className="text-muted-foreground text-sm">
														{format(new Date(request.createdAt), "MMM d, yyyy")}
													</TableCell>
													<TableCell className="text-right">
														<div className="flex justify-end gap-1">
															<Link
																href={`/admin/unlisted/preview/${request.companyId}`}
															>
																<Button
																	variant="ghost"
																	size="sm"
																	data-testid={`button-view-request-${request.id}`}
																>
																	<Eye className="h-4 w-4" />
																</Button>
															</Link>
															{request.status === "pending" && (
																<>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="text-green-400 hover:text-green-300"
																		onClick={() =>
																			handleAction("approve", request, false)
																		}
																		data-testid={`button-approve-request-${request.id}`}
																	>
																		<Check className="h-4 w-4" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="text-red-400 hover:text-red-300"
																		onClick={() =>
																			handleAction("reject", request, false)
																		}
																		data-testid={`button-reject-request-${request.id}`}
																	>
																		<X className="h-4 w-4" />
																	</Button>
																</>
															)}
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			<Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
				<DialogContent className="bg-card border-border">
					<DialogHeader>
						<DialogTitle className="text-foreground">
							{actionType === "approve"
								? "Approve"
								: actionType === "reject"
									? "Reject"
									: "Match"}{" "}
							Order
						</DialogTitle>
						<DialogDescription>
							{actionType === "approve" &&
								"This will activate the order for trading."}
							{actionType === "reject" &&
								"This will cancel the order permanently."}
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						{(selectedListing || selectedBuyRequest) && (
							<div className="space-y-2 text-sm">
								<p className="text-muted-foreground">
									<span className="text-foreground font-medium">Company:</span>{" "}
									{selectedListing?.companyName ||
										selectedBuyRequest?.companyName ||
										"Unknown"}
								</p>
								<p className="text-muted-foreground">
									<span className="text-foreground font-medium">Quantity:</span>{" "}
									{selectedListing?.quantity || selectedBuyRequest?.quantity}
								</p>
								<p className="text-muted-foreground">
									<span className="text-foreground font-medium">Price:</span>{" "}
									{formatCurrency(
										selectedListing?.askPrice || selectedBuyRequest?.maxPrice,
									)}
								</p>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setActionDialogOpen(false)}
							data-testid="button-cancel-action"
						>
							Cancel
						</Button>
						<Button
							variant={actionType === "reject" ? "destructive" : "default"}
							onClick={confirmAction}
							disabled={
								updateListingMutation.isPending ||
								updateBuyRequestMutation.isPending
							}
							data-testid="button-confirm-action"
						>
							{(updateListingMutation.isPending ||
								updateBuyRequestMutation.isPending) && (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							)}
							Confirm{" "}
							{actionType === "approve"
								? "Approval"
								: actionType === "reject"
									? "Rejection"
									: "Match"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
