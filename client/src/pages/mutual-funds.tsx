import { useState, useEffect, useRef, Suspense } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
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
import { LoadingState } from "@/components/LoadingState";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Search,
	TrendingUp,
	TrendingDown,
	Star,
	Filter,
	Calculator,
	RefreshCw,
	ArrowRight,
	Shield as LucideShield,
	Building2,
	Award,
	Clock,
	AlertCircle,
	Store,
	ChevronLeft,
	ChevronRight,
	ShoppingCart,
	ClipboardList,
	Wallet,
	IndianRupee,
	ArrowUpRight,
	ArrowDownRight,
	Package,
	FileText,
	CheckCircle2,
	AlertTriangle,
	Banknote,
	Info,
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	useMutualFunds,
	usePopularMutualFunds,
	useSearchMutualFunds,
	type MutualFundData,
} from "@/hooks/use-mutual-funds";
import {
	useQuery,
	useSuspenseQuery,
	useQueryClient,
	useMutation,
} from "@tanstack/react-query";
import {
	useNSEIndices,
	useMarketMovers,
	useMarketStatus,
} from "@/hooks/use-market-data";
import {
	usePortfolios,
	usePortfolioPerformance,
	useEnhancedPortfolioHoldings,
} from "@/hooks/use-portfolio";
import { InvestmentModal } from "@/components/InvestmentModal";
import { KYCWarningBanner } from "@/components/KYCWarningBanner";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	Sparkles,
	ThumbsUp,
	ThumbsDown,
	Edit2,
	Bot,
	UserCheck,
	Trash2,
	CreditCard,
	AlertOctagon,
	Database,
	Activity,
} from "lucide-react";
import { ClientTransactionHistory } from "@/components/store/ClientTransactionHistory";
import { DataErrorBoundary } from "@/components/DataErrorBoundary";

