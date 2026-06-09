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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	BookOpen,
	FileText,
	Receipt,
	Users,
	Building2,
	TrendingUp,
	TrendingDown,
	IndianRupee,
	AlertCircle,
	CheckCircle,
	Clock,
	RefreshCw,
	ExternalLink,
	ChevronRight,
	Banknote,
	CreditCard,
	ArrowUpDown,
	Loader2,
	Briefcase,
	TrendingDown as Stocks,
	Landmark,
	Building,
} from "lucide-react";
import { format } from "date-fns";

interface ZohoConnectionStatus {
	connected: boolean;
	organization?: {
		name: string;
		currency_code: string;
		time_zone: string;
	};
	message: string;
}

interface DashboardSummary {
	totalReceivables: number;
	totalPayables: number;
	overdueReceivables: number;
	overduePayables: number;
	totalInvoices: number;
	totalBills: number;
	totalCustomers: number;
	totalVendors: number;
}

interface Invoice {
	invoice_id: string;
	invoice_number: string;
	customer_name: string;
	status: string;
	date: string;
	due_date: string;
	total: number;
	balance: number;
	currency_code: string;
}

interface Bill {
	bill_id: string;
	bill_number: string;
	vendor_name: string;
	status: string;
	date: string;
	due_date: string;
	total: number;
	balance: number;
	currency_code: string;
}

interface Contact {
	contact_id: string;
	contact_name: string;
	company_name: string;
	contact_type: string;
	status: string;
	email: string;
	outstanding_receivable_amount?: number;
	outstanding_payable_amount?: number;
}

interface SyncStatus {
	configured: boolean;
	pendingSync: {
		mutualFunds: number;
		bonds: number;
		ipos: number;
		unlisted: number;
		total: number;
	};
	lastSyncedAt?: string;
}

interface SyncResult {
	success: boolean;
	message: string;
	totalProcessed: number;
	successCount: number;
	failedCount: number;
	results: Array<{
		success: boolean;
		productType: string;
		transactionId: string;
		zohoInvoiceId?: string;
		zohoBillId?: string;
		error?: string;
	}>;
}

const statusColors: Record<string, string> = {
	paid: "bg-emerald-500/20 text-emerald-400",
	sent: "bg-blue-500/20 text-blue-400",
	overdue: "bg-red-500/20 text-red-400",
	draft: "bg-muted/20 text-muted-foreground",
	open: "bg-yellow-500/20 text-yellow-400",
	partially_paid: "bg-orange-500/20 text-orange-400",
	void: "bg-muted/20 text-muted-foreground",
	unpaid: "bg-amber-500/20 text-amber-400",
};

