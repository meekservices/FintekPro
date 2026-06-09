import { useState, useEffect } from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
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
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Building2,
	IndianRupee,
	TrendingUp,
	ArrowUpRight,
	Search,
	Filter,
	BarChart3,
	PieChart,
	Clock,
	Shield as LucideShield,
	Award,
	Target,
	Zap,
	Star,
	Eye,
	RefreshCw,
	ShoppingCart,
	ClipboardList,
	Wallet,
	Package,
	FileText,
	CheckCircle2,
	AlertTriangle,
	Banknote,
	ThumbsUp,
	ThumbsDown,
	Edit2,
	Bot,
	UserCheck,
	Trash2,
	CreditCard,
	AlertOctagon,
	Sparkles,
	Calculator,
	ArrowRight,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ExpressInterestButton } from "@/components/ExpressInterestDialog";
import { LoadingState } from "@/components/LoadingState";

const PRODUCT_TYPE = "aif";

function ProposalsTab({
	productType,
	onApprove,
}: { productType: string; onApprove: () => void }) {
	const { toast } = useToast();

	const {
		data: proposals,
		isLoading,
		refetch,
	} = useQuery<any[]>({
		queryKey: ["/api/proposals", { productType }],
	});

	const approveMutation = useMutation({
		mutationFn: async (proposalId: string) => {
			return apiRequest(`/api/proposals/${proposalId}/approve`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			toast({
				title: "Proposal Approved",
				description: "Added to your investment cart",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
			onApprove();
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to approve proposal",
				variant: "destructive",
			});
		},
	});

	const rejectMutation = useMutation({
		mutationFn: async (proposalId: string) => {
			return apiRequest(`/api/proposals/${proposalId}/reject`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			toast({
				title: "Proposal Rejected",
				description: "The proposal has been declined",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to reject proposal",
				variant: "destructive",
			});
		},
	});

	const pendingProposals =
		proposals?.filter(
			(p) => p.status === "pending" && p.productType === productType,
		) || [];

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
				<span className="ml-2 text-muted-foreground">Loading proposals...</span>
			</div>
		);
	}

	if (pendingProposals.length === 0) {
		return (
			<Card className="border-dashed border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
				<CardContent className="flex flex-col items-center justify-center py-16">
					<Bot className="w-16 h-16 text-blue-400 mb-4" />
					<h3 className="text-xl font-semibold text-foreground mb-2">
						No Pending AIF Proposals
					</h3>
					<p className="text-muted-foreground text-center max-w-md mb-4">
						AI-generated and agent recommendations for Alternative Investment
						Funds will appear here based on your risk profile.
					</p>
					<Button
						variant="outline"
						onClick={() => refetch()}
						className="border-blue-300 dark:border-blue-700 text-blue-600 hover:bg-blue-50 dark:bg-blue-950/30"
					>
						<RefreshCw className="w-4 h-4 mr-2" />
						Refresh Proposals
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{pendingProposals.map((proposal) => (
				<Card
					key={proposal.id}
					className="overflow-hidden hover:shadow-lg transition-shadow"
					data-testid={`aif-proposal-${proposal.id}`}
				>
					<CardContent className="p-0">
						<div className="flex">
							<div
								className={`w-2 ${proposal.proposalSource === "ai" ? "bg-gradient-to-b from-blue-500 to-indigo-600" : "bg-gradient-to-b from-cyan-500 to-teal-600"}`}
							/>
							<div className="flex-1 p-6">
								<div className="flex items-start justify-between mb-4">
									<div>
										<div className="flex items-center gap-2 mb-2">
											{proposal.proposalSource === "ai" ? (
												<Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
													<Bot className="w-3 h-3 mr-1" />
													AI Generated
												</Badge>
											) : (
												<Badge className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800">
													<UserCheck className="w-3 h-3 mr-1" />
													Agent Recommended
												</Badge>
											)}
											<Badge
												variant="outline"
												className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
											>
												AIF
											</Badge>
										</div>
										<h3 className="text-lg font-semibold text-foreground">
											{proposal.title}
										</h3>
										<p className="text-sm text-muted-foreground mt-1">
											{proposal.description}
										</p>
									</div>
									<div className="text-right">
										<p className="text-2xl font-bold text-foreground flex items-center justify-end">
											<IndianRupee className="w-5 h-5" />
											{Number.parseFloat(
												proposal.totalInvestmentAmount || "0",
											).toLocaleString("en-IN")}
										</p>
										<p className="text-sm text-muted-foreground">
											Min Investment
										</p>
									</div>
								</div>

								{proposal.analysisRationale && (
									<div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800">
										<div className="flex items-start gap-2">
											<Sparkles className="w-5 h-5 text-blue-500 mt-0.5" />
											<div>
												<p className="font-medium text-blue-800 dark:text-blue-300 text-sm">
													Investment Rationale
												</p>
												<p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
													{proposal.analysisRationale}
												</p>
											</div>
										</div>
									</div>
								)}

								<div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-muted rounded-lg">
									<div className="text-center">
										<p className="text-sm text-muted-foreground">
											Expected Return
										</p>
										<p className="text-lg font-bold text-emerald-600">
											{proposal.expectedReturns
												? `${proposal.expectedReturns}%`
												: "N/A"}
										</p>
									</div>
									<div className="text-center">
										<p className="text-sm text-muted-foreground">
											Lock-in Period
										</p>
										<p className="text-lg font-bold text-foreground">
											{proposal.lockIn || "3 Years"}
										</p>
									</div>
									<div className="text-center">
										<p className="text-sm text-muted-foreground">Risk Level</p>
										<p className="text-lg font-bold text-amber-600">
											{proposal.riskProfile || "High"}
										</p>
									</div>
								</div>

								<div className="flex gap-3">
									<Button
										className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
										onClick={() => approveMutation.mutate(proposal.id)}
										disabled={approveMutation.isPending}
										data-testid={`approve-aif-${proposal.id}`}
									>
										{approveMutation.isPending ? (
											<RefreshCw className="w-4 h-4 mr-2 animate-spin" />
										) : (
											<ThumbsUp className="w-4 h-4 mr-2" />
										)}
										Approve & Add to Cart
									</Button>
									<Button
										variant="outline"
										className="border-red-300 dark:border-red-700 text-red-600 hover:bg-red-50 dark:bg-red-950/30"
										onClick={() => rejectMutation.mutate(proposal.id)}
										disabled={rejectMutation.isPending}
										data-testid={`reject-aif-${proposal.id}`}
									>
										<ThumbsDown className="w-4 h-4 mr-2" />
										Reject
									</Button>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function CartTab({
	productType,
	onCheckout,
}: { productType: string; onCheckout: () => void }) {
	const { toast } = useToast();

	const { data: cartData, isLoading } = useQuery<any>({
		queryKey: ["/api/cart", { productCategory: productType }],
	});

	const removeFromCartMutation = useMutation({
		mutationFn: async (itemId: string) => {
			return apiRequest(`/api/cart/items/${itemId}`, { method: "DELETE" });
		},
		onSuccess: () => {
			toast({
				title: "Removed from Cart",
				description: "Item removed successfully",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
		},
	});

	const checkoutMutation = useMutation({
		mutationFn: async () => {
			const results = [];
			for (const item of cartItems) {
				if (item.proposalId) {
					const result = await apiRequest(
						`/api/proposals/${item.proposalId}/complete-order`,
						{
							method: "POST",
							body: JSON.stringify({
								orderType: "LUMPSUM",
								productType: "aif",
							}),
						},
					);
					results.push(result);
					await apiRequest(`/api/cart/items/${item.id}`, { method: "DELETE" });
				}
			}
			return results;
		},
		onSuccess: () => {
			toast({
				title: "Order Placed!",
				description: "Your AIF investment order has been submitted",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
			queryClient.invalidateQueries({ queryKey: ["/api/store/aif/orders"] });
			onCheckout();
		},
	});

	const cartItems =
		cartData?.items?.filter(
			(item: any) =>
				item.productCategory === productType || item.category === productType,
		) || [];
	const totalValue = cartItems.reduce(
		(sum: number, item: any) =>
			sum + Number.parseFloat(item.amount || item.quantity || "0"),
		0,
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
			</div>
		);
	}

	if (cartItems.length === 0) {
		return (
			<Card className="border-dashed border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
				<CardContent className="flex flex-col items-center justify-center py-16">
					<ShoppingCart className="w-16 h-16 text-blue-400 mb-4" />
					<h3 className="text-xl font-semibold text-foreground mb-2">
						Your AIF Cart is Empty
					</h3>
					<p className="text-muted-foreground text-center max-w-md mb-4">
						Approve investment proposals to add them to your cart for checkout.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<div className="lg:col-span-2 space-y-4">
				{cartItems.map((item: any, index: number) => (
					<Card
						key={item.id || index}
						className="overflow-hidden"
						data-testid={`aif-cart-item-${index}`}
					>
						<CardContent className="p-4">
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<Package className="w-5 h-5 text-blue-600" />
										<h4 className="font-semibold text-foreground">
											{item.productName || item.schemeName || "AIF Investment"}
										</h4>
										<Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
											AIF
										</Badge>
									</div>
								</div>
								<div className="text-right">
									<p className="text-xl font-bold text-foreground flex items-center justify-end">
										<IndianRupee className="w-4 h-4" />
										{Number.parseFloat(
											item.amount || item.quantity || "0",
										).toLocaleString("en-IN")}
									</p>
									<Button
										variant="ghost"
										size="sm"
										className="text-red-500 hover:text-red-700 dark:text-red-300 mt-2"
										onClick={() => removeFromCartMutation.mutate(item.id)}
										data-testid={`remove-aif-${index}`}
									>
										<Trash2 className="w-4 h-4 mr-1" />
										Remove
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			<div className="lg:col-span-1">
				<Card className="sticky top-4 border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CreditCard className="w-5 h-5 text-blue-600" />
							Order Summary
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Total Items</span>
								<span className="font-medium">{cartItems.length}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Subtotal</span>
								<span className="font-medium flex items-center">
									<IndianRupee className="w-3 h-3" />
									{totalValue.toLocaleString("en-IN")}
								</span>
							</div>
						</div>
						<div className="border-t pt-4">
							<div className="flex justify-between text-lg font-bold">
								<span>Total Payable</span>
								<span className="flex items-center text-blue-600">
									<IndianRupee className="w-4 h-4" />
									{totalValue.toLocaleString("en-IN")}
								</span>
							</div>
						</div>
						<div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 text-sm">
							<div className="flex items-start gap-2">
								<AlertOctagon className="w-4 h-4 text-amber-600 mt-0.5" />
								<div>
									<p className="font-medium text-amber-800 dark:text-amber-300">
										AIF Investment Notice
									</p>
									<p className="text-amber-700 dark:text-amber-400 text-xs">
										Minimum investment ₹1 Crore. Lock-in periods apply per
										scheme terms.
									</p>
								</div>
							</div>
						</div>
						<Button
							className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-foreground font-semibold py-6"
							onClick={() => checkoutMutation.mutate()}
							disabled={checkoutMutation.isPending || cartItems.length === 0}
							data-testid="aif-checkout-btn"
						>
							{checkoutMutation.isPending ? (
								<>
									<RefreshCw className="w-5 h-5 mr-2 animate-spin" />
									Processing...
								</>
							) : (
								<>
									<CreditCard className="w-5 h-5 mr-2" />
									Proceed to Payment
								</>
							)}
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function OrdersTab({ productType }: { productType: string }) {
	const { data: orders, isLoading } = useQuery<any[]>({
		queryKey: ["/api/store/aif/orders"],
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
			</div>
		);
	}

	if (!orders || orders.length === 0) {
		return (
			<Card className="border-dashed border-2 border-border">
				<CardContent className="flex flex-col items-center justify-center py-16">
					<FileText className="w-16 h-16 text-muted-foreground mb-4" />
					<h3 className="text-xl font-semibold text-foreground mb-2">
						No AIF Orders Yet
					</h3>
					<p className="text-muted-foreground">
						Your AIF investment orders will appear here once placed.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{orders.map((order: any) => (
				<Card key={order.id} data-testid={`aif-order-${order.id}`}>
					<CardContent className="p-6">
						<div className="flex items-start justify-between mb-4">
							<div>
								<h4 className="font-semibold text-lg">
									{order.schemeName || order.productName}
								</h4>
								<p className="text-sm text-muted-foreground">
									Order #{order.id?.slice(-8)}
								</p>
							</div>
							<Badge
								className={
									order.status === "completed"
										? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
										: order.status === "pending"
											? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
											: "bg-muted text-muted-foreground"
								}
							>
								{order.status}
							</Badge>
						</div>
						<div className="grid grid-cols-4 gap-4 text-sm">
							<div>
								<span className="text-muted-foreground">Amount</span>
								<p className="font-semibold">
									₹
									{Number.parseFloat(order.amount || "0").toLocaleString(
										"en-IN",
									)}
								</p>
							</div>
							<div>
								<span className="text-muted-foreground">Order Date</span>
								<p className="font-semibold">
									{order.createdAt
										? new Date(order.createdAt).toLocaleDateString("en-IN")
										: "N/A"}
								</p>
							</div>
							<div>
								<span className="text-muted-foreground">Type</span>
								<p className="font-semibold">{order.orderType || "Lumpsum"}</p>
							</div>
							<div>
								<span className="text-muted-foreground">Payment</span>
								<p className="font-semibold">
									{order.paymentStatus || "Pending"}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function PortfolioTab({ productType }: { productType: string }) {
	const { data: holdings, isLoading } = useQuery<any[]>({
		queryKey: ["/api/portfolio/holdings", { productType }],
	});

	if (isLoading) {
		return <LoadingState variant="card" count={3} />;
	}

	if (!holdings || holdings.length === 0) {
		return (
			<Card className="border-dashed border-2 border-border">
				<CardContent className="flex flex-col items-center justify-center py-16">
					<Wallet className="w-16 h-16 text-muted-foreground mb-4" />
					<h3 className="text-xl font-semibold text-foreground mb-2">
						No AIF Holdings
					</h3>
					<p className="text-muted-foreground">
						Your AIF investments will appear here once purchased.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{holdings.map((holding: any) => (
				<Card key={holding.id}>
					<CardContent className="p-6">
						<div className="flex justify-between items-start">
							<div>
								<h4 className="font-semibold">{holding.schemeName}</h4>
								<p className="text-sm text-muted-foreground">
									{holding.fundHouse}
								</p>
							</div>
							<div className="text-right">
								<p className="text-xl font-bold">
									₹
									{Number.parseFloat(
										holding.currentValue || "0",
									).toLocaleString("en-IN")}
								</p>
								<p
									className={`text-sm ${Number.parseFloat(holding.returns || "0") >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									{Number.parseFloat(holding.returns || "0") >= 0 ? "+" : ""}
									{holding.returns}%
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export default function AIF() {
	const [, navigate] = useLocation();
	const [activeTab, setActiveTab] = useState("schemes");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [selectedStyle, setSelectedStyle] = useState("all");
	const [selectedStatus, setSelectedStatus] = useState("active");
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState("name");

	const { data: aifResponse, isLoading } = useQuery<{
		schemes: any[];
		pagination: any;
	}>({
		queryKey: [
			"/api/store/aif",
			{
				status: selectedStatus,
				category: selectedCategory !== "all" ? selectedCategory : undefined,
				style: selectedStyle !== "all" ? selectedStyle : undefined,
				search: searchQuery || undefined,
				sortBy,
			},
		],
		refetchInterval: 300000,
	});

	const { data: cartData } = useQuery<any>({ queryKey: ["/api/cart"] });
	const { data: proposalData } = useQuery<any[]>({
		queryKey: ["/api/proposals"],
	});

	const displayData = aifResponse?.schemes || [];
	const pendingProposals =
		proposalData?.filter(
			(p) => p.status === "pending" && p.productType === "aif",
		)?.length || 0;
	const cartCount =
		cartData?.items?.filter((i: any) => i.productCategory === "aif")?.length ||
		0;

	const statistics = {
		totalFunds: aifResponse?.pagination?.total || displayData.length,
		totalAUM: displayData.reduce(
			(sum: number, fund: any) => sum + (Number.parseFloat(fund.aum) || 0),
			0,
		),
		averageReturns:
			displayData.length > 0
				? displayData.reduce(
						(sum: number, f: any) => sum + (Number.parseFloat(f.return1Y) || 0),
						0,
					) / displayData.length
				: 0,
		activeAMCs: new Set(
			displayData.map((f: any) => f.fundHouseName).filter(Boolean),
		).size,
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-finance-light p-8" data-testid="aif-page">
				<LoadingState variant="card" count={4} />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-finance-light" data-testid="aif-page">
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-foreground mb-4">
						Alternative Investment Funds (AIF)
					</h1>
					<p className="text-muted-foreground text-lg max-w-3xl">
						Explore sophisticated investment opportunities with professionally
						managed AIF portfolios across Category I, II, and III funds.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Total AIF Funds
									</p>
									<p className="text-3xl font-bold text-finance-blue">
										{statistics.totalFunds}
									</p>
								</div>
								<Building2 className="w-10 h-10 text-finance-blue" />
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Total AUM
									</p>
									<p className="text-3xl font-bold text-green-600">
										₹{(statistics.totalAUM / 10000000000).toFixed(0)} Cr
									</p>
								</div>
								<IndianRupee className="w-10 h-10 text-green-600" />
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Avg. 1Y Returns
									</p>
									<p className="text-3xl font-bold text-purple-600">
										+{statistics.averageReturns.toFixed(1)}%
									</p>
								</div>
								<BarChart3 className="w-10 h-10 text-purple-600" />
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Active AMCs
									</p>
									<p className="text-3xl font-bold text-amber-600">
										{statistics.activeAMCs}
									</p>
								</div>
								<Award className="w-10 h-10 text-amber-600" />
							</div>
						</CardContent>
					</Card>
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<ScrollableTabsList className="grid w-full grid-cols-6 mb-6">
						<TabsTrigger
							value="schemes"
							data-testid="tab-schemes"
							className="flex items-center gap-2"
						>
							<Building2 className="w-4 h-4" />
							Published Schemes
						</TabsTrigger>
						<TabsTrigger
							value="proposals"
							data-testid="tab-proposals"
							className="flex items-center gap-2"
						>
							<ClipboardList className="w-4 h-4" />
							Proposals
							{pendingProposals > 0 && (
								<Badge className="ml-1 bg-blue-500 text-white text-xs">
									{pendingProposals}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger
							value="cart"
							data-testid="tab-cart"
							className="flex items-center gap-2"
						>
							<ShoppingCart className="w-4 h-4" />
							Cart
							{cartCount > 0 && (
								<Badge className="ml-1 bg-orange-500 text-white text-xs">
									{cartCount}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger
							value="orders"
							data-testid="tab-orders"
							className="flex items-center gap-2"
						>
							<FileText className="w-4 h-4" />
							Orders
						</TabsTrigger>
						<TabsTrigger
							value="portfolio"
							data-testid="tab-portfolio"
							className="flex items-center gap-2"
						>
							<Wallet className="w-4 h-4" />
							My Portfolio
						</TabsTrigger>
						<TabsTrigger
							value="tools"
							data-testid="tab-tools"
							className="flex items-center gap-2"
						>
							<Calculator className="w-4 h-4" />
							Tools
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent value="schemes" className="space-y-6">
						<div className="flex flex-wrap gap-4 mb-6">
							<div className="flex-1 min-w-[200px]">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
									<Input
										placeholder="Search AIF schemes..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-10"
										data-testid="search-aif"
									/>
								</div>
							</div>
							<Select
								value={selectedCategory}
								onValueChange={setSelectedCategory}
							>
								<SelectTrigger
									className="w-[180px]"
									data-testid="filter-category"
								>
									<SelectValue placeholder="Category" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Categories</SelectItem>
									<SelectItem value="Category I">Category I</SelectItem>
									<SelectItem value="Category II">Category II</SelectItem>
									<SelectItem value="Category III">Category III</SelectItem>
								</SelectContent>
							</Select>
							<Select value={selectedStyle} onValueChange={setSelectedStyle}>
								<SelectTrigger
									className="w-[180px]"
									data-testid="filter-subcategory"
								>
									<SelectValue placeholder="Subcategory" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Subcategories</SelectItem>
									<SelectItem value="venture_capital">
										Venture Capital (Cat I)
									</SelectItem>
									<SelectItem value="sme_fund">SME Fund (Cat I)</SelectItem>
									<SelectItem value="social_venture">
										Social Venture (Cat I)
									</SelectItem>
									<SelectItem value="infrastructure">
										Infrastructure (Cat I)
									</SelectItem>
									<SelectItem value="private_equity">
										Private Equity (Cat II)
									</SelectItem>
									<SelectItem value="debt_fund">Debt Fund (Cat II)</SelectItem>
									<SelectItem value="fund_of_funds">
										Fund of Funds (Cat II)
									</SelectItem>
									<SelectItem value="hedge_fund">
										Hedge Fund (Cat III)
									</SelectItem>
									<SelectItem value="pipe_fund">PIPE Fund (Cat III)</SelectItem>
									<SelectItem value="long_short">
										Long-Short (Cat III)
									</SelectItem>
								</SelectContent>
							</Select>
							<Select value={selectedStatus} onValueChange={setSelectedStatus}>
								<SelectTrigger
									className="w-[180px]"
									data-testid="filter-status"
								>
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="soft_close">Soft Close</SelectItem>
									<SelectItem value="hard_close">Hard Close</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{displayData.map((scheme: any) => (
								<Card
									key={scheme.id}
									className="hover:shadow-lg transition-shadow cursor-pointer"
									onClick={() => navigate(`/aif/${scheme.id}`)}
									data-testid={`aif-scheme-${scheme.id}`}
								>
									<CardHeader>
										<div className="flex justify-between items-start">
											<CardTitle className="text-lg">{scheme.name}</CardTitle>
											<Badge variant="outline">
												{scheme.category || "Cat II"}
											</Badge>
										</div>
										<CardDescription>{scheme.fundHouseName}</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">
													Min Investment
												</span>
												<span className="font-semibold">
													₹
													{(
														Number.parseFloat(
															scheme.minInvestment || "10000000",
														) / 10000000
													).toFixed(0)}{" "}
													Cr
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">
													1Y Returns
												</span>
												<span
													className={`font-semibold ${Number.parseFloat(scheme.return1Y || "0") >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{Number.parseFloat(scheme.return1Y || "0") >= 0
														? "+"
														: ""}
													{scheme.return1Y || "N/A"}%
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">AUM</span>
												<span className="font-semibold">
													₹
													{(
														Number.parseFloat(scheme.aum || "0") / 10000000
													).toFixed(0)}{" "}
													Cr
												</span>
											</div>
											<ExpressInterestButton
												productId={scheme.id}
												productType="aif"
												productName={scheme.name}
											/>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</TabsContent>

					<TabsContent value="proposals">
						<ProposalsTab
							productType={PRODUCT_TYPE}
							onApprove={() => setActiveTab("cart")}
						/>
					</TabsContent>

					<TabsContent value="cart">
						<CartTab
							productType={PRODUCT_TYPE}
							onCheckout={() => setActiveTab("orders")}
						/>
					</TabsContent>

					<TabsContent value="orders">
						<OrdersTab productType={PRODUCT_TYPE} />
					</TabsContent>

					<TabsContent value="portfolio">
						<PortfolioTab productType={PRODUCT_TYPE} />
					</TabsContent>

					<TabsContent value="tools">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<Card
								className="hover:shadow-lg transition-shadow cursor-pointer"
								onClick={() => navigate("/calculators")}
							>
								<CardContent className="p-6 text-center">
									<Calculator className="w-12 h-12 text-blue-600 mx-auto mb-4" />
									<h3 className="font-semibold text-lg mb-2">
										Investment Calculator
									</h3>
									<p className="text-sm text-muted-foreground">
										Calculate returns on AIF investments
									</p>
								</CardContent>
							</Card>
							<Card className="hover:shadow-lg transition-shadow cursor-pointer">
								<CardContent className="p-6 text-center">
									<PieChart className="w-12 h-12 text-green-600 mx-auto mb-4" />
									<h3 className="font-semibold text-lg mb-2">
										Risk Assessment
									</h3>
									<p className="text-sm text-muted-foreground">
										Evaluate your risk tolerance
									</p>
								</CardContent>
							</Card>
							<Card className="hover:shadow-lg transition-shadow cursor-pointer">
								<CardContent className="p-6 text-center">
									<Target className="w-12 h-12 text-purple-600 mx-auto mb-4" />
									<h3 className="font-semibold text-lg mb-2">Goal Planning</h3>
									<p className="text-sm text-muted-foreground">
										Plan your investment goals
									</p>
								</CardContent>
							</Card>
						</div>
					</TabsContent>
				</Tabs>
			</main>
		</div>
	);
}