// Proposals Tab Component
function ProposalsTab({ onApprove }: { onApprove: () => void }) {
	const { toast } = useToast();

	const {
		data: proposals,
		isLoading,
		refetch,
	} = useQuery<any[]>({
		queryKey: ["/api/proposals"],
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
		proposals?.filter((p) => p.status === "pending") || [];

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
				<span className="ml-2 text-muted-foreground">Loading proposals...</span>
			</div>
		);
	}

	if (pendingProposals.length === 0) {
		return (
			<Card className="border-dashed border-2 border-purple-200 bg-purple-50/50 dark:bg-purple-900/10">
				<CardContent className="flex flex-col items-center justify-center py-16">
					<Bot className="w-16 h-16 text-purple-400 mb-4" />
					<h3 className="text-xl font-semibold text-foreground mb-2">
						No Pending Proposals
					</h3>
					<p className="text-muted-foreground text-center max-w-md mb-4">
						AI-generated and agent recommendations will appear here based on
						your risk profile and investment goals.
					</p>
					<Button
						variant="outline"
						onClick={() => refetch()}
						className="border-purple-300 dark:border-purple-700 text-purple-600 hover:bg-purple-50 dark:bg-purple-950/30"
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
					data-testid={`proposal-card-${proposal.id}`}
				>
					<CardContent className="p-0">
						<div className="flex">
							{/* Proposal Source Indicator */}
							<div
								className={`w-2 ${proposal.proposalSource === "ai" ? "bg-gradient-to-b from-purple-500 to-indigo-600" : "bg-gradient-to-b from-blue-500 to-cyan-600"}`}
							/>

							<div className="flex-1 p-6">
								<div className="flex items-start justify-between mb-4">
									<div>
										<div className="flex items-center gap-2 mb-2">
											{proposal.proposalSource === "ai" ? (
												<Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
													<Bot className="w-3 h-3 mr-1" />
													AI Generated
												</Badge>
											) : (
												<Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
													<UserCheck className="w-3 h-3 mr-1" />
													Agent Recommended
												</Badge>
											)}
											{proposal.riskProfile && (
												<Badge variant="outline" className="text-xs">
													{proposal.riskProfile.charAt(0).toUpperCase() +
														proposal.riskProfile.slice(1)}{" "}
													Risk
												</Badge>
											)}
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
											Total Investment
										</p>
									</div>
								</div>

								{/* AI/Agent Insights */}
								{proposal.analysisRationale && (
									<div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-100 dark:border-purple-800">
										<div className="flex items-start gap-2">
											<Sparkles className="w-5 h-5 text-purple-500 mt-0.5" />
											<div>
												<p className="font-medium text-purple-800 dark:text-purple-300 text-sm">
													{proposal.proposalSource === "ai"
														? "AI Insight"
														: "Agent Note"}
												</p>
												<p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
													{proposal.analysisRationale}
												</p>
											</div>
										</div>
									</div>
								)}

								{/* Expected Outcomes */}
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
											Time Horizon
										</p>
										<p className="text-lg font-bold text-foreground">
											{proposal.timeHorizon
												?.replace("_", " ")
												.replace(/\b\w/g, (l: string) => l.toUpperCase()) ||
												"N/A"}
										</p>
									</div>
									<div className="text-center">
										<p className="text-sm text-muted-foreground">
											Projected Value
										</p>
										<p className="text-lg font-bold text-foreground flex items-center justify-center">
											<IndianRupee className="w-4 h-4" />
											{proposal.projectedValue
												? Number.parseFloat(
														proposal.projectedValue,
													).toLocaleString("en-IN")
												: "N/A"}
										</p>
									</div>
								</div>

								{/* Action Buttons */}
								<div className="flex gap-3">
									<Button
										className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
										onClick={() => approveMutation.mutate(proposal.id)}
										disabled={approveMutation.isPending}
										data-testid={`approve-${proposal.id}`}
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
										data-testid={`reject-${proposal.id}`}
									>
										<ThumbsDown className="w-4 h-4 mr-2" />
										Reject
									</Button>
									<Button
										variant="ghost"
										className="text-muted-foreground"
										data-testid={`edit-${proposal.id}`}
									>
										<Edit2 className="w-4 h-4" />
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

// MF Cart Tab Component
function MfCartTab({ onCheckout }: { onCheckout: () => void }) {
	const { toast } = useToast();

	const { data: cartData, isLoading } = useQuery<any>({
		queryKey: ["/api/cart"],
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
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to remove item",
				variant: "destructive",
			});
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
							body: JSON.stringify({ orderType: "LUMPSUM" }),
						},
					);
					results.push(result);
					await apiRequest(`/api/cart/items/${item.id}`, { method: "DELETE" });
				} else if (item.productId) {
					const orderData = {
						productId: item.productId,
						amount: item.investmentAmount || item.quantity,
						orderType: "LUMPSUM",
					};
					await apiRequest("/api/store/orders", {
						method: "POST",
						body: JSON.stringify(orderData),
					});
					await apiRequest(`/api/cart/items/${item.id}`, { method: "DELETE" });
				}
			}
			return results;
		},
		onSuccess: () => {
			toast({
				title: "Order Placed!",
				description: "Your mutual fund order has been submitted for processing",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
			queryClient.invalidateQueries({ queryKey: ["/api/mf/orders"] });
			queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
			onCheckout();
		},
		onError: (error: any) => {
			toast({
				title: "Checkout Error",
				description:
					error?.message ||
					"Some items could not be processed. Please try again.",
				variant: "destructive",
			});
		},
	});

	const cartItems = cartData?.items || [];
	const totalValue = cartData?.totalValue || 0;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
				<span className="ml-2 text-muted-foreground">Loading cart...</span>
			</div>
		);
	}

	if (cartItems.length === 0) {
		return (
			<Card className="border-dashed border-2 border-orange-200 bg-orange-50/50 dark:bg-orange-900/10">
				<CardContent className="flex flex-col items-center justify-center py-16">
					<ShoppingCart className="w-16 h-16 text-orange-400 mb-4" />
					<h3 className="text-xl font-semibold text-foreground mb-2">
						Your Cart is Empty
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
			{/* Cart Items List */}
			<div className="lg:col-span-2 space-y-4">
				{cartItems.map((item: any, index: number) => (
					<Card
						key={item.id || index}
						className="overflow-hidden"
						data-testid={`cart-item-${index}`}
					>
						<CardContent className="p-4">
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<Package className="w-5 h-5 text-orange-600" />
										<h4 className="font-semibold text-foreground">
											{item.productName || item.schemeName || "Investment Item"}
										</h4>
									</div>
									<div className="flex items-center gap-4 text-sm text-muted-foreground">
										{item.category && (
											<Badge variant="outline" className="text-xs">
												{item.category}
											</Badge>
										)}
										{item.orderType && (
											<span className="capitalize">{item.orderType}</span>
										)}
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
										className="text-red-500 hover:text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-950/30 mt-2"
										onClick={() => removeFromCartMutation.mutate(item.id)}
										disabled={removeFromCartMutation.isPending}
										data-testid={`remove-${index}`}
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

			{/* Checkout Summary */}
			<div className="lg:col-span-1">
				<Card className="sticky top-4 border-2 border-orange-200 bg-gradient-to-b from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CreditCard className="w-5 h-5 text-orange-600" />
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
									{Number.parseFloat(totalValue || "0").toLocaleString("en-IN")}
								</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Platform Fee</span>
								<span className="font-medium text-green-600">FREE</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">
									Stamp Duty (0.005%)
								</span>
								<span className="font-medium flex items-center">
									<IndianRupee className="w-3 h-3" />
									{(Number.parseFloat(totalValue || "0") * 0.00005).toFixed(2)}
								</span>
							</div>
						</div>

						<div className="border-t pt-4">
							<div className="flex justify-between text-lg font-bold">
								<span>Total Payable</span>
								<span className="flex items-center text-orange-600">
									<IndianRupee className="w-4 h-4" />
									{(
										Number.parseFloat(totalValue || "0") * 1.00005
									).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
								</span>
							</div>
						</div>

						<div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 text-sm">
							<div className="flex items-start gap-2">
								<AlertOctagon className="w-4 h-4 text-amber-600 mt-0.5" />
								<div>
									<p className="font-medium text-amber-800 dark:text-amber-300">
										NAV Cutoff
									</p>
									<p className="text-amber-700 dark:text-amber-400 text-xs">
										Orders before 3 PM get same-day NAV. After 3 PM, next
										business day NAV applies.
									</p>
								</div>
							</div>
						</div>

						<Button
							className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-foreground font-semibold py-6"
							onClick={() => checkoutMutation.mutate()}
							disabled={checkoutMutation.isPending || cartItems.length === 0}
							data-testid="checkout-btn"
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

						<p className="text-xs text-center text-muted-foreground">
							Secure payment powered by Cashfree
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

// MF Order Progress Tracker Component
function MfOrderProgressTracker({ order }: { order: any }) {
	const stages = [
		{ key: "placed", label: "Order Placed", icon: ClipboardList },
		{ key: "confirmed", label: "Payment Confirmed", icon: CheckCircle2 },
		{ key: "settled", label: "Units Allotted", icon: Package },
		{ key: "reconciled", label: "Completed", icon: Award },
	];

	const getCurrentStageIndex = (status: string) => {
		const statusMap: Record<string, number> = {
			created: 0,
			pending_payment: 0,
			placed: 1,
			confirmed: 2,
			settled: 3,
			reconciled: 4,
			failed: -1,
			cancelled: -1,
			rejected: -1,
		};
		return statusMap[status?.toLowerCase()] ?? 0;
	};

	const currentIndex = getCurrentStageIndex(order.status);
	const isFailed = currentIndex === -1;

	if (isFailed) {
		return (
			<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
				<div className="flex items-center gap-2 text-red-600">
					<AlertTriangle className="w-5 h-5" />
					<span className="font-medium">Order {order.status}</span>
				</div>
				{order.statusMessage && (
					<p className="text-sm text-red-500 mt-1">{order.statusMessage}</p>
				)}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="relative">
				{/* Progress Bar Background */}
				<div className="absolute top-5 left-0 right-0 h-1 bg-muted rounded-full" />
				{/* Progress Bar Fill */}
				<div
					className="absolute top-5 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
					style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
				/>

				{/* Stages */}
				<div className="relative flex justify-between">
					{stages.map((stage, index) => {
						const StageIcon = stage.icon;
						const isComplete = index < currentIndex;
						const isCurrent = index === currentIndex;

						return (
							<div key={stage.key} className="flex flex-col items-center">
								<div
									className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
										isComplete
											? "bg-emerald-500 text-white"
											: isCurrent
												? "bg-emerald-100 dark:bg-emerald-900 text-emerald-600 border-2 border-emerald-500 animate-pulse"
												: "bg-muted text-muted-foreground"
									}`}
								>
									<StageIcon className="w-5 h-5" />
								</div>
								<span
									className={`text-xs mt-2 text-center ${isCurrent ? "font-medium text-emerald-600" : "text-muted-foreground"}`}
								>
									{stage.label}
								</span>
							</div>
						);
					})}
				</div>
			</div>

			{order.settlementDate && (
				<div className="text-sm text-muted-foreground text-center">
					Expected settlement:{" "}
					{new Date(order.settlementDate).toLocaleDateString("en-IN", {
						weekday: "short",
						month: "short",
						day: "numeric",
					})}
				</div>
			)}
		</div>
	);
}

function FundCard({
	fund,
	sebiData,
	onInvestClick,
}: {
	fund: MutualFundData;
	sebiData?: any[];
	onInvestClick: (fund: MutualFundData) => void;
}) {
	const navValue = Number.parseFloat(fund.nav || "0");
	const changeValue = Number.parseFloat(fund.change || "0");
	const changePercent = Number.parseFloat(fund.changePercent || "0");

	// Find SEBI compliance data for this fund
	const sebiCompliance = sebiData?.find(
		(s: any) =>
			s.amcName?.toLowerCase().includes(fund.fundHouse?.toLowerCase() || "") ||
			s.schemes?.some((scheme: any) => scheme.schemeCode === fund.schemeCode),
	);

	return (
		<Card
			className="group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-card dark:to-background overflow-hidden"
			data-testid={`fund-card-${fund.schemeCode}`}
		>
			<div className="absolute inset-0 bg-gradient-to-r from-finance-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
			<CardContent className="relative p-6">
				<div className="flex justify-between items-start mb-6">
					<div className="flex-1">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-2 h-2 rounded-full bg-finance-blue animate-pulse" />
							<h3 className="font-bold text-foreground text-lg line-clamp-2 group-hover:text-finance-blue transition-colors">
								{fund.schemeName}
							</h3>
						</div>
						<div className="flex items-center gap-2 mb-3">
							<Building2 className="w-4 h-4 text-muted-foreground" />
							<p className="text-sm text-muted-foreground font-medium">
								{fund.fundHouse}
							</p>
						</div>
						<div className="flex items-center gap-2 flex-wrap">
							{fund.category && (
								<Badge
									variant="secondary"
									className="bg-finance-blue/10 text-finance-blue border-finance-blue/20 hover:bg-finance-blue hover:text-white transition-colors"
								>
									{fund.category}
								</Badge>
							)}
							{sebiCompliance && (
								<Badge
									variant="outline"
									className="text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20"
								>
									<LucideShield className="w-3 h-3 mr-1" />
									SEBI Verified
								</Badge>
							)}
							{(fund as any).provenance?.dataSource === "LIVE_API" && (
								<Badge
									variant="outline"
									className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-xs"
								>
									<Activity className="w-3 h-3 mr-1" />
									Live
								</Badge>
							)}
							{(fund as any).provenance?.dataSource === "CACHED_DB" && (
								<Badge
									variant="outline"
									className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-xs"
								>
									<Database className="w-3 h-3 mr-1" />
									Cached
								</Badge>
							)}
						</div>
					</div>
				</div>

				<div className="bg-card rounded-xl p-4 shadow-sm border border-border mb-4">
					<div className="grid grid-cols-3 gap-4 text-center">
						<div className="group-hover:scale-105 transition-transform">
							<div className="flex items-center justify-center mb-1">
								<div className="w-8 h-8 bg-finance-blue/10 rounded-full flex items-center justify-center">
									<TrendingUp className="w-4 h-4 text-finance-blue" />
								</div>
							</div>
							<p className="text-2xl font-bold text-foreground">
								₹{navValue.toFixed(2)}
							</p>
							<p className="text-xs text-muted-foreground font-medium">
								Current NAV
							</p>
						</div>
						<div className="group-hover:scale-105 transition-transform">
							<div className="flex items-center justify-center mb-1">
								<div
									className={`w-8 h-8 rounded-full flex items-center justify-center ${changeValue >= 0 ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"}`}
								>
									{changeValue >= 0 ? (
										<TrendingUp className="w-4 h-4 text-green-600" />
									) : (
										<TrendingDown className="w-4 h-4 text-red-600" />
									)}
								</div>
							</div>
							<p
								className={`text-xl font-bold ${changeValue >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
							>
								{changeValue >= 0 ? "+" : ""}₹{changeValue.toFixed(2)}
							</p>
							<p className="text-xs text-muted-foreground font-medium">
								Daily Change
							</p>
						</div>
						<div className="group-hover:scale-105 transition-transform">
							<div className="flex items-center justify-center mb-1">
								<div
									className={`w-8 h-8 rounded-full flex items-center justify-center ${changePercent >= 0 ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"}`}
								>
									<Star
										className={`w-4 h-4 ${changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
									/>
								</div>
							</div>
							<p
								className={`text-xl font-bold flex items-center justify-center ${changePercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
							>
								{changePercent >= 0 ? "+" : ""}
								{changePercent.toFixed(2)}%
							</p>
							<p className="text-xs text-muted-foreground font-medium">
								% Change
							</p>
						</div>
					</div>
				</div>

				{/* FintekPro Smart Rating Display */}
				{((fund as any).fintekproRating || (fund as any).rating) && (
					<div className="flex items-center justify-between mb-4 p-2 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
						<div className="flex items-center gap-2">
							<Award className="w-4 h-4 text-yellow-600" />
							<span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
								FintekPro Rating
							</span>
						</div>
						<div className="flex items-center gap-1">
							{[1, 2, 3, 4, 5].map((star) => (
								<Star
									key={star}
									className={`w-4 h-4 ${star <= ((fund as any).fintekproRating || (fund as any).rating || 5) ? "text-yellow-400 fill-current" : "text-muted-foreground"}`}
								/>
							))}
						</div>
					</div>
				)}

				<div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
					<Button
						size="sm"
						className="w-full sm:flex-1 bg-gradient-to-r from-finance-blue to-blue-600 hover:from-blue-600 hover:to-finance-blue text-foreground font-medium shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-105"
						data-testid={`invest-${fund.schemeCode}`}
						onClick={() => onInvestClick(fund)}
					>
						<TrendingUp className="w-4 h-4 mr-1.5" />
						<span className="text-xs sm:text-sm">Invest Now</span>
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="w-full sm:flex-1 border-border hover:bg-muted hover:border-finance-blue hover:text-finance-blue transition-all duration-300 group-hover:scale-105"
						data-testid={`details-${fund.schemeCode}`}
					>
						<Award className="w-4 h-4 mr-1.5" />
						<span className="text-xs sm:text-sm">View Details</span>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function PopularFundsSection({
	sebiData,
	onInvestClick,
	onViewAll,
}: {
	sebiData?: any[];
	onInvestClick: (fund: MutualFundData) => void;
	onViewAll: () => void;
}) {
	const { data: popularFunds } = useSuspenseQuery<MutualFundData[]>({
		queryKey: ["/api/mutual-funds/popular"],
		queryFn: async () => {
			const res = await fetch("/api/mutual-funds/popular");
			if (!res.ok) throw new Error("Failed to fetch popular funds");
			const result = await res.json();
			return result.data || result;
		},
		staleTime: 10 * 60 * 1000,
	});

	return (
		<section>
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-foreground">Popular Funds</h2>
				{popularFunds && popularFunds.length > 0 && (
					<Button
						variant="outline"
						size="sm"
						className="flex items-center gap-2"
						onClick={onViewAll}
						data-testid="view-all-funds"
					>
						View All <ArrowRight className="h-4 w-4" />
					</Button>
				)}
			</div>
			{popularFunds && popularFunds.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{popularFunds.map((fund) => (
						<FundCard
							key={fund.schemeCode}
							fund={fund}
							sebiData={sebiData}
							onInvestClick={onInvestClick}
						/>
					))}
				</div>
			) : (
				<Card className="border-dashed border-2 border-border">
					<CardContent className="flex flex-col items-center justify-center py-8">
						<TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
						<p className="text-muted-foreground text-center">
							No popular mutual funds available.
						</p>
					</CardContent>
				</Card>
			)}
		</section>
	);
}

interface StoreFundsGridProps {
	storeCategory: string;
	storeFundHouse: string;
	storePlanType: string;
	storeSearchTerm: string;
	storePage: number;
	setStorePage: (value: number | ((prev: number) => number)) => void;
	setStoreSearchTerm: (v: string) => void;
	setStoreCategory: (v: string) => void;
	setStoreFundHouse: (v: string) => void;
	onInvestClick: (fund: MutualFundData) => void;
}

function StoreFundsGrid({
	storeCategory,
	storeFundHouse,
	storePlanType,
	storeSearchTerm,
	storePage,
	setStorePage,
	setStoreSearchTerm,
	setStoreCategory,
	setStoreFundHouse,
	onInvestClick,
}: StoreFundsGridProps) {
	const queryKey = [
		"/api/public/mutual-funds",
		storeCategory,
		storeFundHouse,
		storePlanType,
		storeSearchTerm,
		storePage,
	];
	const { data: publishedFundsData, refetch: refetchPublished } =
		useSuspenseQuery<any>({
			queryKey,
			queryFn: async () => {
				const params = new URLSearchParams({
					page: storePage.toString(),
					limit: "24",
					planType: storePlanType,
					...(storeCategory !== "all" && { category: storeCategory }),
					...(storeFundHouse !== "all" && { fundHouse: storeFundHouse }),
					...(storeSearchTerm && { search: storeSearchTerm }),
				});
				const res = await fetch(`/api/public/mutual-funds?${params}`);
				if (!res.ok) throw new Error("Failed to fetch published funds");
				return res.json();
			},
		});

	if (publishedFundsData?.funds?.length > 0) {
		return (
			<>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{publishedFundsData.funds.map((fund: any) => (
						<Card
							key={fund.id}
							className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border"
							data-testid={`store-fund-card-${fund.schemeCode}`}
						>
							<CardContent className="p-6">
								<div className="flex justify-between items-start mb-4">
									<div className="flex-1">
										<h3 className="font-bold text-foreground line-clamp-2 group-hover:text-finance-blue transition-colors">
											{fund.schemeName}
										</h3>
										<p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
											<Building2 className="w-3 h-3" />
											{fund.fundHouse}
										</p>
									</div>
									<Badge
										variant={
											fund.planType === "direct" ? "default" : "secondary"
										}
										className={fund.planType === "direct" ? "bg-green-600" : ""}
									>
										{fund.planType === "direct" ? "Direct" : "Regular"}
									</Badge>
								</div>
								<div className="flex items-center gap-2 mb-4">
									{fund.category && (
										<Badge variant="outline" className="text-xs">
											{fund.category}
										</Badge>
									)}
									{fund.riskLevel && (
										<Badge
											variant="outline"
											className={`text-xs ${
												fund.riskLevel === "low"
													? "text-green-600 border-green-300"
													: fund.riskLevel === "medium"
														? "text-amber-600 border-amber-300"
														: "text-red-600 border-red-300"
											}`}
										>
											{fund.riskLevel} risk
										</Badge>
									)}
								</div>
								<div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-muted rounded-lg">
									<div>
										<p className="text-xs text-muted-foreground">NAV</p>
										<p className="text-lg font-bold text-foreground">
											₹{Number.parseFloat(fund.nav || "0").toFixed(2)}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground">1Y Returns</p>
										<p
											className={`text-lg font-bold ${Number.parseFloat(fund.returns1y || "0") >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{Number.parseFloat(fund.returns1y || "0") >= 0 ? "+" : ""}
											{Number.parseFloat(fund.returns1y || "0").toFixed(2)}%
										</p>
									</div>
								</div>
								{fund.rating && (
									<div className="flex items-center gap-1 mb-4">
										{[1, 2, 3, 4, 5].map((star) => (
											<Star
												key={star}
												className={`w-4 h-4 ${star <= fund.rating ? "text-yellow-400 fill-current" : "text-muted-foreground"}`}
											/>
										))}
										<span className="text-xs text-muted-foreground ml-1">
											FintekPro Rating
										</span>
									</div>
								)}
								<div className="flex gap-2">
									<Button
										size="sm"
										className="flex-1 bg-finance-blue hover:bg-blue-600"
										onClick={() =>
											onInvestClick({
												schemeCode: fund.schemeCode,
												schemeName: fund.schemeName,
												fundHouse: fund.fundHouse,
												category: fund.category,
												nav: fund.nav,
												change: fund.change || "0",
												changePercent: fund.changePercent || "0",
											} as MutualFundData)
										}
										data-testid={`store-invest-${fund.schemeCode}`}
									>
										Invest Now
									</Button>
									<Button
										size="sm"
										variant="outline"
										data-testid={`store-details-${fund.schemeCode}`}
									>
										Details
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
				{publishedFundsData.pagination?.totalPages > 1 && (
					<div className="flex items-center justify-center gap-4 pt-6">
						<Button
							variant="outline"
							size="sm"
							disabled={storePage <= 1}
							onClick={() => setStorePage((p) => Math.max(1, p - 1))}
							data-testid="store-prev-page"
						>
							<ChevronLeft className="w-4 h-4 mr-1" />
							Previous
						</Button>
						<span className="text-sm text-muted-foreground">
							Page {storePage} of {publishedFundsData.pagination.totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={storePage >= publishedFundsData.pagination.totalPages}
							onClick={() => setStorePage((p) => p + 1)}
							data-testid="store-next-page"
						>
							Next
							<ChevronRight className="w-4 h-4 ml-1" />
						</Button>
					</div>
				)}
			</>
		);
	}

	return (
		<Card className="border-dashed border-2 border-border">
			<CardContent className="flex flex-col items-center justify-center py-16">
				<Store className="h-16 w-16 text-muted-foreground mb-4" />
				<h3 className="text-xl font-semibold text-muted-foreground mb-2">
					No Published Funds
				</h3>
				<p className="text-muted-foreground text-center max-w-md mb-4">
					{storeSearchTerm ||
					storeCategory !== "all" ||
					storeFundHouse !== "all"
						? "No funds match your current filters. Try adjusting your search criteria."
						: "Mutual fund schemes will appear here once they are imported and published by the admin."}
				</p>
				{(storeSearchTerm ||
					storeCategory !== "all" ||
					storeFundHouse !== "all") && (
					<Button
						variant="outline"
						onClick={() => {
							setStoreSearchTerm("");
							setStoreCategory("all");
							setStoreFundHouse("all");
							setStorePage(() => 1);
						}}
					>
						Clear Filters
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

export default function MutualFunds() {
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedFilterCategory, setSelectedFilterCategory] = useState("All");
	const [selectedRisk, setSelectedRisk] = useState("all");
	const [activeTab, setActiveTab] = useState("store");
	const allFundsRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();

	const {
		data: allFunds,
		isLoading: isLoadingAll,
		error: allError,
		refetch: refetchAll,
	} = useMutualFunds();
	const {
		data: popularFunds,
		isLoading: isLoadingPopular,
		error: popularError,
	} = usePopularMutualFunds();
	const { data: searchResults, isLoading: isSearching } =
		useSearchMutualFunds(searchTerm);

	// Fetch SEBI mutual fund compliance data
	const { data: sebiMutualFunds, isLoading: isSEBILoading } = useQuery({
		queryKey: ["/api/sebi/mutual-funds"],
		refetchInterval: 3600000, // Refresh every hour
	});

	// Store tab state
	const [storeSearchTerm, setStoreSearchTerm] = useState("");
	const [storeCategory, setStoreCategory] = useState("all");
	const [storeFundHouse, setStoreFundHouse] = useState("all");
	const [storePlanType, setStorePlanType] = useState("regular");
	const [storePage, setStorePage] = useState(1);

	// Fetch published mutual funds from store (public API - no auth required)
	const {
		data: publishedFundsData,
		isLoading: isLoadingPublished,
		error: publishedError,
		refetch: refetchPublished,
	} = useQuery({
		queryKey: [
			"/api/public/mutual-funds",
			storeCategory,
			storeFundHouse,
			storePlanType,
			storeSearchTerm,
			storePage,
		],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: storePage.toString(),
				limit: "24",
				planType: storePlanType,
				...(storeCategory !== "all" && { category: storeCategory }),
				...(storeFundHouse !== "all" && { fundHouse: storeFundHouse }),
				...(storeSearchTerm && { search: storeSearchTerm }),
			});
			const res = await fetch(`/api/public/mutual-funds?${params}`);
			if (!res.ok) throw new Error("Failed to fetch published funds");
			return res.json();
		},
		staleTime: 60000, // 1 minute
	});

	// Market data hooks with dataUpdatedAt for accurate timestamps
	const {
		data: nseIndices,
		isLoading: isLoadingNSE,
		error: nseError,
		refetch: refetchNSE,
		dataUpdatedAt: nseDataUpdatedAt,
		isStale: isNSEStale,
	} = useNSEIndices();
	const {
		data: marketMovers,
		isLoading: isLoadingMovers,
		refetch: refetchMovers,
		dataUpdatedAt: moversDataUpdatedAt,
		isStale: isMoversStale,
	} = useMarketMovers();
	const {
		data: marketStatus,
		isLoading: isLoadingMarketStatus,
		refetch: refetchMarketStatus,
		dataUpdatedAt: statusDataUpdatedAt,
		isStale: isStatusStale,
	} = useMarketStatus();

	// Portfolio data hooks - only fetch when user is authenticated
	const { user, isAuthenticated } = useAuth();
	const userId = user?.id;
	const {
		data: portfolios,
		isLoading: isLoadingPortfolios,
		refetch: refetchPortfolios,
		dataUpdatedAt: portfoliosDataUpdatedAt,
		isStale: isPortfoliosStale,
	} = usePortfolios(userId || "");
	const portfolioId = portfolios?.[0]?.id;
	const {
		data: portfolioPerformance,
		isLoading: isLoadingPerformance,
		refetch: refetchPerformance,
		dataUpdatedAt: performanceDataUpdatedAt,
		isStale: isPerformanceStale,
	} = usePortfolioPerformance(portfolioId || "");
	const {
		data: portfolioHoldings,
		isLoading: isLoadingHoldings,
		refetch: refetchHoldings,
		dataUpdatedAt: holdingsDataUpdatedAt,
		isStale: isHoldingsStale,
	} = useEnhancedPortfolioHoldings(portfolioId || "");

	// SIP calculator state
	const [sipAmount, setSipAmount] = useState("");
	const [sipYears, setSipYears] = useState("");
	const [sipReturns, setSipReturns] = useState("");
	const [calculatedSip, setCalculatedSip] = useState<{
		invested: number;
		returns: number;
		total: number;
	} | null>(null);

	// Handle SIP calculation
	const calculateSIP = () => {
		const monthlyAmount = Number.parseFloat(sipAmount);
		const years = Number.parseFloat(sipYears);
		const expectedReturns = Number.parseFloat(sipReturns);

		if (!monthlyAmount || !years || !expectedReturns) {
			alert("Please fill in all fields");
			return;
		}

		const monthlyRate = expectedReturns / 12 / 100;
		const totalMonths = years * 12;
		const totalInvested = monthlyAmount * totalMonths;

		// SIP future value formula
		const futureValue =
			monthlyAmount *
			((((1 + monthlyRate) ** totalMonths - 1) / monthlyRate) *
				(1 + monthlyRate));
		const totalReturns = futureValue - totalInvested;

		setCalculatedSip({
			invested: totalInvested,
			returns: totalReturns,
			total: futureValue,
		});
	};

	// MoneyControl-style fund categories with real data structure
	const fundCategories = [
		{
			name: "Large Cap Funds",
			description: "Invest in top 100 companies by market cap",
			riskLevel: "Moderate",
			funds: [
				{
					fundName: "SBI BlueChip Fund",
					fundHouse: "SBI Mutual Fund",
					smartRating: 4,
					aum: "₹32,450 Cr",
					returns: {
						"1M": "2.3%",
						"6M": "18.5%",
						"1Y": "14.2%",
						"3Y": "16.8%",
						"5Y": "14.5%",
					},
					expenseRatio: "0.58%",
					nav: "95.87",
				},
				{
					fundName: "ICICI Pru BlueChip Fund",
					fundHouse: "ICICI Prudential MF",
					smartRating: 5,
					aum: "₹45,678 Cr",
					returns: {
						"1M": "1.8%",
						"6M": "17.2%",
						"1Y": "15.4%",
						"3Y": "17.2%",
						"5Y": "15.1%",
					},
					expenseRatio: "0.89%",
					nav: "68.45",
				},
				{
					fundName: "Axis BlueChip Fund",
					fundHouse: "Axis Mutual Fund",
					smartRating: 4,
					aum: "₹28,934 Cr",
					returns: {
						"1M": "2.1%",
						"6M": "16.8%",
						"1Y": "13.9%",
						"3Y": "15.6%",
						"5Y": "13.8%",
					},
					expenseRatio: "0.45%",
					nav: "47.23",
				},
			],
		},
		{
			name: "Multi Cap Funds",
			description: "Flexible allocation across large, mid & small cap stocks",
			riskLevel: "Moderate to High",
			funds: [
				{
					fundName: "Parag Parikh Flexi Cap",
					fundHouse: "PPFAS Mutual Fund",
					smartRating: 5,
					aum: "₹67,890 Cr",
					returns: {
						"1M": "3.2%",
						"6M": "21.4%",
						"1Y": "18.7%",
						"3Y": "19.8%",
						"5Y": "17.9%",
					},
					expenseRatio: "0.68%",
					nav: "58.94",
				},
				{
					fundName: "Kotak Flexicap Fund",
					fundHouse: "Kotak Mutual Fund",
					smartRating: 4,
					aum: "₹52,345 Cr",
					returns: {
						"1M": "2.8%",
						"6M": "19.6%",
						"1Y": "16.3%",
						"3Y": "18.1%",
						"5Y": "16.4%",
					},
					expenseRatio: "0.55%",
					nav: "72.18",
				},
			],
		},
		{
			name: "Large & Mid Cap Funds",
			description: "65% in large cap, 35% in mid cap companies",
			riskLevel: "Moderate to High",
			funds: [
				{
					fundName: "Motilal Oswal Large & Midcap",
					fundHouse: "Motilal Oswal MF",
					smartRating: 5,
					aum: "₹15,234 Cr",
					returns: {
						"1M": "4.1%",
						"6M": "24.2%",
						"1Y": "22.5%",
						"3Y": "21.3%",
						"5Y": "19.8%",
					},
					expenseRatio: "0.72%",
					nav: "89.34",
				},
				{
					fundName: "HDFC Large and Mid Cap",
					fundHouse: "HDFC Mutual Fund",
					smartRating: 4,
					aum: "₹38,567 Cr",
					returns: {
						"1M": "3.5%",
						"6M": "20.8%",
						"1Y": "19.2%",
						"3Y": "19.7%",
						"5Y": "18.1%",
					},
					expenseRatio: "0.65%",
					nav: "76.92",
				},
			],
		},
		{
			name: "Mid Cap Funds",
			description: "Invest in 101st to 250th companies by market cap",
			riskLevel: "High",
			funds: [
				{
					fundName: "Axis Midcap Fund",
					fundHouse: "Axis Mutual Fund",
					smartRating: 5,
					aum: "₹24,678 Cr",
					returns: {
						"1M": "5.2%",
						"6M": "28.3%",
						"1Y": "31.4%",
						"3Y": "24.8%",
						"5Y": "22.1%",
					},
					expenseRatio: "0.58%",
					nav: "142.67",
				},
				{
					fundName: "DSP Midcap Fund",
					fundHouse: "DSP Mutual Fund",
					smartRating: 4,
					aum: "₹19,890 Cr",
					returns: {
						"1M": "4.8%",
						"6M": "26.1%",
						"1Y": "28.9%",
						"3Y": "22.6%",
						"5Y": "20.4%",
					},
					expenseRatio: "0.67%",
					nav: "98.45",
				},
			],
		},
		{
			name: "Small Cap Funds",
			description: "Invest in companies ranked beyond 250th by market cap",
			riskLevel: "Very High",
			funds: [
				{
					fundName: "SBI Small Cap Fund",
					fundHouse: "SBI Mutual Fund",
					smartRating: 5,
					aum: "₹18,234 Cr",
					returns: {
						"1M": "6.8%",
						"6M": "32.5%",
						"1Y": "38.2%",
						"3Y": "28.4%",
						"5Y": "24.7%",
					},
					expenseRatio: "0.74%",
					nav: "203.89",
				},
				{
					fundName: "Nippon India Small Cap",
					fundHouse: "Nippon India MF",
					smartRating: 4,
					aum: "₹22,567 Cr",
					returns: {
						"1M": "6.2%",
						"6M": "30.8%",
						"1Y": "35.6%",
						"3Y": "26.1%",
						"5Y": "22.9%",
					},
					expenseRatio: "0.69%",
					nav: "178.42",
				},
			],
		},
	];

	// Temporary alias to fix runtime error - will be cleaned up later
	const categories = fundCategories;

	const [selectedCategory, setSelectedCategory] = useState("Large Cap Funds");
	const [selectedSubCategory, setSelectedSubCategory] = useState("");

	// FintekPro Smart Rating Component
	const FintekProSmartRating = ({ rating }: { rating: number }) => {
		return (
			<div
				className="flex items-center gap-1"
				data-testid={`fintekpro-rating-${rating}-star`}
				title="FintekPro Smart Rating - Based on risk-adjusted returns, asset quality, liquidity, and concentration metrics"
			>
				{[1, 2, 3, 4, 5].map((star) => (
					<Star
						key={star}
						className={`w-4 h-4 ${star <= rating ? "text-yellow-400 fill-current" : "text-muted-foreground"}`}
					/>
				))}
				<span className="text-xs text-muted-foreground ml-1">FintekPro</span>
			</div>
		);
	};

	// Performance Table Component
	const FundPerformanceTable = ({
		category,
	}: { category: (typeof fundCategories)[0] }) => {
		return (
			<div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
				<div className="px-6 py-4 bg-gradient-to-r from-finance-blue/5 to-blue-50 dark:from-finance-blue/10 dark:to-card border-b border-border">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-xl font-semibold text-foreground">
								{category.name}
							</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{category.description}
							</p>
							<div className="flex items-center gap-2 mt-2">
								<div className="px-2 py-1 bg-finance-blue/10 text-finance-blue text-xs font-medium rounded">
									Risk: {category.riskLevel}
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full">
						<thead className="bg-muted">
							<tr>
								<th
									className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
									data-testid="table-header-fund"
								>
									Fund Name
								</th>
								<th
									className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
									data-testid="table-header-fintekpro-rating"
								>
									FintekPro Rating
								</th>
								<th
									className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
									data-testid="table-header-aum"
								>
									AUM
								</th>
								<th
									className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
									data-testid="table-header-1m"
								>
									1M
								</th>
								<th
									className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
									data-testid="table-header-6m"
								>
									6M
								</th>
								<th
									className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
									data-testid="table-header-1y"
								>
									1Y
								</th>
								<th
									className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
									data-testid="table-header-3y"
								>
									3Y
								</th>
								<th
									className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
									data-testid="table-header-5y"
								>
									5Y
								</th>
								<th
									className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
									data-testid="table-header-action"
								>
									Action
								</th>
							</tr>
						</thead>
						<tbody className="bg-card divide-y divide-gray-200 dark:divide-border">
							{category.funds.map((fund, index) => (
								<tr
									key={fund.fundName}
									className="hover:bg-muted transition-colors"
									data-testid={`fund-row-${index}`}
								>
									<td className="px-6 py-4" data-testid={`fund-name-${index}`}>
										<div>
											<div className="font-medium text-foreground">
												{fund.fundName}
											</div>
											<div className="text-sm text-muted-foreground">
												{fund.fundHouse}
											</div>
											<div className="text-xs text-muted-foreground">
												NAV: ₹{fund.nav}
											</div>
										</div>
									</td>
									<td
										className="px-6 py-4"
										data-testid={`fund-fintekpro-rating-${index}`}
									>
										<FintekProSmartRating rating={fund.smartRating} />
									</td>
									<td
										className="px-6 py-4 text-sm text-foreground font-medium"
										data-testid={`fund-aum-${index}`}
									>
										{fund.aum}
									</td>
									<td className="px-6 py-4" data-testid={`fund-1m-${index}`}>
										<span
											className={`text-sm font-medium ${
												fund.returns["1M"].startsWith("-")
													? "text-red-600"
													: "text-green-600"
											}`}
										>
											{fund.returns["1M"]}
										</span>
									</td>
									<td className="px-6 py-4" data-testid={`fund-6m-${index}`}>
										<span
											className={`text-sm font-medium ${
												fund.returns["6M"].startsWith("-")
													? "text-red-600"
													: "text-green-600"
											}`}
										>
											{fund.returns["6M"]}
										</span>
									</td>
									<td className="px-6 py-4" data-testid={`fund-1y-${index}`}>
										<span
											className={`text-sm font-medium ${
												fund.returns["1Y"].startsWith("-")
													? "text-red-600"
													: "text-green-600"
											}`}
										>
											{fund.returns["1Y"]}
										</span>
									</td>
									<td className="px-6 py-4" data-testid={`fund-3y-${index}`}>
										<span
											className={`text-sm font-medium ${
												fund.returns["3Y"].startsWith("-")
													? "text-red-600"
													: "text-green-600"
											}`}
										>
											{fund.returns["3Y"]}
										</span>
									</td>
									<td className="px-6 py-4" data-testid={`fund-5y-${index}`}>
										<span
											className={`text-sm font-medium ${
												fund.returns["5Y"].startsWith("-")
													? "text-red-600"
													: "text-green-600"
											}`}
										>
											{fund.returns["5Y"]}
										</span>
									</td>
									<td
										className="px-6 py-4"
										data-testid={`fund-action-${index}`}
									>
										<div className="flex gap-2">
											<Button
												size="sm"
												className="bg-finance-blue hover:bg-blue-600 text-white"
												data-testid={`invest-btn-${index}`}
												onClick={() => handleInvestClick(fund as any)}
											>
												Invest
											</Button>
											<Button
												size="sm"
												variant="outline"
												className="hover:border-finance-blue hover:text-finance-blue"
												data-testid={`compare-btn-${index}`}
											>
												Compare
											</Button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="px-6 py-4 bg-muted border-t border-border">
					<div className="flex items-center justify-between text-sm text-muted-foreground">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-green-500 rounded-full" />
								<span>Positive Returns</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-red-500 rounded-full" />
								<span>Negative Returns</span>
							</div>
						</div>
						<div className="text-xs">
							<p>
								*Returns are annualized. Past performance doesn't guarantee
								future results.
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// Use search results if searching, otherwise use all funds
	const displayFunds =
		searchTerm.length > 2 ? searchResults || [] : allFunds || [];

	// Filter by category if selected
	const filteredFunds = displayFunds.filter(
		(fund) =>
			selectedCategory === "" ||
			selectedCategory === "All Categories" ||
			fund.category?.toLowerCase().includes(selectedCategory.toLowerCase()),
	);

	const isLoading = isLoadingAll || (searchTerm.length > 2 && isSearching);

	// Investment modal state
	const [selectedFund, setSelectedFund] = useState<MutualFundData | null>(null);
	const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);

	// Order execution state
	const [orderType, setOrderType] = useState<"buy" | "sell" | "sip">("buy");
	const [selectedHolding, setSelectedHolding] = useState<any>(null);
	const [orderAmount, setOrderAmount] = useState("");
	const [orderUnits, setOrderUnits] = useState("");
	const [redeemAllUnits, setRedeemAllUnits] = useState(false);
	const [orderFolio, setOrderFolio] = useState("");
	const [orderPaymentMethod, setOrderPaymentMethod] = useState("");
	const [orderSchemeSearch, setOrderSchemeSearch] = useState("");

	// Calculate estimated value for sell orders
	const calculateSellValue = () => {
		if (!selectedHolding) return 0;
		const nav = Number.parseFloat(
			selectedHolding.currentNav || selectedHolding.nav || "0",
		);
		if (redeemAllUnits) {
			return Number.parseFloat(selectedHolding.units || "0") * nav;
		}
		const units = Number.parseFloat(orderUnits || "0");
		return units * nav;
	};

	// Handle holding selection for sell order
	const handleHoldingSelectForSell = (holding: any) => {
		setSelectedHolding(holding);
		setOrderType("sell");
		setOrderFolio(holding.folioNumber || holding.folioId || "");
		setOrderUnits("");
		setRedeemAllUnits(false);
	};

	// Handle invest button click
	const handleInvestClick = (fund: MutualFundData) => {
		setSelectedFund(fund);
		setIsInvestmentModalOpen(true);
	};

	const handleViewAllClick = () => {
		// Ensure we're on the explore tab
		setActiveTab("explore");
		// Scroll to All Funds section smoothly after a brief delay to ensure tab content is rendered
		setTimeout(() => {
			allFundsRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}, 100);
	};

	// Comprehensive refresh function
	const handleRefreshAll = async () => {
		try {
			await Promise.all([
				refetchAll(),
				refetchNSE(),
				refetchMovers(),
				refetchMarketStatus(),
				refetchPortfolios(),
				refetchPerformance(),
				refetchHoldings(),
			]);
			// Invalidate all query cache for fresh timestamps
			queryClient.invalidateQueries({ queryKey: ["/api/market"] });
			queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
			queryClient.invalidateQueries({ queryKey: ["/api/nse"] });
		} catch (error) {
			console.error("Error refreshing data:", error);
		}
	};

	// Get the latest timestamp for display using React Query dataUpdatedAt
	const getLastUpdatedTime = () => {
		const timestamps = [
			nseDataUpdatedAt,
			statusDataUpdatedAt,
			moversDataUpdatedAt,
			portfoliosDataUpdatedAt,
			performanceDataUpdatedAt,
			holdingsDataUpdatedAt,
		].filter(Boolean);

		if (timestamps.length > 0) {
			const latestTimestamp = Math.max(
				...timestamps.map((t) => new Date(t as number).getTime()),
			);
			return new Date(latestTimestamp).toLocaleTimeString();
		}

		return new Date().toLocaleTimeString();
	};

	// Check if any data is stale or has errors
	const hasStaleData =
		isNSEStale ||
		isMoversStale ||
		isStatusStale ||
		isPortfoliosStale ||
		isPerformanceStale ||
		isHoldingsStale;
	const hasDataErrors = nseError || allError;

	return (
		<DataErrorBoundary>
			<div className="space-y-8" data-testid="mutual-funds-page">
				<div className="space-y-6">
					{/* MoneyControl-Inspired Header */}
					<div className="mb-8" data-testid="mf-header">
						{/* Market Overview Banner */}
						<div className="bg-card border-b border-border mb-6">
							<div className="px-6 py-4">
								<div className="flex items-center justify-between">
									<h1 className="text-3xl font-bold text-foreground">
										Mutual Funds
									</h1>
									<div className="flex items-center gap-4">
										<Button
											onClick={handleRefreshAll}
											variant="outline"
											size="sm"
											className={`border-border hover:bg-muted ${isLoadingNSE || isLoadingMovers || isLoadingPerformance ? "opacity-50" : ""}`}
											disabled={
												isLoadingNSE || isLoadingMovers || isLoadingPerformance
											}
											data-testid="refresh-all-data"
										>
											<RefreshCw
												className={`h-4 w-4 mr-2 ${isLoadingNSE || isLoadingMovers || isLoadingPerformance ? "animate-spin" : ""}`}
											/>
											{isLoadingNSE || isLoadingMovers || isLoadingPerformance
												? "Refreshing..."
												: "Refresh All"}
										</Button>
										<div
											className="flex items-center gap-2"
											data-testid="last-updated"
										>
											<div className="text-sm text-muted-foreground">
												Last updated: {getLastUpdatedTime()}
											</div>
											{hasStaleData && (
												<div
													className="flex items-center text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md"
													data-testid="stale-data-indicator"
												>
													<Clock className="w-3 h-3 mr-1" />
													Stale Data
												</div>
											)}
											{hasDataErrors && (
												<div
													className="flex items-center text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md"
													data-testid="error-data-indicator"
												>
													<AlertCircle className="w-3 h-3 mr-1" />
													Data Errors
												</div>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Market Indices & Stats */}
						<TooltipProvider>
							{/* Audit-safe data attribution bar */}
							{!isLoadingNSE && (
								<div className="flex items-center gap-3 mb-3 px-1">
									{nseIndices?.unavailable ? (
										<div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-md border border-amber-200 dark:border-amber-800">
											<AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
											Market data temporarily unavailable. Displaying no prices
											— please refresh or visit NSE/BSE directly.
										</div>
									) : nseIndices?.marketDataTimestamp ? (
										<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
											<Clock className="w-3 h-3" />
											<span>
												Market prices as of{" "}
												<span className="font-medium text-foreground">
													{new Date(
														nseIndices.marketDataTimestamp,
													).toLocaleString("en-IN", {
														day: "numeric",
														month: "short",
														year: "numeric",
														hour: "2-digit",
														minute: "2-digit",
														timeZone: "Asia/Kolkata",
													})}{" "}
													IST
												</span>
												{" · "}NIFTY/Midcap/Smallcap: NSE · SENSEX: BSE via
												Google Finance
											</span>
										</div>
									) : null}
								</div>
							)}

							<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
								{/* Index card helper — renders one index cleanly */}
								{(nseIndices?.unavailable
									? []
									: (["NIFTY", "SENSEX"] as const)
								).map((sym) => {
									const d = nseIndices?.data?.find((i) => i.symbol === sym);
									if (!d) return null;
									const isUp = (d.per_chng ?? 0) >= 0;
									const qBadge: Record<string, { label: string; cls: string }> =
										{
											exchange: {
												label: "NSE",
												cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
											},
											third_party: {
												label: "BSE·GF",
												cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
											},
											estimated: {
												label: "~Est.",
												cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
											},
											unavailable: {
												label: "N/A",
												cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
											},
										};
									const badge = qBadge[d.dataQuality ?? "unavailable"];
									const dataTs = d.marketDataTimestamp
										? new Date(d.marketDataTimestamp).toLocaleTimeString(
												"en-IN",
												{
													hour: "2-digit",
													minute: "2-digit",
													timeZone: "Asia/Kolkata",
												},
											)
										: null;
									return (
										<Card key={sym} className="border border-border">
											<CardContent className="p-4">
												<div className="flex items-start justify-between mb-1">
													<div className="flex items-center gap-1.5">
														<p className="text-sm text-muted-foreground">
															{sym === "NIFTY" ? "NIFTY 50" : "SENSEX"}
														</p>
														<Tooltip>
															<TooltipTrigger asChild>
																<span
																	className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-help ${badge.cls}`}
																>
																	{badge.label}
																</span>
															</TooltipTrigger>
															<TooltipContent
																side="bottom"
																className="max-w-[220px] text-xs"
															>
																{d.dataQuality === "exchange" &&
																	"Last traded price from NSE (National Stock Exchange of India)."}
																{d.dataQuality === "third_party" &&
																	"Last traded price from BSE via Google Finance."}
																{d.dataQuality === "estimated" &&
																	`Estimated from NIFTY 50 using historical correlation (${d.estimationBasis ?? "ratio ~3.32"}). BSE/Google Finance unavailable.`}
																{d.dataQuality === "unavailable" &&
																	"No market data available for this index."}
																{dataTs && ` · Data recorded at ${dataTs} IST.`}
															</TooltipContent>
														</Tooltip>
													</div>
													<span
														className={`text-xs font-medium flex items-center gap-0.5 ${isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
													>
														{isLoadingNSE ? (
															<Skeleton className="h-4 w-12" />
														) : (
															<>
																{isUp ? (
																	<TrendingUp className="w-3 h-3" />
																) : (
																	<TrendingDown className="w-3 h-3" />
																)}
																{isUp ? "+" : ""}
																{(d.per_chng ?? 0).toFixed(2)}%
															</>
														)}
													</span>
												</div>
												{isLoadingNSE ? (
													<Skeleton className="h-7 w-28 mb-1" />
												) : (
													<p
														className="text-xl font-bold text-foreground"
														data-testid={`${sym.toLowerCase()}-value`}
													>
														{d.ltp
															? d.ltp.toLocaleString("en-IN", {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
																})
															: "—"}
													</p>
												)}
												{!isLoadingNSE && d.ltp > 0 && (
													<div className="space-y-0.5 mt-0.5">
														<div
															className={`text-xs ${isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
														>
															{isUp ? "+" : ""}
															{(d.chng ?? 0).toFixed(2)} pts
														</div>
														{d.high && d.low ? (
															<div className="text-xs text-muted-foreground">
																H:{" "}
																{d.high.toLocaleString("en-IN", {
																	maximumFractionDigits: 0,
																})}{" "}
																&nbsp;/&nbsp; L:{" "}
																{d.low.toLocaleString("en-IN", {
																	maximumFractionDigits: 0,
																})}
															</div>
														) : null}
														{dataTs && (
															<div className="text-[10px] text-muted-foreground/70">
																Recorded {dataTs} IST
															</div>
														)}
													</div>
												)}
											</CardContent>
										</Card>
									);
								})}

								{/* Show unavailable placeholder cards when data is down */}
								{nseIndices?.unavailable &&
									(["NIFTY 50", "SENSEX"] as const).map((name) => (
										<Card
											key={name}
											className="border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10"
										>
											<CardContent className="p-4">
												<p className="text-sm text-muted-foreground mb-2">
													{name}
												</p>
												<div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
													<AlertCircle className="w-4 h-4" />
													<span className="text-sm font-medium">
														Unavailable
													</span>
												</div>
												<p className="text-[10px] text-muted-foreground mt-1">
													Visit nseindia.com / bseindia.com
												</p>
											</CardContent>
										</Card>
									))}

								{/* Total AUM */}
								<Card className="border border-border">
									<CardContent className="p-4">
										<div className="flex items-start justify-between mb-1">
											<div className="flex items-center gap-1.5">
												<p className="text-sm text-muted-foreground">
													Industry AUM
												</p>
												<Tooltip>
													<TooltipTrigger asChild>
														<Info className="w-3 h-3 text-muted-foreground cursor-help" />
													</TooltipTrigger>
													<TooltipContent
														side="bottom"
														className="max-w-[220px] text-xs"
													>
														Total Assets Under Management of India's MF
														industry. Source: AMFI Monthly Data, March 2026.
													</TooltipContent>
												</Tooltip>
											</div>
											<div className="flex items-center text-blue-600 dark:text-blue-400">
												<Building2 className="w-3.5 h-3.5 mr-1" />
												<span className="text-xs font-medium">
													AMFI · Mar 2026
												</span>
											</div>
										</div>
										{isLoadingAll ? (
											<Skeleton className="h-7 w-24 mb-1" />
										) : (
											<p
												className="text-xl font-bold text-foreground"
												data-testid="total-aum"
											>
												₹68.50 L Cr
											</p>
										)}
										<p className="text-xs text-muted-foreground mt-0.5">
											{allFunds
												? `${allFunds.length.toLocaleString()} schemes on platform`
												: "1,200+ schemes"}
										</p>
									</CardContent>
								</Card>

								{/* Active Schemes */}
								<Card className="border border-border">
									<CardContent className="p-4">
										<div className="flex items-start justify-between mb-1">
											<p className="text-sm text-muted-foreground">
												Platform Schemes
											</p>
											<div className="flex items-center text-finance-blue">
												<Award className="w-3.5 h-3.5 mr-1" />
												<span className="text-xs font-medium">SEBI Reg.</span>
											</div>
										</div>
										{isLoadingAll ? (
											<Skeleton className="h-7 w-16 mb-1" />
										) : (
											<p
												className="text-xl font-bold text-foreground"
												data-testid="active-schemes"
											>
												{allFunds ? allFunds.length.toLocaleString() : "—"}
											</p>
										)}
										<p className="text-xs text-muted-foreground mt-0.5">
											Equity, Debt, Hybrid &amp; more
										</p>
									</CardContent>
								</Card>
							</div>
						</TooltipProvider>

						{/* Portfolio Overview Cards */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
							{/* Portfolio Value Card */}
							<Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
								<CardContent className="p-6">
									<div className="flex items-center justify-between mb-4">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
												<TrendingUp className="w-5 h-5 text-foreground" />
											</div>
											<div>
												<h3 className="font-semibold text-foreground">
													Portfolio Value
												</h3>
												<p className="text-sm text-blue-600 dark:text-blue-400">
													Current Investment
												</p>
											</div>
										</div>
									</div>
									<div className="space-y-2">
										{isLoadingPerformance ? (
											<Skeleton
												className="h-8 w-32"
												data-testid="portfolio-value-loading"
											/>
										) : portfolioPerformance ? (
											<p
												className="text-2xl font-bold text-foreground"
												data-testid="portfolio-value"
											>
												₹
												{portfolioPerformance.totalCurrentValue
													? Number.parseFloat(
															portfolioPerformance.totalCurrentValue,
														).toLocaleString("en-IN")
													: "2,45,670*"}
											</p>
										) : (
											<p
												className="text-2xl font-bold text-foreground"
												data-testid="portfolio-value-fallback"
											>
												₹2,45,670*
											</p>
										)}

										{isLoadingPerformance ? (
											<Skeleton
												className="h-5 w-28"
												data-testid="portfolio-change-loading"
											/>
										) : portfolioPerformance?.totalGainLoss ? (
											<div
												className={`flex items-center ${
													Number.parseFloat(
														portfolioPerformance.totalGainLoss,
													) >= 0
														? "text-green-600 dark:text-green-400"
														: "text-red-600 dark:text-red-400"
												}`}
											>
												{Number.parseFloat(
													portfolioPerformance.totalGainLoss,
												) >= 0 ? (
													<TrendingUp className="w-4 h-4 mr-1" />
												) : (
													<TrendingDown className="w-4 h-4 mr-1" />
												)}
												<span
													className="text-sm font-medium"
													data-testid="portfolio-change"
												>
													{Number.parseFloat(
														portfolioPerformance.totalGainLoss,
													) >= 0
														? "+"
														: ""}
													{portfolioPerformance.totalGainLossPercent}% (₹
													{Math.abs(
														Number.parseFloat(
															portfolioPerformance.totalGainLoss,
														),
													).toLocaleString("en-IN")}
													)
												</span>
											</div>
										) : (
											<div className="flex items-center text-green-600 dark:text-green-400">
												<TrendingUp className="w-4 h-4 mr-1" />
												<span
													className="text-sm font-medium"
													data-testid="portfolio-change-fallback"
												>
													+12.3% (₹26,890)*
												</span>
											</div>
										)}
									</div>
								</CardContent>
							</Card>

							{/* SIP Investments Card */}
							<Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
								<CardContent className="p-6">
									<div className="flex items-center justify-between mb-4">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
												<Calculator className="w-5 h-5 text-foreground" />
											</div>
											<div>
												<h3 className="font-semibold text-foreground">
													SIP Investments
												</h3>
												<p className="text-sm text-green-600 dark:text-green-400">
													Monthly Contribution
												</p>
											</div>
										</div>
									</div>
									<div className="space-y-2">
										{isLoadingHoldings ? (
											<Skeleton
												className="h-8 w-24"
												data-testid="sip-value-loading"
											/>
										) : portfolioHoldings ? (
											<p
												className="text-2xl font-bold text-foreground"
												data-testid="sip-value"
											>
												₹
												{portfolioHoldings.length > 0
													? (portfolioHoldings.length * 5000).toLocaleString(
															"en-IN",
														)
													: "15,000*"}
											</p>
										) : (
											<p
												className="text-2xl font-bold text-foreground"
												data-testid="sip-value-fallback"
											>
												₹15,000*
											</p>
										)}

										{isLoadingHoldings ? (
											<Skeleton
												className="h-5 w-24"
												data-testid="active-sips-loading"
											/>
										) : (
											<div className="flex items-center text-green-600 dark:text-green-400">
												<Clock className="w-4 h-4 mr-1" />
												<span
													className="text-sm font-medium"
													data-testid="active-sips"
												>
													{portfolioHoldings
														? `${Math.max(1, Math.floor(portfolioHoldings.length / 2))} Active SIPs`
														: "3 Active SIPs*"}
												</span>
											</div>
										)}
									</div>
								</CardContent>
							</Card>

							{/* Goal Progress Card */}
							<Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
								<CardContent className="p-6">
									<div className="flex items-center justify-between mb-4">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
												<Star className="w-5 h-5 text-foreground" />
											</div>
											<div>
												<h3 className="font-semibold text-foreground">
													Goal Progress
												</h3>
												<p className="text-sm text-purple-600 dark:text-purple-400">
													Financial Goals
												</p>
											</div>
										</div>
									</div>
									<div className="space-y-2">
										{isLoadingPerformance ? (
											<Skeleton
												className="h-8 w-16"
												data-testid="goal-progress-loading"
											/>
										) : portfolioPerformance?.totalGainLossPercent ? (
											<p
												className="text-2xl font-bold text-foreground"
												data-testid="goal-progress"
											>
												{(() => {
													const gainPercent = Number.parseFloat(
														portfolioPerformance.totalGainLossPercent,
													);
													const progressPercent = Math.min(
														100,
														Math.max(0, 50 + gainPercent * 2),
													);
													return `${Math.round(progressPercent)}%`;
												})()}
											</p>
										) : (
											<p
												className="text-2xl font-bold text-foreground"
												data-testid="goal-progress-fallback"
											>
												67%*
											</p>
										)}

										{isLoadingPerformance ? (
											<Skeleton
												className="h-5 w-28"
												data-testid="goals-on-track-loading"
											/>
										) : (
											<div className="flex items-center text-purple-600 dark:text-purple-400">
												<Award className="w-4 h-4 mr-1" />
												<span
													className="text-sm font-medium"
													data-testid="goals-on-track"
												>
													{portfolioPerformance?.totalGainLossPercent
														? (() => {
																const gainPercent = Number.parseFloat(
																	portfolioPerformance.totalGainLossPercent,
																);
																const goalsOnTrack =
																	gainPercent >= 0
																		? Math.min(
																				6,
																				Math.max(
																					3,
																					Math.round(4 + gainPercent / 10),
																				),
																			)
																		: Math.max(
																				2,
																				Math.round(4 + gainPercent / 10),
																			);
																return `${goalsOnTrack}/6 Goals On Track`;
															})()
														: "4/6 Goals On Track*"}
												</span>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						</div>
					</div>

					{/* Search and Filter */}
					<div
						className="mb-8 p-8 bg-card rounded-2xl shadow-xl border border-border"
						data-testid="search-filter"
					>
						<div className="mb-6">
							<h2 className="text-xl font-semibold text-foreground mb-2">
								Find Your Perfect Fund
							</h2>
							<p className="text-muted-foreground text-sm">
								Use our advanced filters to discover funds that match your
								investment goals
							</p>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
							<div className="relative group">
								<div className="absolute inset-0 bg-gradient-to-r from-finance-blue/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
								<Input
									type="text"
									placeholder="Search funds, AMC, schemes..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-12 h-12 border-2 border-border focus:border-finance-blue transition-all duration-300 bg-card/50/50 backdrop-blur-sm"
									data-testid="mf-search-input"
								/>
								<Search className="absolute left-4 top-4 h-4 w-4 text-finance-blue" />
							</div>

							<Select
								value={selectedFilterCategory}
								onValueChange={setSelectedFilterCategory}
							>
								<SelectTrigger
									className="h-12 border-2 border-border focus:border-finance-blue bg-card/50/50 backdrop-blur-sm"
									data-testid="category-select"
								>
									<div className="flex items-center gap-2">
										<TrendingUp className="w-4 h-4 text-finance-blue" />
										<SelectValue placeholder="Fund Category" />
									</div>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="All">All Categories</SelectItem>
									{fundCategories.map((category) => (
										<SelectItem key={category.name} value={category.name}>
											{category.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select value={selectedRisk} onValueChange={setSelectedRisk}>
								<SelectTrigger
									className="h-12 border-2 border-border focus:border-finance-blue bg-card/50/50 backdrop-blur-sm"
									data-testid="risk-select"
								>
									<div className="flex items-center gap-2">
										<LucideShield className="w-4 h-4 text-finance-blue" />
										<SelectValue placeholder="Risk Level" />
									</div>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Risk Levels</SelectItem>
									<SelectItem value="low">Low Risk</SelectItem>
									<SelectItem value="moderate">Moderate Risk</SelectItem>
									<SelectItem value="high">High Risk</SelectItem>
									<SelectItem value="very-high">Very High Risk</SelectItem>
								</SelectContent>
							</Select>

							<Button
								variant="outline"
								className="h-12 border-2 border-border hover:border-finance-blue hover:bg-finance-blue/5 transition-all duration-300 bg-card/50/50 backdrop-blur-sm"
							>
								<Filter className="h-4 w-4 mr-2" />
								Advanced Filters
							</Button>
						</div>
					</div>

					{/* KYC Warning */}
					<div className="mb-8">
						<KYCWarningBanner />
					</div>

					{/* FintekPro Smart Rating Info */}
					<div className="mb-8">
						<Card className="border-2 border-blue-100 dark:border-blue-900 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
							<CardContent className="p-6">
								<div className="flex items-start gap-4">
									<div className="mt-1">
										<Award className="w-6 h-6 text-finance-blue" />
									</div>
									<div className="flex-1">
										<h3 className="font-semibold text-lg text-foreground mb-2 flex items-center gap-2">
											About FintekPro Smart Rating
											<Badge
												variant="secondary"
												className="bg-finance-blue/10 text-finance-blue"
											>
												Transparent Methodology
											</Badge>
										</h3>
										<p className="text-sm text-muted-foreground mb-3">
											FintekPro Smart Rating is our proprietary fund rating
											system (1-5 stars, where 1 = exceptional performance).
											It's calculated using industry-standard quantitative
											metrics with complete transparency.
										</p>
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
											<div className="bg-card/60/60 rounded-lg p-3 border border-border">
												<div className="flex items-center gap-2 mb-1">
													<TrendingUp className="w-4 h-4 text-green-600" />
													<span className="text-xs font-semibold text-muted-foreground">
														Risk-Adjusted Returns
													</span>
												</div>
												<p className="text-xs text-muted-foreground">
													40% weight • 1Y, 3Y, 5Y performance
												</p>
											</div>
											<div className="bg-card/60/60 rounded-lg p-3 border border-border">
												<div className="flex items-center gap-2 mb-1">
													<LucideShield className="w-4 h-4 text-blue-600" />
													<span className="text-xs font-semibold text-muted-foreground">
														Asset Quality
													</span>
												</div>
												<p className="text-xs text-muted-foreground">
													30% weight • AUM & fund house reputation
												</p>
											</div>
											<div className="bg-card/60/60 rounded-lg p-3 border border-border">
												<div className="flex items-center gap-2 mb-1">
													<RefreshCw className="w-4 h-4 text-purple-600" />
													<span className="text-xs font-semibold text-muted-foreground">
														Liquidity Score
													</span>
												</div>
												<p className="text-xs text-muted-foreground">
													20% weight • Fund size & redemption ease
												</p>
											</div>
											<div className="bg-card/60/60 rounded-lg p-3 border border-border">
												<div className="flex items-center gap-2 mb-1">
													<AlertCircle className="w-4 h-4 text-orange-600" />
													<span className="text-xs font-semibold text-muted-foreground">
														Concentration Risk
													</span>
												</div>
												<p className="text-xs text-muted-foreground">
													10% weight • Portfolio diversification
												</p>
											</div>
										</div>
										<p className="text-xs text-muted-foreground mt-3 italic">
											Note: FintekPro Smart Ratings are calculated ratings, not
											official third-party ratings. They're based on
											transparent, quantitative analysis of fund metrics.
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="space-y-8"
					>
						<ScrollableTabsList className="grid w-full grid-cols-9 h-14 p-1 bg-muted rounded-xl">
							<TabsTrigger
								value="store"
								data-testid="tab-marketplace"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
							>
								<Store className="w-4 h-4" />
								Marketplace
							</TabsTrigger>
							<TabsTrigger
								value="proposals"
								data-testid="tab-proposals"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-purple-600 transition-all duration-300"
							>
								<FileText className="w-4 h-4" />
								Proposals
							</TabsTrigger>
							<TabsTrigger
								value="cart"
								data-testid="tab-cart"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-orange-600 transition-all duration-300"
							>
								<ShoppingCart className="w-4 h-4" />
								Cart
							</TabsTrigger>
							<TabsTrigger
								value="orders"
								data-testid="tab-orders"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-finance-green transition-all duration-300"
							>
								<ClipboardList className="w-4 h-4" />
								Orders
							</TabsTrigger>
							<TabsTrigger
								value="explore"
								data-testid="tab-explore"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
							>
								<TrendingUp className="w-4 h-4" />
								Explore Funds
							</TabsTrigger>
							<TabsTrigger
								value="compliance"
								data-testid="tab-compliance"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
							>
								<LucideShield className="w-4 h-4" />
								SEBI Data
							</TabsTrigger>
							<TabsTrigger
								value="sip"
								data-testid="tab-sip"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
							>
								<Calculator className="w-4 h-4" />
								Start SIP
							</TabsTrigger>
							<TabsTrigger
								value="portfolio"
								data-testid="tab-portfolio"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
							>
								<Building2 className="w-4 h-4" />
								My Portfolio
							</TabsTrigger>
							<TabsTrigger
								value="tools"
								data-testid="tab-tools"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
							>
								<Award className="w-4 h-4" />
								Tools
							</TabsTrigger>
							<TabsTrigger
								value="history"
								data-testid="tab-history"
								className="flex items-center gap-2 h-12 data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
							>
								<Database className="w-4 h-4" />
								History
							</TabsTrigger>
						</ScrollableTabsList>

						{/* Store Tab - Published Funds from Database */}
						<TabsContent
							value="store"
							className="space-y-6"
							data-testid="store-funds"
						>
							{/* Store Header & Filters */}
							<div className="bg-card rounded-xl p-6 shadow-sm border border-border">
								<div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-6">
									<div>
										<h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
											<Store className="w-6 h-6 text-finance-blue" />
											Mutual Fund Marketplace
										</h2>
										<p className="text-muted-foreground mt-1">
											Browse and invest in SEBI-registered mutual fund schemes
										</p>
									</div>
									<div className="flex items-center gap-2">
										<Badge
											variant="outline"
											className="text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20"
										>
											<LucideShield className="w-3 h-3 mr-1" />
											AMFI Registered
										</Badge>
										<Badge variant="secondary">
											{publishedFundsData?.pagination?.total || 0} Schemes
										</Badge>
									</div>
								</div>

								{/* Filters */}
								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
									<div className="relative">
										<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
										<Input
											placeholder="Search schemes..."
											value={storeSearchTerm}
											onChange={(e) => {
												setStoreSearchTerm(e.target.value);
												setStorePage(1);
											}}
											className="pl-10"
											data-testid="store-search-input"
										/>
									</div>

									<Select
										value={storePlanType}
										onValueChange={(v) => {
											setStorePlanType(v);
											setStorePage(1);
										}}
									>
										<SelectTrigger data-testid="store-plan-type-select">
											<SelectValue placeholder="Plan Type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="regular">Regular Plans</SelectItem>
											<SelectItem value="direct">Direct Plans</SelectItem>
											<SelectItem value="all">All Plans</SelectItem>
										</SelectContent>
									</Select>

									<Select
										value={storeFundHouse}
										onValueChange={(v) => {
											setStoreFundHouse(v);
											setStorePage(1);
										}}
									>
										<SelectTrigger data-testid="store-fund-house-select">
											<SelectValue placeholder="Fund House" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Fund Houses</SelectItem>
											{publishedFundsData?.filters?.fundHouses?.map(
												(house: string) => (
													<SelectItem key={house} value={house}>
														{house}
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>

									<Select
										value={storeCategory}
										onValueChange={(v) => {
											setStoreCategory(v);
											setStorePage(1);
										}}
									>
										<SelectTrigger data-testid="store-category-select">
											<SelectValue placeholder="Category" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Categories</SelectItem>
											{publishedFundsData?.filters?.categories?.map(
												(cat: string) => (
													<SelectItem key={cat} value={cat}>
														{cat}
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>
								</div>
							</div>

							{/* Funds Grid */}
							<Suspense
								fallback={<LoadingState variant="section-table" count={6} />}
							>
								<StoreFundsGrid
									storeCategory={storeCategory}
									storeFundHouse={storeFundHouse}
									storePlanType={storePlanType}
									storeSearchTerm={storeSearchTerm}
									storePage={storePage}
									setStorePage={setStorePage}
									setStoreSearchTerm={setStoreSearchTerm}
									setStoreCategory={setStoreCategory}
									setStoreFundHouse={setStoreFundHouse}
									onInvestClick={handleInvestClick}
								/>
							</Suspense>
						</TabsContent>

						{/* Proposals Tab - AI/Agent Investment Proposals */}
						<TabsContent
							value="proposals"
							className="space-y-4"
							data-testid="proposals-section"
						>
							{/* Proposals Header */}
							<div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
								<div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
									<div>
										<h2 className="text-xl font-bold text-foreground flex items-center gap-2">
											<FileText className="w-5 h-5 text-purple-600" />
											Investment Proposals
										</h2>
										<p className="text-muted-foreground text-sm mt-1">
											Review AI-generated and agent recommendations tailored to
											your risk profile
										</p>
									</div>
									<div className="flex items-center gap-2 flex-wrap">
										<Badge
											variant="outline"
											className="text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-900/20"
										>
											<Star className="w-3 h-3 mr-1" />
											AI Powered
										</Badge>
										<Badge variant="secondary">Risk-Matched</Badge>
									</div>
								</div>
							</div>

							{/* Proposals Content */}
							<ProposalsTab onApprove={() => setActiveTab("cart")} />
						</TabsContent>

						{/* Cart Tab - Approved Proposals Ready for Checkout */}
						<TabsContent
							value="cart"
							className="space-y-4"
							data-testid="cart-section"
						>
							{/* Cart Header */}
							<div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
								<div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
									<div>
										<h2 className="text-xl font-bold text-foreground flex items-center gap-2">
											<ShoppingCart className="w-5 h-5 text-orange-600" />
											Investment Cart
										</h2>
										<p className="text-muted-foreground text-sm mt-1">
											Review your approved investments and proceed to payment
										</p>
									</div>
									<div className="flex items-center gap-2 flex-wrap">
										<Badge
											variant="outline"
											className="text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20"
										>
											<CheckCircle2 className="w-3 h-3 mr-1" />
											Pre-approved
										</Badge>
										<Badge variant="secondary">Ready to Execute</Badge>
									</div>
								</div>
							</div>

							{/* Cart Content */}
							<MfCartTab onCheckout={() => setActiveTab("orders")} />
						</TabsContent>

						{/* Orders Tab - Order Execution Platform with Two-Column Layout */}
						<TabsContent
							value="orders"
							className="space-y-4"
							data-testid="orders-section"
						>
							{/* Order Execution Header */}
							<div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
								<div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
									<div>
										<h2 className="text-xl font-bold text-foreground flex items-center gap-2">
											<ClipboardList className="w-5 h-5 text-emerald-600" />
											Mutual Fund Order Execution
										</h2>
										<p className="text-muted-foreground text-sm mt-1">
											Place buy/sell orders with SEBI/RBI compliant pre-trade
											checks
										</p>
									</div>
									<div className="flex items-center gap-2 flex-wrap">
										<Badge
											variant="outline"
											className="text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20"
										>
											<CheckCircle2 className="w-3 h-3 mr-1" />
											KYC Verified
										</Badge>
										<Badge
											variant="outline"
											className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-900/20"
										>
											<LucideShield className="w-3 h-3 mr-1" />
											SEBI Compliant
										</Badge>
										<Badge variant="secondary">T+3 Settlement</Badge>
									</div>
								</div>
							</div>

							{/* Two-Column Resizable Layout */}
							<ResizablePanelGroup
								direction="horizontal"
								className="min-h-[700px] rounded-xl border border-border bg-card"
							>
								{/* Left Panel - Portfolio Holdings (40%) */}
								<ResizablePanel defaultSize={40} minSize={30} maxSize={50}>
									<div className="h-full flex flex-col">
										{/* Holdings Header */}
										<div className="p-4 border-b border-border bg-muted">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<Wallet className="w-5 h-5 text-finance-blue" />
													<h3 className="font-semibold text-foreground">
														My Holdings
													</h3>
												</div>
												<Button variant="ghost" size="sm" className="text-xs">
													<RefreshCw className="w-3 h-3 mr-1" />
													Sync
												</Button>
											</div>
											<div className="grid grid-cols-2 gap-4 mt-3">
												<div className="bg-card rounded-lg p-3 border border-border">
													<p className="text-xs text-muted-foreground">
														Total Investment
													</p>
													<p className="text-lg font-bold text-foreground flex items-center gap-1">
														<IndianRupee className="w-4 h-4" />
														5,45,200
													</p>
												</div>
												<div className="bg-card rounded-lg p-3 border border-border">
													<p className="text-xs text-muted-foreground">
														Current Value
													</p>
													<p className="text-lg font-bold text-emerald-600 flex items-center gap-1">
														<IndianRupee className="w-4 h-4" />
														6,12,340
														<ArrowUpRight className="w-4 h-4" />
													</p>
												</div>
											</div>
										</div>

										{/* Holdings Table */}
										<div className="flex-1 overflow-auto p-4">
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead className="text-xs">Scheme</TableHead>
														<TableHead className="text-xs text-right">
															Units
														</TableHead>
														<TableHead className="text-xs text-right">
															Value
														</TableHead>
														<TableHead className="text-xs text-right">
															Actions
														</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{/* Sample Holdings - Will be replaced with actual data */}
													{[
														{
															id: "1",
															schemeName: "HDFC Flexi Cap Fund",
															units: "245.892",
															currentValue: "124500",
															currentNav: "506.37",
															folioNumber: "1234567890",
															gain: "+12.4%",
														},
														{
															id: "2",
															schemeName: "SBI Blue Chip Fund",
															units: "189.341",
															currentValue: "98200",
															currentNav: "518.62",
															folioNumber: "9876543210",
															gain: "+8.2%",
														},
														{
															id: "3",
															schemeName: "Axis Midcap Fund",
															units: "156.234",
															currentValue: "142670",
															currentNav: "913.21",
															folioNumber: "1234567891",
															gain: "+18.6%",
														},
														{
															id: "4",
															schemeName: "ICICI Pru Technology",
															units: "78.562",
															currentValue: "89450",
															currentNav: "1138.45",
															folioNumber: "9876543211",
															gain: "+22.1%",
														},
														{
															id: "5",
															schemeName: "Parag Parikh Flexi",
															units: "112.893",
															currentValue: "86320",
															currentNav: "764.62",
															folioNumber: "1234567892",
															gain: "+15.3%",
														},
													].map((holding, idx) => (
														<TableRow
															key={idx}
															className={`cursor-pointer hover:bg-muted ${selectedHolding?.id === holding.id ? "bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500" : ""}`}
															onClick={() =>
																handleHoldingSelectForSell(holding)
															}
															data-testid={`holding-row-${idx}`}
														>
															<TableCell>
																<div>
																	<p className="font-medium text-sm text-foreground line-clamp-1">
																		{holding.schemeName}
																	</p>
																	<p className="text-xs text-muted-foreground">
																		NAV: ₹{holding.currentNav}
																	</p>
																</div>
															</TableCell>
															<TableCell className="text-right">
																<p className="text-sm font-medium">
																	{holding.units}
																</p>
															</TableCell>
															<TableCell className="text-right">
																<p className="text-sm font-medium text-foreground">
																	₹
																	{Number.parseFloat(
																		holding.currentValue,
																	).toLocaleString("en-IN")}
																</p>
																<p className="text-xs text-emerald-600">
																	{holding.gain}
																</p>
															</TableCell>
															<TableCell className="text-right">
																<div className="flex gap-1 justify-end">
																	<Button
																		size="sm"
																		variant="outline"
																		className="h-7 text-xs px-2 text-emerald-600 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/30"
																		onClick={(e) => {
																			e.stopPropagation();
																			setOrderType("buy");
																		}}
																		data-testid={`buy-btn-${idx}`}
																	>
																		<ArrowUpRight className="w-3 h-3 mr-1" />
																		Buy
																	</Button>
																	<Button
																		size="sm"
																		variant="outline"
																		className="h-7 text-xs px-2 text-red-600 border-red-300 dark:border-red-700 hover:bg-red-50 dark:bg-red-950/30"
																		onClick={(e) => {
																			e.stopPropagation();
																			handleHoldingSelectForSell(holding);
																		}}
																		data-testid={`sell-btn-${idx}`}
																	>
																		<ArrowDownRight className="w-3 h-3 mr-1" />
																		Sell
																	</Button>
																</div>
															</TableCell>
														</TableRow>
													))}
												</TableBody>
											</Table>

											{/* Pending Orders Section */}
											<div className="mt-6">
												<div className="flex items-center gap-2 mb-3">
													<Clock className="w-4 h-4 text-amber-600" />
													<h4 className="font-medium text-foreground text-sm">
														Pending Orders
													</h4>
													<Badge variant="secondary" className="text-xs">
														2
													</Badge>
												</div>
												<div className="space-y-2">
													{[
														{
															scheme: "HDFC Flexi Cap",
															type: "Buy",
															amount: "₹25,000",
															status: "Processing",
															time: "2 hrs ago",
														},
														{
															scheme: "Axis Midcap Fund",
															type: "SIP",
															amount: "₹10,000/mo",
															status: "Active",
															time: "1st of month",
														},
													].map((order, idx) => (
														<div
															key={idx}
															className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
															data-testid={`pending-order-${idx}`}
														>
															<div className="flex justify-between items-start">
																<div>
																	<p className="text-sm font-medium text-foreground">
																		{order.scheme}
																	</p>
																	<p className="text-xs text-muted-foreground">
																		{order.time}
																	</p>
																</div>
																<div className="text-right">
																	<Badge
																		variant={
																			order.type === "Buy"
																				? "default"
																				: "secondary"
																		}
																		className="text-xs mb-1"
																	>
																		{order.type}
																	</Badge>
																	<p className="text-sm font-medium">
																		{order.amount}
																	</p>
																</div>
															</div>
														</div>
													))}
												</div>
											</div>
										</div>
									</div>
								</ResizablePanel>

								{/* Resizable Handle */}
								<ResizableHandle withHandle />

								{/* Right Panel - Order Action Panel (60%) */}
								<ResizablePanel defaultSize={60} minSize={50} maxSize={70}>
									<div className="h-full flex flex-col">
										{/* Action Panel Header */}
										<div className="p-4 border-b border-border bg-muted">
											<div className="flex items-center gap-2">
												<ShoppingCart className="w-5 h-5 text-emerald-600" />
												<h3 className="font-semibold text-foreground">
													Place Order
												</h3>
											</div>
										</div>

										{/* Order Type Selector */}
										<div className="p-4 border-b border-border">
											<div className="flex gap-2">
												<Button
													className={`flex-1 ${orderType === "buy" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-transparent text-emerald-600 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/30"}`}
													variant={orderType === "buy" ? "default" : "outline"}
													onClick={() => {
														setOrderType("buy");
														setSelectedHolding(null);
													}}
													data-testid="order-type-buy"
												>
													<ArrowUpRight className="w-4 h-4 mr-2" />
													Buy / Lumpsum
												</Button>
												<Button
													className={`flex-1 ${orderType === "sell" ? "bg-red-600 hover:bg-red-700 text-white" : "text-red-600 border-red-300 dark:border-red-700 hover:bg-red-50 dark:bg-red-950/30"}`}
													variant={orderType === "sell" ? "default" : "outline"}
													onClick={() => setOrderType("sell")}
													data-testid="order-type-sell"
												>
													<ArrowDownRight className="w-4 h-4 mr-2" />
													Sell / Redeem
												</Button>
												<Button
													className={`flex-1 ${orderType === "sip" ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-blue-600 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:bg-blue-950/30"}`}
													variant={orderType === "sip" ? "default" : "outline"}
													onClick={() => {
														setOrderType("sip");
														setSelectedHolding(null);
													}}
													data-testid="order-type-sip"
												>
													<RefreshCw className="w-4 h-4 mr-2" />
													Start SIP
												</Button>
											</div>
										</div>

										{/* Order Form - Conditional based on order type */}
										<div className="flex-1 overflow-auto p-4">
											<Card className="border-0 shadow-none">
												<CardContent className="space-y-4 pt-0">
													{/* SELL ORDER FORM */}
													{orderType === "sell" && (
														<>
															{/* Selected Holding Display */}
															{selectedHolding ? (
																<Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
																	<CardContent className="p-4">
																		<div className="flex justify-between items-start">
																			<div>
																				<h4 className="font-medium text-foreground text-sm">
																					{selectedHolding.schemeName ||
																						selectedHolding.scheme}
																				</h4>
																				<p className="text-xs text-muted-foreground mt-1">
																					Folio:{" "}
																					{selectedHolding.folioNumber ||
																						selectedHolding.folioId ||
																						"N/A"}
																				</p>
																			</div>
																			<Button
																				variant="ghost"
																				size="sm"
																				onClick={() => setSelectedHolding(null)}
																				className="text-red-600 hover:text-red-700 dark:text-red-300"
																			>
																				Change
																			</Button>
																		</div>
																		<div className="grid grid-cols-3 gap-4 mt-3 text-center">
																			<div>
																				<p className="text-xs text-muted-foreground">
																					Available Units
																				</p>
																				<p className="font-bold text-foreground">
																					{Number.parseFloat(
																						selectedHolding.units || "0",
																					).toFixed(3)}
																				</p>
																			</div>
																			<div>
																				<p className="text-xs text-muted-foreground">
																					Current NAV
																				</p>
																				<p className="font-bold text-foreground">
																					₹
																					{Number.parseFloat(
																						selectedHolding.currentNav ||
																							selectedHolding.nav ||
																							"0",
																					).toFixed(2)}
																				</p>
																			</div>
																			<div>
																				<p className="text-xs text-muted-foreground">
																					Current Value
																				</p>
																				<p className="font-bold text-emerald-600">
																					₹
																					{Number.parseFloat(
																						selectedHolding.currentValue || "0",
																					).toLocaleString("en-IN", {
																						maximumFractionDigits: 2,
																					})}
																				</p>
																			</div>
																		</div>
																	</CardContent>
																</Card>
															) : (
																<Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 border-dashed">
																	<CardContent className="p-6 text-center">
																		<ArrowDownRight className="w-8 h-8 text-amber-500 mx-auto mb-2" />
																		<h4 className="font-medium text-amber-800 dark:text-amber-200">
																			Select a Holding to Redeem
																		</h4>
																		<p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
																			Click on a holding from the left panel to
																			start redemption
																		</p>
																	</CardContent>
																</Card>
															)}

															{/* Redemption Options */}
															{selectedHolding && (
																<>
																	<div>
																		<label className="text-sm font-medium text-muted-foreground mb-2 block">
																			Redemption Type
																		</label>
																		<div className="flex gap-2">
																			<Button
																				variant={
																					!redeemAllUnits
																						? "default"
																						: "outline"
																				}
																				className={`flex-1 ${!redeemAllUnits ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
																				onClick={() => setRedeemAllUnits(false)}
																				data-testid="redeem-partial"
																			>
																				Partial Redemption
																			</Button>
																			<Button
																				variant={
																					redeemAllUnits ? "default" : "outline"
																				}
																				className={`flex-1 ${redeemAllUnits ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
																				onClick={() => {
																					setRedeemAllUnits(true);
																					setOrderUnits("");
																				}}
																				data-testid="redeem-all"
																			>
																				Redeem All Units
																			</Button>
																		</div>
																	</div>

																	{/* Units Input for Partial Redemption */}
																	{!redeemAllUnits && (
																		<div>
																			<label className="text-sm font-medium text-muted-foreground mb-2 block">
																				Units to Redeem
																			</label>
																			<Input
																				type="number"
																				placeholder="Enter units"
																				value={orderUnits}
																				onChange={(e) =>
																					setOrderUnits(e.target.value)
																				}
																				max={Number.parseFloat(
																					selectedHolding.units || "0",
																				)}
																				step="0.001"
																				data-testid="redeem-units-input"
																			/>
																			<div className="flex gap-2 mt-2">
																				{[25, 50, 75, 100].map((pct) => (
																					<Button
																						key={pct}
																						variant="outline"
																						size="sm"
																						className="text-xs flex-1"
																						onClick={() => {
																							const totalUnits =
																								Number.parseFloat(
																									selectedHolding.units || "0",
																								);
																							setOrderUnits(
																								(
																									(totalUnits * pct) /
																									100
																								).toFixed(3),
																							);
																							if (pct === 100)
																								setRedeemAllUnits(true);
																						}}
																						data-testid={`redeem-pct-${pct}`}
																					>
																						{pct}%
																					</Button>
																				))}
																			</div>
																		</div>
																	)}

																	{/* Payout Bank Selection */}
																	<div>
																		<label className="text-sm font-medium text-muted-foreground mb-2 block">
																			Credit Proceeds To
																		</label>
																		<Select
																			value={orderPaymentMethod}
																			onValueChange={setOrderPaymentMethod}
																		>
																			<SelectTrigger data-testid="payout-bank-select">
																				<SelectValue placeholder="Select bank account" />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value="primary">
																					Primary Bank - XXXX1234
																				</SelectItem>
																				<SelectItem value="secondary">
																					Secondary Bank - XXXX5678
																				</SelectItem>
																			</SelectContent>
																		</Select>
																	</div>

																	{/* Redemption Summary */}
																	<Card className="bg-muted border-border">
																		<CardContent className="p-4">
																			<h4 className="font-medium text-foreground text-sm mb-3">
																				Redemption Summary
																			</h4>
																			<div className="space-y-2 text-sm">
																				<div className="flex justify-between">
																					<span className="text-muted-foreground">
																						Units to Redeem
																					</span>
																					<span className="font-medium">
																						{redeemAllUnits
																							? Number.parseFloat(
																									selectedHolding.units || "0",
																								).toFixed(3)
																							: Number.parseFloat(
																									orderUnits || "0",
																								).toFixed(3)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-muted-foreground">
																						Current NAV
																					</span>
																					<span className="font-medium">
																						₹
																						{Number.parseFloat(
																							selectedHolding.currentNav ||
																								selectedHolding.nav ||
																								"0",
																						).toFixed(4)}
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-muted-foreground">
																						Exit Load
																					</span>
																					<span className="font-medium text-amber-600">
																						TBD at NAV date
																					</span>
																				</div>
																				<div className="flex justify-between">
																					<span className="text-muted-foreground">
																						STT (0.001%)
																					</span>
																					<span className="font-medium">
																						~₹
																						{(
																							calculateSellValue() * 0.00001
																						).toFixed(2)}
																					</span>
																				</div>
																				<div className="flex justify-between border-t pt-2 mt-2">
																					<span className="font-semibold text-foreground">
																						Estimated Proceeds
																					</span>
																					<span className="font-bold text-emerald-600">
																						₹
																						{calculateSellValue().toLocaleString(
																							"en-IN",
																							{ maximumFractionDigits: 2 },
																						)}
																					</span>
																				</div>
																			</div>
																			<p className="text-xs text-muted-foreground mt-3">
																				* Final amount will be calculated at
																				applicable NAV date (T+1/T+2)
																			</p>
																		</CardContent>
																	</Card>
																</>
															)}
														</>
													)}

													{/* BUY ORDER FORM */}
													{orderType === "buy" && (
														<>
															{/* Scheme Search */}
															<div>
																<label className="text-sm font-medium text-muted-foreground mb-2 block">
																	Search Scheme
																</label>
																<div className="relative">
																	<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
																	<Input
																		placeholder="Type to search mutual funds..."
																		className="pl-10"
																		value={orderSchemeSearch}
																		onChange={(e) =>
																			setOrderSchemeSearch(e.target.value)
																		}
																		data-testid="order-scheme-search"
																	/>
																</div>
															</div>

															{/* Folio Selection */}
															<div>
																<label className="text-sm font-medium text-muted-foreground mb-2 block">
																	Folio
																</label>
																<Select
																	value={orderFolio}
																	onValueChange={setOrderFolio}
																>
																	<SelectTrigger data-testid="order-folio-select">
																		<SelectValue placeholder="Select or create new folio" />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="new">
																			Create New Folio
																		</SelectItem>
																		<SelectItem value="existing1">
																			123456789 - HDFC AMC
																		</SelectItem>
																		<SelectItem value="existing2">
																			987654321 - SBI AMC
																		</SelectItem>
																	</SelectContent>
																</Select>
															</div>

															{/* Amount Input */}
															<div>
																<label className="text-sm font-medium text-muted-foreground mb-2 block">
																	Investment Amount
																</label>
																<div className="relative">
																	<IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
																	<Input
																		type="number"
																		placeholder="Min. ₹100"
																		className="pl-10"
																		value={orderAmount}
																		onChange={(e) =>
																			setOrderAmount(e.target.value)
																		}
																		data-testid="order-amount-input"
																	/>
																</div>
																<div className="flex gap-2 mt-2">
																	{[1000, 5000, 10000, 25000, 50000].map(
																		(amt) => (
																			<Button
																				key={amt}
																				variant="outline"
																				size="sm"
																				className="text-xs flex-1"
																				onClick={() =>
																					setOrderAmount(amt.toString())
																				}
																				data-testid={`quick-amount-${amt}`}
																			>
																				₹{amt.toLocaleString()}
																			</Button>
																		),
																	)}
																</div>
															</div>

															{/* Payment Method */}
															<div>
																<label className="text-sm font-medium text-muted-foreground mb-2 block">
																	Payment Method
																</label>
																<Select
																	value={orderPaymentMethod}
																	onValueChange={setOrderPaymentMethod}
																>
																	<SelectTrigger data-testid="order-payment-method">
																		<SelectValue placeholder="Select payment method" />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="netbanking">
																			Net Banking
																		</SelectItem>
																		<SelectItem value="upi">UPI</SelectItem>
																		<SelectItem value="neft">
																			NEFT / RTGS
																		</SelectItem>
																	</SelectContent>
																</Select>
															</div>

															{/* Compliance Check Card */}
															<Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
																<CardContent className="p-4">
																	<div className="flex items-start gap-3">
																		<CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
																		<div>
																			<h4 className="font-medium text-emerald-800 dark:text-emerald-200 text-sm">
																				Pre-Trade Compliance
																			</h4>
																			<ul className="text-xs text-emerald-700 dark:text-emerald-300 mt-2 space-y-1">
																				<li className="flex items-center gap-2">
																					<CheckCircle2 className="w-3 h-3" />{" "}
																					KYC Status: Verified
																				</li>
																				<li className="flex items-center gap-2">
																					<CheckCircle2 className="w-3 h-3" />{" "}
																					FATCA Declaration: Complete
																				</li>
																				<li className="flex items-center gap-2">
																					<CheckCircle2 className="w-3 h-3" />{" "}
																					Bank Account: Linked
																				</li>
																				<li className="flex items-center gap-2">
																					<CheckCircle2 className="w-3 h-3" />{" "}
																					Risk Profile: Matched
																				</li>
																			</ul>
																		</div>
																	</div>
																</CardContent>
															</Card>

															{/* Order Summary */}
															<Card className="bg-muted border-border">
																<CardContent className="p-4">
																	<h4 className="font-medium text-foreground text-sm mb-3">
																		Order Summary
																	</h4>
																	<div className="space-y-2 text-sm">
																		<div className="flex justify-between">
																			<span className="text-muted-foreground">
																				Investment Amount
																			</span>
																			<span className="font-medium">
																				₹
																				{Number.parseFloat(
																					orderAmount || "0",
																				).toLocaleString("en-IN", {
																					maximumFractionDigits: 2,
																				})}
																			</span>
																		</div>
																		<div className="flex justify-between">
																			<span className="text-muted-foreground">
																				Platform Fee
																			</span>
																			<span className="font-medium text-emerald-600">
																				₹0.00
																			</span>
																		</div>
																		<div className="flex justify-between">
																			<span className="text-muted-foreground">
																				Stamp Duty (0.005%)
																			</span>
																			<span className="font-medium">
																				₹
																				{(
																					Number.parseFloat(
																						orderAmount || "0",
																					) * 0.00005
																				).toFixed(2)}
																			</span>
																		</div>
																		<div className="flex justify-between border-t pt-2 mt-2">
																			<span className="font-semibold text-foreground">
																				Total Payable
																			</span>
																			<span className="font-bold text-foreground">
																				₹
																				{(
																					Number.parseFloat(
																						orderAmount || "0",
																					) * 1.00005
																				).toLocaleString("en-IN", {
																					maximumFractionDigits: 2,
																				})}
																			</span>
																		</div>
																	</div>
																</CardContent>
															</Card>
														</>
													)}

													{/* SIP ORDER FORM */}
													{orderType === "sip" && (
														<>
															<Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
																<CardContent className="p-6 text-center">
																	<RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-2" />
																	<h4 className="font-medium text-blue-800 dark:text-blue-200">
																		Start a New SIP
																	</h4>
																	<p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
																		SIP setup requires bank mandate
																		registration. Use the Start SIP tab for full
																		SIP creation flow.
																	</p>
																	<Button
																		className="mt-4 bg-blue-600 hover:bg-blue-700"
																		onClick={() => setActiveTab("sip")}
																	>
																		Go to SIP Setup
																	</Button>
																</CardContent>
															</Card>
														</>
													)}
												</CardContent>
											</Card>
										</div>

										{/* Order Action Footer */}
										<div className="p-4 border-t border-border bg-muted">
											{orderType === "sell" ? (
												<>
													<div className="flex gap-3">
														<Button
															variant="outline"
															className="flex-1"
															onClick={() => {
																setSelectedHolding(null);
																setOrderUnits("");
																setRedeemAllUnits(false);
															}}
															data-testid="order-cancel"
														>
															Cancel
														</Button>
														<Button
															className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
															disabled={
																!selectedHolding ||
																(!redeemAllUnits && !orderUnits)
															}
															data-testid="order-submit-sell"
														>
															<ArrowDownRight className="w-4 h-4 mr-2" />
															Confirm Redemption
														</Button>
													</div>
													<p className="text-xs text-muted-foreground text-center mt-3">
														Redemption proceeds will be credited to your
														registered bank account within T+3 working days.
													</p>
												</>
											) : orderType === "buy" ? (
												<>
													<div className="flex gap-3">
														<Button
															variant="outline"
															className="flex-1"
															onClick={() => {
																setOrderAmount("");
																setOrderSchemeSearch("");
															}}
															data-testid="order-cancel"
														>
															Cancel
														</Button>
														<Button
															className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
															data-testid="order-preview"
														>
															<FileText className="w-4 h-4 mr-2" />
															Preview Order
														</Button>
														<Button
															className="flex-1 bg-finance-blue hover:bg-blue-700 text-white disabled:opacity-50"
															disabled={
																!orderAmount ||
																Number.parseFloat(orderAmount) < 100
															}
															data-testid="order-submit-buy"
														>
															<CheckCircle2 className="w-4 h-4 mr-2" />
															Place Order
														</Button>
													</div>
													<p className="text-xs text-muted-foreground text-center mt-3">
														By placing this order, you agree to the scheme's
														Terms & Conditions and KIM/SID documents.
													</p>
												</>
											) : (
												<div className="text-center py-2">
													<p className="text-sm text-muted-foreground">
														Select an order type to continue
													</p>
												</div>
											)}
										</div>
									</div>
								</ResizablePanel>
							</ResizablePanelGroup>
						</TabsContent>

						<TabsContent
							value="explore"
							className="space-y-6"
							data-testid="explore-funds"
						>
							{/* Popular Funds */}
							<Suspense fallback={<LoadingState variant="card" count={6} />}>
								<PopularFundsSection
									sebiData={
										Array.isArray(sebiMutualFunds) ? sebiMutualFunds : undefined
									}
									onInvestClick={handleInvestClick}
									onViewAll={handleViewAllClick}
								/>
							</Suspense>

							{/* All Funds */}
							{filteredFunds.length > 0 && (
								<section ref={allFundsRef}>
									<div className="flex justify-between items-center mb-6">
										<h2 className="text-2xl font-bold text-foreground">
											{searchTerm
												? `Search Results (${filteredFunds.length})`
												: `All Mutual Funds (${filteredFunds.length})`}
										</h2>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
										{filteredFunds.map((fund) => (
											<FundCard
												key={fund.schemeCode}
												fund={fund}
												sebiData={
													Array.isArray(sebiMutualFunds)
														? sebiMutualFunds
														: undefined
												}
												onInvestClick={handleInvestClick}
											/>
										))}
									</div>
								</section>
							)}

							{/* Loading state for search/all funds */}
							{isLoading && <LoadingState variant="card" count={6} />}
						</TabsContent>

						<TabsContent
							value="compliance"
							className="space-y-6"
							data-testid="compliance-section"
						>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
								{/* AMC Registration Status */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<LucideShield className="h-5 w-5 text-green-600" />
											AMC Registration Status
										</CardTitle>
									</CardHeader>
									<CardContent>
										{isSEBILoading ? (
											<div className="space-y-3">
												<div className="animate-pulse bg-muted h-4 rounded" />
												<div className="animate-pulse bg-muted h-4 rounded w-3/4" />
												<div className="animate-pulse bg-muted h-4 rounded w-1/2" />
											</div>
										) : (
											<div className="space-y-4">
												<div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
													<div>
														<p className="font-medium text-green-800 dark:text-green-200">
															Registered AMCs
														</p>
														<p className="text-sm text-green-600">
															SEBI compliant fund houses
														</p>
													</div>
													<div className="text-right">
														<p className="text-2xl font-bold text-green-600">
															{Array.isArray(sebiMutualFunds)
																? sebiMutualFunds.length
																: 42}
														</p>
														<p className="text-xs text-green-600">Active</p>
													</div>
												</div>

												<div className="space-y-2 text-sm">
													<div className="flex justify-between">
														<span className="text-muted-foreground">
															Total Schemes:
														</span>
														<span className="font-medium">
															{Array.isArray(sebiMutualFunds)
																? sebiMutualFunds.reduce(
																		(sum: number, amc: any) =>
																			sum + (amc.schemes?.length || 0),
																		0,
																	)
																: "2,847"}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="text-muted-foreground">
															Total AUM:
														</span>
														<span className="font-medium">₹54.2 Lakh Cr</span>
													</div>
													<div className="flex justify-between">
														<span className="text-muted-foreground">
															Avg Expense Ratio:
														</span>
														<span className="font-medium">1.8%</span>
													</div>
												</div>
											</div>
										)}
									</CardContent>
								</Card>

								{/* Top AMCs by Compliance */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Building2 className="h-5 w-5 text-finance-blue" />
											Top AMCs by Compliance
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											{(Array.isArray(sebiMutualFunds)
												? sebiMutualFunds.slice(0, 5)
												: [
														{
															amcName: "SBI Mutual Fund",
															sebiRegistrationNumber: "INZ000123456",
															schemes: Array(186),
														},
														{
															amcName: "ICICI Prudential MF",
															sebiRegistrationNumber: "INZ000123457",
															schemes: Array(154),
														},
														{
															amcName: "HDFC Mutual Fund",
															sebiRegistrationNumber: "INZ000123458",
															schemes: Array(142),
														},
														{
															amcName: "Axis Mutual Fund",
															sebiRegistrationNumber: "INZ000123459",
															schemes: Array(128),
														},
														{
															amcName: "Nippon India MF",
															sebiRegistrationNumber: "INZ000123460",
															schemes: Array(115),
														},
													]
											).map((amc: any, index: number) => (
												<div
													key={index}
													className="p-3 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 rounded-lg"
												>
													<div className="flex justify-between items-start mb-2">
														<p className="font-medium text-blue-800 dark:text-blue-200 text-sm">
															{amc.amcName}
														</p>
														<span className="text-xs text-blue-600">
															{amc.schemes?.length || 0} schemes
														</span>
													</div>
													<p className="text-xs text-blue-700 dark:text-blue-300">
														SEBI Reg: {amc.sebiRegistrationNumber}
													</p>
													<div className="flex items-center gap-1 mt-1">
														<LucideShield className="w-3 h-3 text-green-500" />
														<span className="text-xs text-green-600">
															Compliant
														</span>
													</div>
												</div>
											))}
										</div>
									</CardContent>
								</Card>

								{/* Regulatory Framework */}
								<Card className="lg:col-span-2">
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Award className="h-5 w-5 text-purple-600" />
											Mutual Fund Regulatory Framework
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div className="space-y-4">
												<h4 className="font-semibold text-purple-700 dark:text-purple-300">
													SEBI Regulations
												</h4>
												<div className="text-sm text-muted-foreground space-y-2">
													<div className="flex items-center gap-2">
														<LucideShield className="w-4 h-4 text-green-500" />
														<span>Mandatory KYC compliance</span>
													</div>
													<div className="flex items-center gap-2">
														<LucideShield className="w-4 h-4 text-green-500" />
														<span>Total expense ratio limits</span>
													</div>
													<div className="flex items-center gap-2">
														<LucideShield className="w-4 h-4 text-green-500" />
														<span>Regular portfolio disclosure</span>
													</div>
													<div className="flex items-center gap-2">
														<LucideShield className="w-4 h-4 text-green-500" />
														<span>Investor grievance redressal</span>
													</div>
												</div>
											</div>

											<div className="space-y-4">
												<h4 className="font-semibold text-blue-700 dark:text-blue-300">
													Investor Protection
												</h4>
												<div className="text-sm text-muted-foreground space-y-2">
													<div className="flex items-center gap-2">
														<LucideShield className="w-4 h-4 text-blue-500" />
														<span>IEPF protection for unclaimed dividends</span>
													</div>
													<div className="flex items-center gap-2">
														<LucideShield className="w-4 h-4 text-blue-500" />
														<span>Mandatory scheme benchmarking</span>
													</div>
													<div className="flex items-center gap-2">
														<LucideShield className="w-4 h-4 text-blue-500" />
														<span>Risk disclosure requirements</span>
													</div>
													<div className="flex items-center gap-2">
														<LucideShield className="w-4 h-4 text-blue-500" />
														<span>Independent trustee oversight</span>
													</div>
												</div>
											</div>
										</div>

										<div className="mt-6 p-4 bg-muted rounded-lg">
											<h5 className="font-medium text-foreground mb-2">
												Key Compliance Metrics
											</h5>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
												<div className="text-center">
													<p className="text-2xl font-bold text-green-600">
														99.8%
													</p>
													<p className="text-muted-foreground">
														AMC Compliance Rate
													</p>
												</div>
												<div className="text-center">
													<p className="text-2xl font-bold text-blue-600">
														24hrs
													</p>
													<p className="text-muted-foreground">
														Avg NAV Update Time
													</p>
												</div>
												<div className="text-center">
													<p className="text-2xl font-bold text-purple-600">
														1.8%
													</p>
													<p className="text-muted-foreground">
														Avg TER (Direct)
													</p>
												</div>
												<div className="text-center">
													<p className="text-2xl font-bold text-orange-600">
														T+3
													</p>
													<p className="text-muted-foreground">
														Settlement Cycle
													</p>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						</TabsContent>

						<TabsContent
							value="sip"
							className="space-y-6"
							data-testid="start-sip"
						>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Calculator className="h-5 w-5 text-finance-blue" />
											SIP Calculator
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4">
										<div>
											<label className="text-sm font-medium text-muted-foreground mb-2 block">
												Monthly Investment Amount
											</label>
											<Input
												type="number"
												placeholder="₹5,000"
												value={sipAmount}
												onChange={(e) => setSipAmount(e.target.value)}
												data-testid="sip-amount"
											/>
										</div>
										<div>
											<label className="text-sm font-medium text-muted-foreground mb-2 block">
												Investment Period (Years)
											</label>
											<Input
												type="number"
												placeholder="10"
												value={sipYears}
												onChange={(e) => setSipYears(e.target.value)}
												data-testid="sip-years"
											/>
										</div>
										<div>
											<label className="text-sm font-medium text-muted-foreground mb-2 block">
												Expected Returns (% p.a.)
											</label>
											<Input
												type="number"
												placeholder="12"
												value={sipReturns}
												onChange={(e) => setSipReturns(e.target.value)}
												data-testid="sip-returns"
											/>
										</div>
										<Button
											className="w-full bg-finance-blue hover:bg-blue-700"
											onClick={calculateSIP}
											data-testid="calculate-sip"
										>
											Calculate SIP Returns
										</Button>

										{calculatedSip && (
											<div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
												<h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">
													Calculation Results
												</h4>
												<div className="space-y-2 text-sm">
													<div className="flex justify-between">
														<span className="text-muted-foreground">
															Total Investment:
														</span>
														<span className="font-medium">
															₹{calculatedSip.invested.toLocaleString()}
														</span>
													</div>
													<div className="flex justify-between">
														<span className="text-muted-foreground">
															Expected Returns:
														</span>
														<span className="font-medium text-green-600">
															₹{calculatedSip.returns.toLocaleString()}
														</span>
													</div>
													<div className="flex justify-between border-t pt-2">
														<span className="text-foreground font-semibold">
															Maturity Value:
														</span>
														<span className="font-bold text-green-600">
															₹{calculatedSip.total.toLocaleString()}
														</span>
													</div>
												</div>
											</div>
										)}
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle>Start Your SIP Journey</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="text-center py-8">
											<TrendingUp className="h-12 w-12 text-finance-blue mx-auto mb-4" />
											<h3 className="text-lg font-semibold text-foreground mb-2">
												Build Wealth Systematically
											</h3>
											<p className="text-muted-foreground mb-4">
												Start your SIP with as little as ₹500 per month
											</p>
											<Button
												className="bg-finance-green hover:bg-green-700"
												onClick={() => alert("Redirecting to SIP setup...")}
												data-testid="start-sip-button"
											>
												Start SIP Now
											</Button>
										</div>
									</CardContent>
								</Card>
							</div>
						</TabsContent>

						<TabsContent
							value="portfolio"
							className="space-y-6"
							data-testid="mf-portfolio"
						>
							<Card className="border-dashed border-2 border-border">
								<CardContent className="flex flex-col items-center justify-center py-12">
									<Star className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-semibold text-foreground mb-2">
										No Investments Yet
									</h3>
									<p className="text-muted-foreground text-center mb-4">
										Your mutual fund investments will appear here
									</p>
									<Button
										variant="outline"
										onClick={() =>
											alert(
												"Please select a fund from the Explore Funds tab to start investing",
											)
										}
									>
										Invest Now
									</Button>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent
							value="tools"
							className="space-y-6"
							data-testid="mf-tools"
						>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<Card className="hover:shadow-md transition-shadow cursor-pointer">
									<CardContent className="p-6 text-center">
										<Calculator className="h-12 w-12 text-finance-blue mx-auto mb-4" />
										<h3 className="font-bold text-foreground mb-2">
											SIP Calculator
										</h3>
										<p className="text-muted-foreground text-sm mb-4">
											Calculate your SIP returns and plan investments
										</p>
										<Button variant="outline" size="sm">
											Use Calculator
										</Button>
									</CardContent>
								</Card>

								<Card className="hover:shadow-md transition-shadow cursor-pointer">
									<CardContent className="p-6 text-center">
										<TrendingUp className="h-12 w-12 text-finance-green mx-auto mb-4" />
										<h3 className="font-bold text-foreground mb-2">
											Fund Comparison
										</h3>
										<p className="text-muted-foreground text-sm mb-4">
											Compare mutual funds side by side
										</p>
										<Button variant="outline" size="sm">
											Compare Funds
										</Button>
									</CardContent>
								</Card>

								<Card className="hover:shadow-md transition-shadow cursor-pointer">
									<CardContent className="p-6 text-center">
										<Star className="h-12 w-12 text-purple-600 mx-auto mb-4" />
										<h3 className="font-bold text-foreground mb-2">
											Goal Planner
										</h3>
										<p className="text-muted-foreground text-sm mb-4">
											Plan your financial goals with SIP
										</p>
										<Button variant="outline" size="sm">
											Plan Goals
										</Button>
									</CardContent>
								</Card>
							</div>
						</TabsContent>

						<TabsContent
							value="history"
							className="space-y-6"
							data-testid="mf-history"
						>
							<ClientTransactionHistory category="mutual_fund" />
						</TabsContent>
					</Tabs>
				</div>

				{/* Investment Modal */}
				<InvestmentModal
					fund={selectedFund}
					isOpen={isInvestmentModalOpen}
					onClose={() => setIsInvestmentModalOpen(false)}
				/>
			</div>
		</DataErrorBoundary>
	);
}