export default function ZohoBooksPage() {
	const [activeTab, setActiveTab] = useState("overview");
	const [invoiceFilter, setInvoiceFilter] = useState("all");
	const [billFilter, setBillFilter] = useState("all");
	const [contactType, setContactType] = useState("customer");
	const { toast } = useToast();

	const {
		data: connectionStatus,
		isLoading: statusLoading,
		refetch: refetchStatus,
	} = useQuery<ZohoConnectionStatus>({
		queryKey: ["/api/admin/zoho-books/status"],
		refetchInterval: 60000,
	});

	const {
		data: syncStatus,
		isLoading: syncStatusLoading,
		refetch: refetchSyncStatus,
	} = useQuery<SyncStatus>({
		queryKey: ["/api/admin/zoho-books/sync/status"],
		enabled: connectionStatus?.connected === true,
		refetchInterval: 30000,
	});

	const syncAllMutation = useMutation({
		mutationFn: async (productTypes?: string[]) => {
			const response = await apiRequest(
				"POST",
				"/api/admin/zoho-books/sync/all",
				{
					productTypes,
					limit: 50,
				},
			);
			return response.json();
		},
		onSuccess: (data: SyncResult) => {
			toast({
				title: data.success ? "Sync Complete" : "Sync Completed with Errors",
				description: data.message,
				variant: data.failedCount > 0 ? "destructive" : "default",
			});
			refetchSyncStatus();
			queryClient.invalidateQueries({ queryKey: ["/api/admin/zoho-books"] });
		},
		onError: (error: Error) => {
			toast({
				title: "Sync Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const {
		data: dashboard,
		isLoading: dashboardLoading,
		refetch: refetchDashboard,
	} = useQuery<DashboardSummary>({
		queryKey: ["/api/admin/zoho-books/dashboard"],
		enabled: connectionStatus?.connected === true,
		refetchInterval: 300000,
	});

	const { data: invoicesData, isLoading: invoicesLoading } = useQuery<{
		items: Invoice[];
	}>({
		queryKey: [
			"/api/admin/zoho-books/invoices",
			{ status: invoiceFilter !== "all" ? invoiceFilter : undefined },
		],
		enabled: connectionStatus?.connected === true && activeTab === "invoices",
	});

	const { data: billsData, isLoading: billsLoading } = useQuery<{
		items: Bill[];
	}>({
		queryKey: [
			"/api/admin/zoho-books/bills",
			{ status: billFilter !== "all" ? billFilter : undefined },
		],
		enabled: connectionStatus?.connected === true && activeTab === "bills",
	});

	const { data: contactsData, isLoading: contactsLoading } = useQuery<{
		items: Contact[];
	}>({
		queryKey: ["/api/admin/zoho-books/contacts", { contact_type: contactType }],
		enabled: connectionStatus?.connected === true && activeTab === "contacts",
	});

	const formatCurrency = (amount: number, currency: string = "INR") => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	if (statusLoading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-8 w-64" />
				<div className="grid grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-32" />
					))}
				</div>
			</div>
		);
	}

	if (!connectionStatus?.connected) {
		return (
			<div className="space-y-6">
				<div>
					<h1
						className="text-2xl font-bold flex items-center gap-2"
						data-testid="text-zohobooks-title"
					>
						<BookOpen className="h-6 w-6 text-blue-500" />
						Zoho Books
					</h1>
					<p className="text-sm text-muted-foreground">
						Accounting and financial management
					</p>
				</div>

				<Card className="border-yellow-500/30 bg-yellow-500/5">
					<CardContent className="pt-6">
						<div className="flex items-start gap-4">
							<AlertCircle className="h-8 w-8 text-yellow-500 flex-shrink-0" />
							<div>
								<h3 className="font-semibold text-lg">
									Zoho Books Not Connected
								</h3>
								<p className="text-sm text-muted-foreground mt-1">
									{connectionStatus?.message ||
										"Please configure your Zoho Books credentials to access accounting features."}
								</p>
								<div className="mt-4 p-4 bg-background rounded-lg border">
									<p className="text-sm font-medium mb-2">
										Required Environment Variables:
									</p>
									<ul className="text-xs text-muted-foreground space-y-1">
										<li>• ZOHO_CLIENT_ID - Your Zoho OAuth client ID</li>
										<li>
											• ZOHO_CLIENT_SECRET - Your Zoho OAuth client secret
										</li>
										<li>• ZOHO_REFRESH_TOKEN - OAuth refresh token</li>
										<li>• ZOHO_ZSOID - Your Zoho Books Organization ID</li>
									</ul>
								</div>
								<Button
									variant="outline"
									className="mt-4"
									onClick={() => refetchStatus()}
								>
									<RefreshCw className="h-4 w-4 mr-2" />
									Retry Connection
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1
						className="text-2xl font-bold flex items-center gap-2"
						data-testid="text-zohobooks-title"
					>
						<BookOpen className="h-6 w-6 text-blue-500" />
						Zoho Books
					</h1>
					<p className="text-sm text-muted-foreground">
						Connected to {connectionStatus.organization?.name || "Organization"}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge
						variant="outline"
						className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
					>
						<CheckCircle className="h-3 w-3 mr-1" />
						Connected
					</Badge>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							refetchStatus();
							refetchDashboard();
						}}
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Sync
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-4 gap-4">
				<Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground">Receivables</p>
								<div className="text-2xl font-bold text-emerald-400">
									{dashboardLoading ? (
										<Skeleton className="h-8 w-24" />
									) : (
										formatCurrency(dashboard?.totalReceivables || 0)
									)}
								</div>
								{dashboard?.overdueReceivables ? (
									<p className="text-xs text-red-400 mt-1">
										{formatCurrency(dashboard.overdueReceivables)} overdue
									</p>
								) : null}
							</div>
							<TrendingUp className="h-8 w-8 text-emerald-400 opacity-50" />
						</div>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground">Payables</p>
								<div className="text-2xl font-bold text-red-400">
									{dashboardLoading ? (
										<Skeleton className="h-8 w-24" />
									) : (
										formatCurrency(dashboard?.totalPayables || 0)
									)}
								</div>
								{dashboard?.overduePayables ? (
									<p className="text-xs text-orange-400 mt-1">
										{formatCurrency(dashboard.overduePayables)} overdue
									</p>
								) : null}
							</div>
							<TrendingDown className="h-8 w-8 text-red-400 opacity-50" />
						</div>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground">Invoices</p>
								<div className="text-2xl font-bold text-blue-400">
									{dashboardLoading ? (
										<Skeleton className="h-8 w-16" />
									) : (
										dashboard?.totalInvoices || 0
									)}
								</div>
								<p className="text-xs text-muted-foreground mt-1">
									Total count
								</p>
							</div>
							<FileText className="h-8 w-8 text-blue-400 opacity-50" />
						</div>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground">Customers</p>
								<div className="text-2xl font-bold text-purple-400">
									{dashboardLoading ? (
										<Skeleton className="h-8 w-16" />
									) : (
										dashboard?.totalCustomers || 0
									)}
								</div>
								<p className="text-xs text-muted-foreground mt-1">
									{dashboard?.totalVendors || 0} vendors
								</p>
							</div>
							<Users className="h-8 w-8 text-purple-400 opacity-50" />
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="pb-2">
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList>
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="sync" className="relative">
								Transaction Sync
								{syncStatus?.pendingSync?.total ? (
									<Badge className="ml-2 h-5 px-1.5 bg-orange-500 text-white text-xs">
										{syncStatus.pendingSync.total}
									</Badge>
								) : null}
							</TabsTrigger>
							<TabsTrigger value="invoices">Invoices</TabsTrigger>
							<TabsTrigger value="bills">Bills</TabsTrigger>
							<TabsTrigger value="contacts">Contacts</TabsTrigger>
						</TabsList>
					</Tabs>
				</CardHeader>
				<CardContent>
					{activeTab === "sync" && (
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-lg font-semibold">
										Transaction Synchronization
									</h3>
									<p className="text-sm text-muted-foreground">
										Sync completed orders to Zoho Books as invoices (inflows) or
										bills (outflows)
									</p>
								</div>
								<Button
									onClick={() => syncAllMutation.mutate(undefined)}
									disabled={
										syncAllMutation.isPending || !syncStatus?.pendingSync?.total
									}
									data-testid="button-sync-all"
								>
									{syncAllMutation.isPending ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<ArrowUpDown className="h-4 w-4 mr-2" />
									)}
									Sync All Pending
								</Button>
							</div>

							{syncStatusLoading ? (
								<div className="grid grid-cols-4 gap-4">
									{[1, 2, 3, 4].map((i) => (
										<Skeleton key={i} className="h-32" />
									))}
								</div>
							) : (
								<div className="grid grid-cols-4 gap-4">
									<Card className="border-blue-500/30">
										<CardContent className="pt-4">
											<div className="flex items-center justify-between">
												<div>
													<p className="text-xs text-muted-foreground">
														Mutual Funds
													</p>
													<p className="text-2xl font-bold text-blue-400">
														{syncStatus?.pendingSync?.mutualFunds || 0}
													</p>
													<p className="text-xs text-muted-foreground mt-1">
														pending sync
													</p>
												</div>
												<Briefcase className="h-8 w-8 text-blue-400 opacity-50" />
											</div>
											<Button
												variant="outline"
												size="sm"
												className="w-full mt-3"
												disabled={
													syncAllMutation.isPending ||
													!syncStatus?.pendingSync?.mutualFunds
												}
												onClick={() => syncAllMutation.mutate(["mutual_fund"])}
												data-testid="button-sync-mf"
											>
												Sync MF Orders
											</Button>
										</CardContent>
									</Card>

									<Card className="border-green-500/30">
										<CardContent className="pt-4">
											<div className="flex items-center justify-between">
												<div>
													<p className="text-xs text-muted-foreground">Bonds</p>
													<p className="text-2xl font-bold text-green-400">
														{syncStatus?.pendingSync?.bonds || 0}
													</p>
													<p className="text-xs text-muted-foreground mt-1">
														pending sync
													</p>
												</div>
												<Landmark className="h-8 w-8 text-green-400 opacity-50" />
											</div>
											<Button
												variant="outline"
												size="sm"
												className="w-full mt-3"
												disabled={
													syncAllMutation.isPending ||
													!syncStatus?.pendingSync?.bonds
												}
												onClick={() => syncAllMutation.mutate(["bond"])}
												data-testid="button-sync-bonds"
											>
												Sync Bond Orders
											</Button>
										</CardContent>
									</Card>

									<Card className="border-purple-500/30">
										<CardContent className="pt-4">
											<div className="flex items-center justify-between">
												<div>
													<p className="text-xs text-muted-foreground">IPO</p>
													<p className="text-2xl font-bold text-purple-400">
														{syncStatus?.pendingSync?.ipos || 0}
													</p>
													<p className="text-xs text-muted-foreground mt-1">
														pending sync
													</p>
												</div>
												<Receipt className="h-8 w-8 text-purple-400 opacity-50" />
											</div>
											<Button
												variant="outline"
												size="sm"
												className="w-full mt-3"
												disabled={
													syncAllMutation.isPending ||
													!syncStatus?.pendingSync?.ipos
												}
												onClick={() => syncAllMutation.mutate(["ipo"])}
												data-testid="button-sync-ipo"
											>
												Sync IPO Applications
											</Button>
										</CardContent>
									</Card>

									<Card className="border-orange-500/30">
										<CardContent className="pt-4">
											<div className="flex items-center justify-between">
												<div>
													<p className="text-xs text-muted-foreground">
														Unlisted
													</p>
													<p className="text-2xl font-bold text-orange-400">
														{syncStatus?.pendingSync?.unlisted || 0}
													</p>
													<p className="text-xs text-muted-foreground mt-1">
														pending sync
													</p>
												</div>
												<Building className="h-8 w-8 text-orange-400 opacity-50" />
											</div>
											<Button
												variant="outline"
												size="sm"
												className="w-full mt-3"
												disabled={
													syncAllMutation.isPending ||
													!syncStatus?.pendingSync?.unlisted
												}
												onClick={() => syncAllMutation.mutate(["unlisted"])}
												data-testid="button-sync-unlisted"
											>
												Sync Unlisted Deals
											</Button>
										</CardContent>
									</Card>
								</div>
							)}

							<Card className="border-amber-500/30 bg-amber-500/5">
								<CardHeader>
									<CardTitle className="text-base flex items-center gap-2">
										<AlertCircle className="h-4 w-4 text-amber-500" />
										SEBI/RBI Regulatory Compliance
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 gap-6">
										<div className="space-y-3">
											<div className="flex items-center gap-2 text-blue-400">
												<ArrowUpDown className="h-5 w-5" />
												<span className="font-medium">
													Pass-Through (Compliance Only)
												</span>
											</div>
											<p className="text-xs text-muted-foreground ml-7 mb-2">
												Money flows directly to AMC/Issuer - no invoices created
											</p>
											<ul className="text-sm text-muted-foreground space-y-1 ml-7">
												<li>• MF/SIP orders (via BSE/NSE to AMC)</li>
												<li>• AIF/PMS investments (to fund manager)</li>
												<li>• IPO applications (ASBA to issuer)</li>
												<li>• Bond principal (via exchange clearing)</li>
											</ul>
										</div>
										<div className="space-y-3">
											<div className="flex items-center gap-2 text-emerald-400">
												<TrendingUp className="h-5 w-5" />
												<span className="font-medium">Invoiceable Revenue</span>
											</div>
											<p className="text-xs text-muted-foreground ml-7 mb-2">
												FintekPro earns fees/commissions - invoices created
											</p>
											<ul className="text-sm text-muted-foreground space-y-1 ml-7">
												<li>• Distributor commissions from AMC</li>
												<li>• Bond brokerage fees</li>
												<li>• Unlisted escrow transactions</li>
												<li>• Advisory/facilitation fees</li>
											</ul>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					)}

					{activeTab === "overview" && (
						<div className="grid grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle className="text-base flex items-center gap-2">
										<Receipt className="h-4 w-4 text-emerald-500" />
										Recent Invoices
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ScrollArea className="h-[200px]">
										{invoicesLoading ? (
											<div className="space-y-2">
												{[1, 2, 3].map((i) => (
													<Skeleton key={i} className="h-12" />
												))}
											</div>
										) : (
											<div className="space-y-2">
												{(invoicesData?.items || [])
													.slice(0, 5)
													.map((invoice) => (
														<div
															key={invoice.invoice_id}
															className="flex items-center justify-between p-2 rounded-lg border"
														>
															<div>
																<p className="text-sm font-medium">
																	{invoice.invoice_number}
																</p>
																<p className="text-xs text-muted-foreground">
																	{invoice.customer_name}
																</p>
															</div>
															<div className="text-right">
																<p className="text-sm font-medium">
																	{formatCurrency(
																		invoice.total,
																		invoice.currency_code,
																	)}
																</p>
																<Badge
																	className={`text-xs ${statusColors[invoice.status] || statusColors.draft}`}
																>
																	{invoice.status}
																</Badge>
															</div>
														</div>
													))}
												{(!invoicesData?.items ||
													invoicesData.items.length === 0) && (
													<p className="text-center text-muted-foreground py-4">
														No invoices found
													</p>
												)}
											</div>
										)}
									</ScrollArea>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-base flex items-center gap-2">
										<Banknote className="h-4 w-4 text-red-500" />
										Recent Bills
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ScrollArea className="h-[200px]">
										{billsLoading ? (
											<div className="space-y-2">
												{[1, 2, 3].map((i) => (
													<Skeleton key={i} className="h-12" />
												))}
											</div>
										) : (
											<div className="space-y-2">
												{(billsData?.items || []).slice(0, 5).map((bill) => (
													<div
														key={bill.bill_id}
														className="flex items-center justify-between p-2 rounded-lg border"
													>
														<div>
															<p className="text-sm font-medium">
																{bill.bill_number}
															</p>
															<p className="text-xs text-muted-foreground">
																{bill.vendor_name}
															</p>
														</div>
														<div className="text-right">
															<p className="text-sm font-medium">
																{formatCurrency(bill.total, bill.currency_code)}
															</p>
															<Badge
																className={`text-xs ${statusColors[bill.status] || statusColors.draft}`}
															>
																{bill.status}
															</Badge>
														</div>
													</div>
												))}
												{(!billsData?.items ||
													billsData.items.length === 0) && (
													<p className="text-center text-muted-foreground py-4">
														No bills found
													</p>
												)}
											</div>
										)}
									</ScrollArea>
								</CardContent>
							</Card>
						</div>
					)}

					{activeTab === "invoices" && (
						<div className="space-y-4">
							<div className="flex items-center gap-4">
								<Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
									<SelectTrigger className="w-48">
										<SelectValue placeholder="Filter by status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Invoices</SelectItem>
										<SelectItem value="sent">Sent</SelectItem>
										<SelectItem value="paid">Paid</SelectItem>
										<SelectItem value="overdue">Overdue</SelectItem>
										<SelectItem value="unpaid">Unpaid</SelectItem>
										<SelectItem value="draft">Draft</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<ScrollArea className="h-[400px]">
								{invoicesLoading ? (
									<div className="space-y-2">
										{[1, 2, 3, 4, 5].map((i) => (
											<Skeleton key={i} className="h-16" />
										))}
									</div>
								) : (
									<div className="space-y-2">
										{(invoicesData?.items || []).map((invoice) => (
											<div
												key={invoice.invoice_id}
												className="flex items-center justify-between p-4 rounded-lg border hover:border-emerald-500/30 transition-colors"
											>
												<div className="flex items-center gap-4">
													<div className="p-2 rounded-lg bg-blue-500/20">
														<FileText className="h-5 w-5 text-blue-400" />
													</div>
													<div>
														<p className="font-medium">
															{invoice.invoice_number}
														</p>
														<p className="text-sm text-muted-foreground">
															{invoice.customer_name}
														</p>
														<p className="text-xs text-muted-foreground mt-1">
															<Clock className="h-3 w-3 inline mr-1" />
															Due:{" "}
															{format(
																new Date(invoice.due_date),
																"MMM d, yyyy",
															)}
														</p>
													</div>
												</div>
												<div className="text-right">
													<p className="text-lg font-bold">
														{formatCurrency(
															invoice.total,
															invoice.currency_code,
														)}
													</p>
													{invoice.balance > 0 &&
														invoice.balance < invoice.total && (
															<p className="text-xs text-muted-foreground">
																Balance:{" "}
																{formatCurrency(
																	invoice.balance,
																	invoice.currency_code,
																)}
															</p>
														)}
													<Badge
														className={`text-xs ${statusColors[invoice.status] || statusColors.draft}`}
													>
														{invoice.status}
													</Badge>
												</div>
											</div>
										))}
										{(!invoicesData?.items ||
											invoicesData.items.length === 0) && (
											<p className="text-center text-muted-foreground py-8">
												No invoices found
											</p>
										)}
									</div>
								)}
							</ScrollArea>
						</div>
					)}

					{activeTab === "bills" && (
						<div className="space-y-4">
							<div className="flex items-center gap-4">
								<Select value={billFilter} onValueChange={setBillFilter}>
									<SelectTrigger className="w-48">
										<SelectValue placeholder="Filter by status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Bills</SelectItem>
										<SelectItem value="open">Open</SelectItem>
										<SelectItem value="paid">Paid</SelectItem>
										<SelectItem value="overdue">Overdue</SelectItem>
										<SelectItem value="draft">Draft</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<ScrollArea className="h-[400px]">
								{billsLoading ? (
									<div className="space-y-2">
										{[1, 2, 3, 4, 5].map((i) => (
											<Skeleton key={i} className="h-16" />
										))}
									</div>
								) : (
									<div className="space-y-2">
										{(billsData?.items || []).map((bill) => (
											<div
												key={bill.bill_id}
												className="flex items-center justify-between p-4 rounded-lg border hover:border-red-500/30 transition-colors"
											>
												<div className="flex items-center gap-4">
													<div className="p-2 rounded-lg bg-red-500/20">
														<Banknote className="h-5 w-5 text-red-400" />
													</div>
													<div>
														<p className="font-medium">{bill.bill_number}</p>
														<p className="text-sm text-muted-foreground">
															{bill.vendor_name}
														</p>
														<p className="text-xs text-muted-foreground mt-1">
															<Clock className="h-3 w-3 inline mr-1" />
															Due:{" "}
															{format(new Date(bill.due_date), "MMM d, yyyy")}
														</p>
													</div>
												</div>
												<div className="text-right">
													<p className="text-lg font-bold">
														{formatCurrency(bill.total, bill.currency_code)}
													</p>
													{bill.balance > 0 && bill.balance < bill.total && (
														<p className="text-xs text-muted-foreground">
															Balance:{" "}
															{formatCurrency(bill.balance, bill.currency_code)}
														</p>
													)}
													<Badge
														className={`text-xs ${statusColors[bill.status] || statusColors.draft}`}
													>
														{bill.status}
													</Badge>
												</div>
											</div>
										))}
										{(!billsData?.items || billsData.items.length === 0) && (
											<p className="text-center text-muted-foreground py-8">
												No bills found
											</p>
										)}
									</div>
								)}
							</ScrollArea>
						</div>
					)}

					{activeTab === "contacts" && (
						<div className="space-y-4">
							<div className="flex items-center gap-4">
								<Select value={contactType} onValueChange={setContactType}>
									<SelectTrigger className="w-48">
										<SelectValue placeholder="Contact type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="customer">Customers</SelectItem>
										<SelectItem value="vendor">Vendors</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<ScrollArea className="h-[400px]">
								{contactsLoading ? (
									<div className="space-y-2">
										{[1, 2, 3, 4, 5].map((i) => (
											<Skeleton key={i} className="h-16" />
										))}
									</div>
								) : (
									<div className="space-y-2">
										{(contactsData?.items || []).map((contact) => (
											<div
												key={contact.contact_id}
												className="flex items-center justify-between p-4 rounded-lg border hover:border-purple-500/30 transition-colors"
											>
												<div className="flex items-center gap-4">
													<div className="p-2 rounded-lg bg-purple-500/20">
														{contactType === "customer" ? (
															<Users className="h-5 w-5 text-purple-400" />
														) : (
															<Building2 className="h-5 w-5 text-purple-400" />
														)}
													</div>
													<div>
														<p className="font-medium">
															{contact.contact_name}
														</p>
														{contact.company_name && (
															<p className="text-sm text-muted-foreground">
																{contact.company_name}
															</p>
														)}
														{contact.email && (
															<p className="text-xs text-muted-foreground">
																{contact.email}
															</p>
														)}
													</div>
												</div>
												<div className="text-right">
													{contactType === "customer" &&
													contact.outstanding_receivable_amount ? (
														<div>
															<p className="text-sm text-muted-foreground">
																Outstanding
															</p>
															<p className="text-lg font-bold text-emerald-400">
																{formatCurrency(
																	contact.outstanding_receivable_amount,
																)}
															</p>
														</div>
													) : contactType === "vendor" &&
														contact.outstanding_payable_amount ? (
														<div>
															<p className="text-sm text-muted-foreground">
																Payable
															</p>
															<p className="text-lg font-bold text-red-400">
																{formatCurrency(
																	contact.outstanding_payable_amount,
																)}
															</p>
														</div>
													) : (
														<Badge variant="outline" className="capitalize">
															{contact.status}
														</Badge>
													)}
												</div>
											</div>
										))}
										{(!contactsData?.items ||
											contactsData.items.length === 0) && (
											<p className="text-center text-muted-foreground py-8">
												No{" "}
												{contactType === "customer" ? "customers" : "vendors"}{" "}
												found
											</p>
										)}
									</div>
								)}
							</ScrollArea>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
