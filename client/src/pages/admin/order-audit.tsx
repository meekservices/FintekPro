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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
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
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/LoadingState";
import { Link } from "wouter";
import { format } from "date-fns";
import {
	Search,
	Package,
	ShoppingCart,
	RefreshCw,
	Loader2,
	Building2,
	Coins,
	FileText,
	Landmark,
	TrendingUp,
	Bot,
	Users,
	User,
	ArrowLeft,
	Clock,
	CheckCircle,
	ClipboardList,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import type {
	UnifiedCartItem,
	ProductCategory,
	CartItemStatus,
	CartItemSource,
} from "@shared/schema";

interface OrderAuditFilters {
	category: "all" | ProductCategory;
	status: "all" | CartItemStatus;
	source: "all" | CartItemSource;
}

const categoryLabels: Record<ProductCategory | "all", string> = {
	all: "All Categories",
	store: "Store Products",
	unlisted: "Unlisted Shares",
	mutual_fund: "Mutual Funds",
	bond: "Bonds",
	ncd: "NCDs",
	ipo: "IPOs",
};

const statusLabels: Record<CartItemStatus | "all", string> = {
	all: "All Statuses",
	active: "Active",
	pending_approval: "Pending Approval",
	ordered: "Ordered",
	removed: "Removed",
};

const sourceLabels: Record<CartItemSource | "all", string> = {
	all: "All Sources",
	client: "Client",
	agent: "Agent",
	ai: "AI",
};

const getCategoryIcon = (cat: ProductCategory) => {
	switch (cat) {
		case "mutual_fund":
			return <Coins className="w-4 h-4" />;
		case "bond":
			return <FileText className="w-4 h-4" />;
		case "ncd":
			return <Landmark className="w-4 h-4" />;
		case "ipo":
			return <TrendingUp className="w-4 h-4" />;
		case "unlisted":
			return <Building2 className="w-4 h-4" />;
		case "store":
			return <Package className="w-4 h-4" />;
		default:
			return <ShoppingCart className="w-4 h-4" />;
	}
};

const getSourceIcon = (source: string) => {
	switch (source) {
		case "ai":
			return <Bot className="w-4 h-4" />;
		case "agent":
			return <Users className="w-4 h-4" />;
		default:
			return <User className="w-4 h-4" />;
	}
};

const getSourceColor = (source: string) => {
	switch (source) {
		case "ai":
			return "bg-purple-900/30 text-purple-400 border-purple-700";
		case "agent":
			return "bg-blue-900/30 text-blue-400 border-blue-700";
		default:
			return "bg-green-900/30 text-green-400 border-green-700";
	}
};

const getStatusColor = (status: string) => {
	switch (status) {
		case "active":
			return "bg-green-900/30 text-green-400 border-green-700";
		case "pending_approval":
			return "bg-yellow-900/30 text-yellow-400 border-yellow-700";
		case "removed":
			return "bg-red-900/30 text-red-400 border-red-700";
		default:
			return "bg-card/30 text-muted-foreground border-border";
	}
};

const getCategoryColor = (cat: ProductCategory) => {
	switch (cat) {
		case "mutual_fund":
			return "bg-blue-900/30 text-blue-400 border-blue-700";
		case "bond":
			return "bg-green-900/30 text-green-400 border-green-700";
		case "ncd":
			return "bg-purple-900/30 text-purple-400 border-purple-700";
		case "ipo":
			return "bg-orange-900/30 text-orange-400 border-orange-700";
		case "unlisted":
			return "bg-amber-900/30 text-amber-400 border-amber-700";
		case "store":
			return "bg-muted/50 text-muted-foreground border-border";
		default:
			return "bg-muted/50 text-muted-foreground border-border";
	}
};

const formatCurrency = (value: string | number | null | undefined): string => {
	if (value === null || value === undefined) return "—";
	const num = typeof value === "string" ? Number.parseFloat(value) : value;
	if (Number.isNaN(num)) return "—";
	return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

export default function OrderAuditDashboard() {
	const { user, isLoading: authLoading } = useAuth();
	const [searchQuery, setSearchQuery] = useState("");
	const [activeCategory, setActiveCategory] = useState<"all" | ProductCategory>(
		"all",
	);
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 25;
	const [filters, setFilters] = useState<OrderAuditFilters>({
		category: "all",
		status: "all",
		source: "all",
	});

	const {
		data: ordersResponse,
		isLoading,
		refetch,
	} = useQuery<{
		items: UnifiedCartItem[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}>({
		queryKey: [
			"/api/unified-cart/admin/all",
			filters.source,
			filters.status,
			currentPage,
		],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (filters.source !== "all") params.set("source", filters.source);
			if (filters.status !== "all") params.set("status", filters.status);
			params.set("page", String(currentPage));
			params.set("limit", String(pageSize));
			const res = await fetch(
				`/api/unified-cart/admin/all?${params.toString()}`,
				{
					credentials: "include",
				},
			);
			if (!res.ok) throw new Error("Failed to fetch orders");
			return res.json();
		},
	});

	const orders = ordersResponse?.items || [];
	const totalOrders = ordersResponse?.total || 0;
	const totalPages = ordersResponse?.totalPages || 1;

	if (authLoading) {
		return <LoadingState />;
	}

	if (!user || !user.roles?.includes("admin")) {
		return (
			<div
				className="flex items-center justify-center min-h-screen bg-background"
				data-testid="access-denied-container"
			>
				<Card className="bg-card border-border max-w-md">
					<CardHeader>
						<CardTitle
							className="text-foreground text-center"
							data-testid="text-access-denied"
						>
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

	const filteredOrders = orders.filter((order) => {
		const matchesSearch =
			!searchQuery ||
			order.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
			order.userId?.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesCategory =
			activeCategory === "all" || order.productCategory === activeCategory;
		return matchesSearch && matchesCategory;
	});

	const stats = {
		total: totalOrders,
		active: orders.filter((o) => o.status === "active").length,
		pending: orders.filter((o) => o.status === "pending_approval").length,
		clientSource: orders.filter((o) => o.source === "client").length,
		agentSource: orders.filter((o) => o.source === "agent").length,
		aiSource: orders.filter((o) => o.source === "ai").length,
		totalValue: orders.reduce(
			(sum, o) => sum + (Number.parseFloat(o.amount || "0") || 0),
			0,
		),
	};

	const categories: ("all" | ProductCategory)[] = [
		"all",
		"store",
		"unlisted",
		"mutual_fund",
		"bond",
		"ncd",
		"ipo",
	];

	const handlePrevPage = () => {
		if (currentPage > 1) setCurrentPage((p) => p - 1);
	};

	const handleNextPage = () => {
		if (currentPage < totalPages) setCurrentPage((p) => p + 1);
	};

	return (
		<div className="space-y-6 p-6" data-testid="order-audit-dashboard">
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-4">
					<Link href="/admin/dashboard">
						<Button variant="ghost" size="sm" data-testid="button-back-admin">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Dashboard
						</Button>
					</Link>
					<div>
						<h1
							className="text-3xl font-bold text-foreground flex items-center gap-3"
							data-testid="text-page-title"
						>
							<ClipboardList className="h-8 w-8" />
							Order Audit Dashboard
						</h1>
						<p
							className="text-muted-foreground mt-1"
							data-testid="text-page-subtitle"
						>
							Read-only view of all unified cart orders across users
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					onClick={() => refetch()}
					className="border-border"
					data-testid="button-refresh-orders"
				>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
				<Card
					className="bg-muted/50 border-border"
					data-testid="card-stat-total"
				>
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<ShoppingCart className="h-6 w-6 text-primary" />
							<div>
								<p
									className="text-2xl font-bold text-foreground"
									data-testid="text-stat-total"
								>
									{stats.total}
								</p>
								<p className="text-xs text-muted-foreground">Total Orders</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card
					className="bg-muted/50 border-border"
					data-testid="card-stat-active"
				>
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<CheckCircle className="h-6 w-6 text-green-400" />
							<div>
								<p
									className="text-2xl font-bold text-foreground"
									data-testid="text-stat-active"
								>
									{stats.active}
								</p>
								<p className="text-xs text-muted-foreground">Active</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card
					className="bg-muted/50 border-border"
					data-testid="card-stat-pending"
				>
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<Clock className="h-6 w-6 text-yellow-400" />
							<div>
								<p
									className="text-2xl font-bold text-foreground"
									data-testid="text-stat-pending"
								>
									{stats.pending}
								</p>
								<p className="text-xs text-muted-foreground">Pending</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card
					className="bg-muted/50 border-border"
					data-testid="card-stat-client"
				>
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<User className="h-6 w-6 text-green-400" />
							<div>
								<p
									className="text-2xl font-bold text-foreground"
									data-testid="text-stat-client"
								>
									{stats.clientSource}
								</p>
								<p className="text-xs text-muted-foreground">Client</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card
					className="bg-muted/50 border-border"
					data-testid="card-stat-agent"
				>
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<Users className="h-6 w-6 text-blue-400" />
							<div>
								<p
									className="text-2xl font-bold text-foreground"
									data-testid="text-stat-agent"
								>
									{stats.agentSource}
								</p>
								<p className="text-xs text-muted-foreground">Agent</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="bg-muted/50 border-border" data-testid="card-stat-ai">
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<Bot className="h-6 w-6 text-purple-400" />
							<div>
								<p
									className="text-2xl font-bold text-foreground"
									data-testid="text-stat-ai"
								>
									{stats.aiSource}
								</p>
								<p className="text-xs text-muted-foreground">AI</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card
					className="bg-muted/50 border-border"
					data-testid="card-stat-value"
				>
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<TrendingUp className="h-6 w-6 text-emerald-400" />
							<div>
								<p
									className="text-lg font-bold text-foreground"
									data-testid="text-stat-value"
								>
									{formatCurrency(stats.totalValue)}
								</p>
								<p className="text-xs text-muted-foreground">Page Value</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card className="bg-card border-border">
				<CardHeader>
					<div className="flex flex-col md:flex-row gap-4 justify-between">
						<div className="flex gap-2 flex-wrap">
							<div className="relative flex-1 min-w-[200px]">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search by name, ID, or user..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9 bg-muted border-border text-foreground"
									data-testid="input-search-audit"
								/>
							</div>
							<Select
								value={filters.source}
								onValueChange={(val) => {
									setFilters((f) => ({ ...f, source: val as any }));
									setCurrentPage(1);
								}}
							>
								<SelectTrigger
									className="w-[130px] bg-muted border-border"
									data-testid="select-source-filter"
								>
									<SelectValue placeholder="Source" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all" data-testid="option-source-all">
										All Sources
									</SelectItem>
									<SelectItem value="client" data-testid="option-source-client">
										Client
									</SelectItem>
									<SelectItem value="agent" data-testid="option-source-agent">
										Agent
									</SelectItem>
									<SelectItem value="ai" data-testid="option-source-ai">
										AI
									</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={filters.status}
								onValueChange={(val) => {
									setFilters((f) => ({ ...f, status: val as any }));
									setCurrentPage(1);
								}}
							>
								<SelectTrigger
									className="w-[150px] bg-muted border-border"
									data-testid="select-status-filter"
								>
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all" data-testid="option-status-all">
										All Statuses
									</SelectItem>
									<SelectItem value="active" data-testid="option-status-active">
										Active
									</SelectItem>
									<SelectItem
										value="pending_approval"
										data-testid="option-status-pending"
									>
										Pending Approval
									</SelectItem>
									<SelectItem
										value="removed"
										data-testid="option-status-removed"
									>
										Removed
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Tabs
						value={activeCategory}
						onValueChange={(val) => setActiveCategory(val as any)}
					>
						<ScrollableTabsList>
							{categories.map((cat) => (
								<TabsTrigger
									key={cat}
									value={cat}
									className="data-[state=active]:bg-muted"
									data-testid={`tab-category-${cat}`}
								>
									<span className="flex items-center gap-2">
										{cat === "all" ? (
											<ShoppingCart className="w-4 h-4" />
										) : (
											getCategoryIcon(cat as ProductCategory)
										)}
										{categoryLabels[cat]}
										<Badge
											variant="secondary"
											className="ml-1 text-xs"
											data-testid={`badge-count-${cat}`}
										>
											{cat === "all"
												? orders.length
												: orders.filter((o) => o.productCategory === cat)
														.length}
										</Badge>
									</span>
								</TabsTrigger>
							))}
						</ScrollableTabsList>

						<TabsContent value={activeCategory} className="mt-4">
							{isLoading ? (
								<div
									className="flex justify-center py-8"
									data-testid="loading-state"
								>
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : filteredOrders.length === 0 ? (
								<div
									className="text-center py-8 text-muted-foreground"
									data-testid="empty-state"
								>
									<ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
									<p>No orders found</p>
								</div>
							) : (
								<>
									<div className="overflow-x-auto">
										<Table data-testid="table-orders">
											<TableHeader>
												<TableRow className="border-border">
													<TableHead className="text-muted-foreground">
														Order ID
													</TableHead>
													<TableHead className="text-muted-foreground">
														Product
													</TableHead>
													<TableHead className="text-muted-foreground">
														Category
													</TableHead>
													<TableHead className="text-muted-foreground">
														User ID
													</TableHead>
													<TableHead className="text-muted-foreground">
														Source
													</TableHead>
													<TableHead className="text-muted-foreground text-right">
														Amount
													</TableHead>
													<TableHead className="text-muted-foreground text-right">
														Qty
													</TableHead>
													<TableHead className="text-muted-foreground">
														Status
													</TableHead>
													<TableHead className="text-muted-foreground">
														Created
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{filteredOrders.map((order) => (
													<TableRow
														key={order.id}
														className="border-border"
														data-testid={`row-order-${order.id}`}
													>
														<TableCell
															className="font-mono text-xs text-muted-foreground"
															data-testid={`text-order-id-${order.id}`}
														>
															{order.id.substring(0, 8)}...
														</TableCell>
														<TableCell>
															<div className="flex items-center gap-2">
																{getCategoryIcon(
																	order.productCategory as ProductCategory,
																)}
																<span
																	className="text-foreground font-medium truncate max-w-[200px]"
																	data-testid={`text-product-name-${order.id}`}
																>
																	{order.displayName || "Unnamed Product"}
																</span>
															</div>
														</TableCell>
														<TableCell>
															<Badge
																variant="outline"
																className={getCategoryColor(
																	order.productCategory as ProductCategory,
																)}
																data-testid={`badge-category-${order.id}`}
															>
																{categoryLabels[
																	order.productCategory as ProductCategory
																] || order.productCategory}
															</Badge>
														</TableCell>
														<TableCell
															className="font-mono text-xs text-muted-foreground"
															data-testid={`text-user-id-${order.id}`}
														>
															{(order.userId ?? "").substring(0, 8)}...
														</TableCell>
														<TableCell>
															<Badge
																variant="outline"
																className={`flex items-center gap-1 w-fit ${getSourceColor(order.source || "client")}`}
																data-testid={`badge-source-${order.id}`}
															>
																{getSourceIcon(order.source || "client")}
																{
																	sourceLabels[
																		(order.source || "client") as CartItemSource
																	]
																}
															</Badge>
														</TableCell>
														<TableCell
															className="text-right text-green-400 font-medium"
															data-testid={`text-amount-${order.id}`}
														>
															{formatCurrency(order.amount)}
														</TableCell>
														<TableCell
															className="text-right text-foreground"
															data-testid={`text-quantity-${order.id}`}
														>
															{order.quantity || 1}
														</TableCell>
														<TableCell>
															<Badge
																variant="outline"
																className={getStatusColor(
																	order.status || "active",
																)}
																data-testid={`badge-status-${order.id}`}
															>
																{
																	statusLabels[
																		(order.status || "active") as CartItemStatus
																	]
																}
															</Badge>
														</TableCell>
														<TableCell
															className="text-muted-foreground text-sm"
															data-testid={`text-created-${order.id}`}
														>
															{order.createdAt
																? format(
																		new Date(order.createdAt),
																		"MMM d, yyyy HH:mm",
																	)
																: "—"}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>

									<div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
										<p
											className="text-sm text-muted-foreground"
											data-testid="text-pagination-info"
										>
											Showing {(currentPage - 1) * pageSize + 1} -{" "}
											{Math.min(currentPage * pageSize, totalOrders)} of{" "}
											{totalOrders} orders
										</p>
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={handlePrevPage}
												disabled={currentPage <= 1}
												className="border-border"
												data-testid="button-prev-page"
											>
												<ChevronLeft className="h-4 w-4" />
												Previous
											</Button>
											<span
												className="text-sm text-muted-foreground px-2"
												data-testid="text-current-page"
											>
												Page {currentPage} of {totalPages}
											</span>
											<Button
												variant="outline"
												size="sm"
												onClick={handleNextPage}
												disabled={currentPage >= totalPages}
												className="border-border"
												data-testid="button-next-page"
											>
												Next
												<ChevronRight className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			<Card className="bg-card border-border" data-testid="card-source-legend">
				<CardHeader>
					<CardTitle className="text-foreground text-lg">
						Source Tracking Legend
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap gap-4">
						<div
							className="flex items-center gap-2"
							data-testid="legend-client"
						>
							<Badge
								variant="outline"
								className="flex items-center gap-1 bg-green-900/30 text-green-400 border-green-700"
							>
								<User className="w-3 h-3" />
								Client
							</Badge>
							<span className="text-muted-foreground text-sm">
								Orders added directly by the client
							</span>
						</div>
						<div className="flex items-center gap-2" data-testid="legend-agent">
							<Badge
								variant="outline"
								className="flex items-center gap-1 bg-blue-900/30 text-blue-400 border-blue-700"
							>
								<Users className="w-3 h-3" />
								Agent
							</Badge>
							<span className="text-muted-foreground text-sm">
								Orders proposed by agents
							</span>
						</div>
						<div className="flex items-center gap-2" data-testid="legend-ai">
							<Badge
								variant="outline"
								className="flex items-center gap-1 bg-purple-900/30 text-purple-400 border-purple-700"
							>
								<Bot className="w-3 h-3" />
								AI
							</Badge>
							<span className="text-muted-foreground text-sm">
								Orders recommended by AI assistant
							</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
