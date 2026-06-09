import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	IndianRupee,
	TrendingUp,
	Building2,
	Users,
	FileText,
	Filter,
	RefreshCw,
	CheckCircle,
	Clock,
	AlertTriangle,
	Download,
	Calculator,
	Wallet,
	PiggyBank,
	Upload,
	XCircle,
	Link2,
	BarChart3,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

interface CommissionEntry {
	id: string;
	applicationId: string;
	providerId: string;
	productId: string;
	loanAmount: string;
	disbursementDate: string | null;
	commissionableBase: string;
	commissionRate: string;
	grossCommission: string;
	tdsRate: string;
	tdsAmount: string;
	gstRate: string;
	gstAmount: string;
	netCommission: string;
	fintekProAmount: string;
	partnerAmount: string;
	agentAmount: string;
	partnerId: string | null;
	agentId: string | null;
	status: string;
	invoiceNumber: string | null;
	paymentDueDate: string | null;
	createdAt: string;
}

interface CommissionSummary {
	totalGrossCommission: number;
	totalNetCommission: number;
	totalTds: number;
	totalGst: number;
	totalFintekProShare: number;
	totalPartnerShare: number;
	totalAgentShare: number;
	pendingCount: number;
	approvedCount: number;
	paidCount: number;
	byProvider: Record<string, { count: number; amount: number }>;
	byProduct: Record<string, { count: number; amount: number }>;
}

interface CommissionRate {
	productType: string;
	minRate: number;
	maxRate: number;
	defaultRate: number;
	tdsRate: number;
	gstRate: number;
	fintekProShare: number;
	partnerShare: number;
	agentShare: number;
}

export default function CommissionLedgerPage() {
	const { toast } = useToast();
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [providerFilter, setProviderFilter] = useState<string>("all");
	const [calcAmount, setCalcAmount] = useState<string>("500000");
	const [calcProduct, setCalcProduct] = useState<string>("personal");

	const {
		data: ledger,
		isLoading: ledgerLoading,
		refetch: refetchLedger,
	} = useQuery<{ data: CommissionEntry[] }>({
		queryKey: ["/api/loan-commission/ledger", statusFilter, providerFilter],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (statusFilter !== "all") params.append("status", statusFilter);
			if (providerFilter !== "all") params.append("providerId", providerFilter);
			const res = await fetch(
				`/api/loan-commission/ledger?${params.toString()}`,
			);
			return res.json();
		},
	});

	const { data: summary, isLoading: summaryLoading } = useQuery<{
		data: CommissionSummary;
	}>({
		queryKey: ["/api/loan-commission/ledger/summary"],
	});

	const { data: rates } = useQuery<{ data: CommissionRate[] }>({
		queryKey: ["/api/loan-commission/rates"],
	});

	const { data: calculatedCommission, refetch: calculateCommission } = useQuery(
		{
			queryKey: ["/api/loan-commission/calculate", calcAmount, calcProduct],
			queryFn: async () => {
				const res = await fetch("/api/loan-commission/calculate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						loanAmount: calcAmount,
						productType: calcProduct,
					}),
				});
				return res.json();
			},
			enabled: false,
		},
	);

	const updateStatusMutation = useMutation({
		mutationFn: async ({ id, status }: { id: string; status: string }) => {
			return apiRequest(`/api/loan-commission/ledger/${id}/status`, {
				method: "PATCH",
				body: JSON.stringify({ status }),
			});
		},
		onSuccess: () => {
			toast({
				title: "Status Updated",
				description: "Commission status has been updated",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/loan-commission/ledger"],
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to update status",
				variant: "destructive",
			});
		},
	});

	const formatCurrency = (value: string | number) => {
		const num = typeof value === "string" ? Number.parseFloat(value) : value;
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(num);
	};

	const getStatusBadge = (status: string) => {
		const variants: Record<
			string,
			{
				variant: "default" | "secondary" | "destructive" | "outline";
				icon: any;
			}
		> = {
			pending: { variant: "secondary", icon: Clock },
			approved: { variant: "default", icon: CheckCircle },
			invoiced: { variant: "outline", icon: FileText },
			paid: { variant: "default", icon: CheckCircle },
			disputed: { variant: "destructive", icon: AlertTriangle },
		};
		const config = variants[status] || { variant: "outline", icon: Clock };
		const Icon = config.icon;
		return (
			<Badge variant={config.variant} className="gap-1">
				<Icon className="h-3 w-3" />
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</Badge>
		);
	};

	const summaryData = summary?.data;

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold">Commission Ledger</h1>
					<p className="text-muted-foreground">
						Track and manage DSA loan commissions
					</p>
				</div>
				<Button
					onClick={() => refetchLedger()}
					variant="outline"
					className="gap-2"
				>
					<RefreshCw className="h-4 w-4" />
					Refresh
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">
									Total Gross Commission
								</p>
								<p className="text-2xl font-bold">
									{summaryLoading ? (
										<Skeleton className="h-8 w-24" />
									) : (
										formatCurrency(summaryData?.totalGrossCommission || 0)
									)}
								</p>
							</div>
							<div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
								<IndianRupee className="h-6 w-6 text-green-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Net Commission</p>
								<p className="text-2xl font-bold">
									{summaryLoading ? (
										<Skeleton className="h-8 w-24" />
									) : (
										formatCurrency(summaryData?.totalNetCommission || 0)
									)}
								</p>
							</div>
							<div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
								<TrendingUp className="h-6 w-6 text-blue-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">FintekPro Share</p>
								<p className="text-2xl font-bold">
									{summaryLoading ? (
										<Skeleton className="h-8 w-24" />
									) : (
										formatCurrency(summaryData?.totalFintekProShare || 0)
									)}
								</p>
							</div>
							<div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
								<PiggyBank className="h-6 w-6 text-purple-600" />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Pending Payouts</p>
								<p className="text-2xl font-bold">
									{summaryLoading ? (
										<Skeleton className="h-8 w-24" />
									) : (
										summaryData?.pendingCount || 0
									)}
								</p>
							</div>
							<div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
								<Clock className="h-6 w-6 text-yellow-600" />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="ledger" className="space-y-4">
				<TabsList>
					<TabsTrigger value="ledger">Commission Ledger</TabsTrigger>
					<TabsTrigger value="rates">Commission Rates</TabsTrigger>
					<TabsTrigger value="calculator">Calculator</TabsTrigger>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
					<TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
				</TabsList>

				<TabsContent value="ledger" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex justify-between items-center">
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									Commission Entries
								</CardTitle>
								<div className="flex gap-2">
									<Select value={statusFilter} onValueChange={setStatusFilter}>
										<SelectTrigger className="w-[150px]">
											<SelectValue placeholder="Status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Status</SelectItem>
											<SelectItem value="pending">Pending</SelectItem>
											<SelectItem value="approved">Approved</SelectItem>
											<SelectItem value="invoiced">Invoiced</SelectItem>
											<SelectItem value="paid">Paid</SelectItem>
										</SelectContent>
									</Select>
									<Select
										value={providerFilter}
										onValueChange={setProviderFilter}
									>
										<SelectTrigger className="w-[150px]">
											<SelectValue placeholder="Provider" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Providers</SelectItem>
											<SelectItem value="ICICI">ICICI Bank</SelectItem>
											<SelectItem value="HDFC">HDFC Bank</SelectItem>
											<SelectItem value="AXIS">Axis Bank</SelectItem>
											<SelectItem value="KOTAK">Kotak Mahindra</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{ledgerLoading ? (
								<div className="space-y-2">
									{[1, 2, 3].map((i) => (
										<Skeleton key={i} className="h-12 w-full" />
									))}
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Application ID</TableHead>
											<TableHead>Provider</TableHead>
											<TableHead>Product</TableHead>
											<TableHead className="text-right">Loan Amount</TableHead>
											<TableHead className="text-right">
												Commission Rate
											</TableHead>
											<TableHead className="text-right">Gross</TableHead>
											<TableHead className="text-right">Net</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{ledger?.data?.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={9}
													className="text-center py-8 text-muted-foreground"
												>
													No commission entries found
												</TableCell>
											</TableRow>
										) : (
											ledger?.data?.map((entry) => (
												<TableRow key={entry.id}>
													<TableCell className="font-mono text-sm">
														{entry.applicationId}
													</TableCell>
													<TableCell>
														<Badge variant="outline">{entry.providerId}</Badge>
													</TableCell>
													<TableCell className="capitalize">
														{entry.productId}
													</TableCell>
													<TableCell className="text-right font-medium">
														{formatCurrency(entry.loanAmount)}
													</TableCell>
													<TableCell className="text-right">
														{entry.commissionRate}%
													</TableCell>
													<TableCell className="text-right text-green-600">
														{formatCurrency(entry.grossCommission)}
													</TableCell>
													<TableCell className="text-right font-medium">
														{formatCurrency(entry.netCommission)}
													</TableCell>
													<TableCell>{getStatusBadge(entry.status)}</TableCell>
													<TableCell>
														<Dialog>
															<DialogTrigger asChild>
																<Button variant="ghost" size="sm">
																	View
																</Button>
															</DialogTrigger>
															<DialogContent className="max-w-md">
																<DialogHeader>
																	<DialogTitle>Commission Details</DialogTitle>
																</DialogHeader>
																<div className="space-y-4">
																	<div className="grid grid-cols-2 gap-4 text-sm">
																		<div>
																			<p className="text-muted-foreground">
																				Loan Amount
																			</p>
																			<p className="font-medium">
																				{formatCurrency(entry.loanAmount)}
																			</p>
																		</div>
																		<div>
																			<p className="text-muted-foreground">
																				Commission Rate
																			</p>
																			<p className="font-medium">
																				{entry.commissionRate}%
																			</p>
																		</div>
																		<div>
																			<p className="text-muted-foreground">
																				Gross Commission
																			</p>
																			<p className="font-medium text-green-600">
																				{formatCurrency(entry.grossCommission)}
																			</p>
																		</div>
																		<div>
																			<p className="text-muted-foreground">
																				TDS ({entry.tdsRate}%)
																			</p>
																			<p className="font-medium text-red-600">
																				-{formatCurrency(entry.tdsAmount)}
																			</p>
																		</div>
																		<div>
																			<p className="text-muted-foreground">
																				GST ({entry.gstRate}%)
																			</p>
																			<p className="font-medium">
																				{formatCurrency(entry.gstAmount)}
																			</p>
																		</div>
																		<div>
																			<p className="text-muted-foreground">
																				Net Commission
																			</p>
																			<p className="font-medium text-blue-600">
																				{formatCurrency(entry.netCommission)}
																			</p>
																		</div>
																	</div>
																	<hr />
																	<div className="space-y-2">
																		<p className="font-medium">
																			Payout Distribution
																		</p>
																		<div className="grid grid-cols-3 gap-2 text-sm">
																			<div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
																				<p className="text-muted-foreground">
																					FintekPro
																				</p>
																				<p className="font-medium">
																					{formatCurrency(
																						entry.fintekProAmount,
																					)}
																				</p>
																			</div>
																			<div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
																				<p className="text-muted-foreground">
																					Partner
																				</p>
																				<p className="font-medium">
																					{formatCurrency(entry.partnerAmount)}
																				</p>
																			</div>
																			<div className="p-2 bg-green-50 dark:bg-green-950/30 rounded">
																				<p className="text-muted-foreground">
																					Agent
																				</p>
																				<p className="font-medium">
																					{formatCurrency(entry.agentAmount)}
																				</p>
																			</div>
																		</div>
																	</div>
																	{entry.status === "pending" && (
																		<div className="flex gap-2">
																			<Button
																				size="sm"
																				onClick={() =>
																					updateStatusMutation.mutate({
																						id: entry.id,
																						status: "approved",
																					})
																				}
																			>
																				Approve
																			</Button>
																			<Button
																				size="sm"
																				variant="outline"
																				onClick={() =>
																					updateStatusMutation.mutate({
																						id: entry.id,
																						status: "invoiced",
																					})
																				}
																			>
																				Mark Invoiced
																			</Button>
																		</div>
																	)}
																</div>
															</DialogContent>
														</Dialog>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="rates" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5" />
								Product Commission Rates
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Product Type</TableHead>
										<TableHead className="text-right">Min Rate</TableHead>
										<TableHead className="text-right">Max Rate</TableHead>
										<TableHead className="text-right">Default Rate</TableHead>
										<TableHead className="text-right">TDS Rate</TableHead>
										<TableHead className="text-right">FintekPro %</TableHead>
										<TableHead className="text-right">Partner %</TableHead>
										<TableHead className="text-right">Agent %</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rates?.data?.map((rate) => (
										<TableRow key={rate.productType}>
											<TableCell className="font-medium capitalize">
												{rate.productType}
											</TableCell>
											<TableCell className="text-right">
												{rate.minRate}%
											</TableCell>
											<TableCell className="text-right">
												{rate.maxRate}%
											</TableCell>
											<TableCell className="text-right font-medium text-green-600">
												{rate.defaultRate}%
											</TableCell>
											<TableCell className="text-right">
												{rate.tdsRate}%
											</TableCell>
											<TableCell className="text-right">
												{rate.fintekProShare}%
											</TableCell>
											<TableCell className="text-right">
												{rate.partnerShare}%
											</TableCell>
											<TableCell className="text-right">
												{rate.agentShare}%
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="calculator" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Calculator className="h-5 w-5" />
								Commission Calculator
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="space-y-4">
									<div>
										<label className="text-sm font-medium">Loan Amount</label>
										<Input
											type="number"
											value={calcAmount}
											onChange={(e) => setCalcAmount(e.target.value)}
											placeholder="500000"
										/>
									</div>
									<div>
										<label className="text-sm font-medium">Product Type</label>
										<Select value={calcProduct} onValueChange={setCalcProduct}>
											<SelectTrigger>
												<SelectValue placeholder="Select product" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="personal">Personal Loan</SelectItem>
												<SelectItem value="business">Business Loan</SelectItem>
												<SelectItem value="home">Home Loan</SelectItem>
												<SelectItem value="lap">
													Loan Against Property
												</SelectItem>
												<SelectItem value="car">Car Loan</SelectItem>
												<SelectItem value="securities">
													Loan Against Securities
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<Button
										onClick={() => calculateCommission()}
										className="w-full"
									>
										Calculate Commission
									</Button>
								</div>

								{calculatedCommission?.data && (
									<div className="bg-muted p-4 rounded-lg space-y-3">
										<h3 className="font-semibold">Commission Breakdown</h3>
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div>
												<p className="text-muted-foreground">Loan Amount</p>
												<p className="font-medium">
													{formatCurrency(
														calculatedCommission.data.breakdown.loanAmount,
													)}
												</p>
											</div>
											<div>
												<p className="text-muted-foreground">Rate Applied</p>
												<p className="font-medium">
													{calculatedCommission.data.commissionRate}%
												</p>
											</div>
											<div>
												<p className="text-muted-foreground">
													Gross Commission
												</p>
												<p className="font-medium text-green-600">
													{formatCurrency(
														calculatedCommission.data.grossCommission,
													)}
												</p>
											</div>
											<div>
												<p className="text-muted-foreground">TDS Deduction</p>
												<p className="font-medium text-red-600">
													-{formatCurrency(calculatedCommission.data.tdsAmount)}
												</p>
											</div>
											<div>
												<p className="text-muted-foreground">Net Commission</p>
												<p className="font-medium text-blue-600">
													{formatCurrency(
														calculatedCommission.data.netCommission,
													)}
												</p>
											</div>
										</div>
										<hr />
										<div className="grid grid-cols-3 gap-2">
											<div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded text-center">
												<p className="text-xs text-muted-foreground">
													FintekPro
												</p>
												<p className="font-bold">
													{formatCurrency(
														calculatedCommission.data.fintekProAmount,
													)}
												</p>
											</div>
											<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-center">
												<p className="text-xs text-muted-foreground">Partner</p>
												<p className="font-bold">
													{formatCurrency(
														calculatedCommission.data.partnerAmount,
													)}
												</p>
											</div>
											<div className="p-2 bg-green-100 dark:bg-green-900/30 rounded text-center">
												<p className="text-xs text-muted-foreground">Agent</p>
												<p className="font-bold">
													{formatCurrency(
														calculatedCommission.data.agentAmount,
													)}
												</p>
											</div>
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="analytics" className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Building2 className="h-5 w-5" />
									By Provider
								</CardTitle>
							</CardHeader>
							<CardContent>
								{summaryData?.byProvider &&
								Object.keys(summaryData.byProvider).length > 0 ? (
									<div className="space-y-3">
										{Object.entries(summaryData.byProvider).map(
											([provider, data]) => (
												<div
													key={provider}
													className="flex justify-between items-center p-3 bg-muted rounded"
												>
													<div>
														<p className="font-medium">{provider}</p>
														<p className="text-sm text-muted-foreground">
															{data.count} loans
														</p>
													</div>
													<p className="font-bold text-green-600">
														{formatCurrency(data.amount)}
													</p>
												</div>
											),
										)}
									</div>
								) : (
									<p className="text-muted-foreground text-center py-4">
										No data available
									</p>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Wallet className="h-5 w-5" />
									By Product
								</CardTitle>
							</CardHeader>
							<CardContent>
								{summaryData?.byProduct &&
								Object.keys(summaryData.byProduct).length > 0 ? (
									<div className="space-y-3">
										{Object.entries(summaryData.byProduct).map(
											([product, data]) => (
												<div
													key={product}
													className="flex justify-between items-center p-3 bg-muted rounded"
												>
													<div>
														<p className="font-medium capitalize">{product}</p>
														<p className="text-sm text-muted-foreground">
															{data.count} loans
														</p>
													</div>
													<p className="font-bold text-green-600">
														{formatCurrency(data.amount)}
													</p>
												</div>
											),
										)}
									</div>
								) : (
									<p className="text-muted-foreground text-center py-4">
										No data available
									</p>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="reconciliation" className="space-y-4">
					<ReconciliationTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}

function ReconciliationTab() {
	const { toast } = useToast();
	const [csvData, setCsvData] = useState<string>("");
	const [isUploading, setIsUploading] = useState(false);

	const { data: reconciliationSummary, isLoading: summaryLoading } = useQuery<{
		data: any;
	}>({
		queryKey: ["/api/commission-reconciliation/summary"],
	});

	const { data: kpis } = useQuery<{ data: any }>({
		queryKey: ["/api/commission-reconciliation/kpis"],
	});

	const { data: unmatchedPayments } = useQuery<{ data: any[] }>({
		queryKey: ["/api/commission-reconciliation/payments/unmatched"],
	});

	const { data: disputedPayments } = useQuery<{ data: any[] }>({
		queryKey: ["/api/commission-reconciliation/payments/disputed"],
	});

	const { data: overdueCommissions } = useQuery<{ data: any[] }>({
		queryKey: ["/api/commission-reconciliation/overdue"],
	});

	const summary = reconciliationSummary?.data || {};
	const kpiData = kpis?.data || {};

	const handleUpload = async () => {
		if (!csvData.trim()) {
			toast({ title: "Please paste CSV data", variant: "destructive" });
			return;
		}

		setIsUploading(true);
		try {
			const lines = csvData.trim().split("\n");
			const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
			const rows = lines
				.slice(1)
				.map((line) => {
					const values = line.split(",");
					const row: any = {};
					headers.forEach((h, i) => {
						if (h.includes("amount") || h.includes("commission")) {
							row.commissionAmount = Number.parseFloat(
								values[i]?.replace(/[^\d.-]/g, "") || "0",
							);
						} else if (h.includes("date")) {
							row.paymentDate = values[i]?.trim() || new Date().toISOString();
						} else if (h.includes("utr")) {
							row.utrNumber = values[i]?.trim();
						} else if (h.includes("application") || h.includes("loan_id")) {
							row.applicationId = values[i]?.trim();
						}
					});
					return row;
				})
				.filter((r) => r.commissionAmount > 0);

			const response = await apiRequest(
				"/api/commission-reconciliation/upload-statement",
				{
					method: "POST",
					body: JSON.stringify({
						rows,
						sourceType: "bank",
						paidBy: "bank",
						fileName: `manual_upload_${Date.now()}.csv`,
					}),
				},
			);

			toast({
				title: "Upload Complete",
				description: `Processed ${response.data?.totalProcessed || 0} rows, ${response.data?.matched || 0} matched`,
			});
			setCsvData("");
			queryClient.invalidateQueries({
				queryKey: ["/api/commission-reconciliation"],
			});
		} catch (error: any) {
			toast({
				title: "Upload failed",
				description: error.message,
				variant: "destructive",
			});
		} finally {
			setIsUploading(false);
		}
	};

	const formatCurrency = (value: number) => {
		if (!value) return "₹0";
		if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`;
		if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`;
		if (value >= 1000) return `₹${(value / 1000).toFixed(0)} K`;
		return `₹${value.toFixed(0)}`;
	};

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Expected</p>
								<p className="text-xl font-bold">
									{formatCurrency(summary.totalExpected || 0)}
								</p>
							</div>
							<IndianRupee className="h-8 w-8 text-blue-500" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Received</p>
								<p className="text-xl font-bold text-green-600">
									{formatCurrency(summary.totalReceived || 0)}
								</p>
							</div>
							<CheckCircle className="h-8 w-8 text-green-500" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Pending</p>
								<p className="text-xl font-bold text-yellow-600">
									{summary.pendingReconciliation || 0}
								</p>
							</div>
							<Clock className="h-8 w-8 text-yellow-500" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Disputed</p>
								<p className="text-xl font-bold text-red-600">
									{summary.disputedCount || 0}
								</p>
							</div>
							<XCircle className="h-8 w-8 text-red-500" />
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Upload className="h-5 w-5" />
							Upload Payment Statement
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label>
								Paste CSV Data (columns: application_id, amount, date, utr)
							</Label>
							<Textarea
								placeholder="application_id,amount,date,utr&#10;APP001,25000,2026-01-15,UTR12345&#10;APP002,18500,2026-01-16,UTR12346"
								value={csvData}
								onChange={(e) => setCsvData(e.target.value)}
								rows={6}
								className="font-mono text-sm"
							/>
						</div>
						<Button onClick={handleUpload} disabled={isUploading}>
							{isUploading ? "Processing..." : "Process Statement"}
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5" />
							KPIs
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex justify-between items-center">
							<span className="text-sm text-muted-foreground">
								Avg Days to Payment
							</span>
							<Badge variant="outline">
								{kpiData.avgDaysToPayment || 0} days
							</Badge>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-sm text-muted-foreground">
								Avg Commission/Loan
							</span>
							<Badge variant="outline">
								{formatCurrency(kpiData.avgCommissionPerLoan || 0)}
							</Badge>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-sm text-muted-foreground">
								Dispute Rate
							</span>
							<Badge
								variant={kpiData.disputeRate > 5 ? "destructive" : "secondary"}
							>
								{kpiData.disputeRate || 0}%
							</Badge>
						</div>
						<div className="flex justify-between items-center">
							<span className="text-sm text-muted-foreground">Match Rate</span>
							<Badge variant="default">
								{summary.totalCommissions > 0
									? Math.round(
											(summary.matchedCount / summary.totalCommissions) * 100,
										)
									: 0}
								%
							</Badge>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-yellow-600">
							<Clock className="h-5 w-5" />
							Overdue Payments ({overdueCommissions?.data?.length || 0})
						</CardTitle>
					</CardHeader>
					<CardContent>
						{overdueCommissions?.data?.length === 0 ? (
							<p className="text-muted-foreground text-center py-4">
								No overdue payments
							</p>
						) : (
							<div className="space-y-2 max-h-60 overflow-y-auto">
								{overdueCommissions?.data?.slice(0, 10).map((item: any) => (
									<div
										key={item.id}
										className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded"
									>
										<div>
											<p className="font-mono text-sm">{item.applicationId}</p>
											<p className="text-xs text-muted-foreground">
												{new Date(item.createdAt).toLocaleDateString()}
											</p>
										</div>
										<Badge variant="outline">
											{formatCurrency(
												Number.parseFloat(item.netCommission) || 0,
											)}
										</Badge>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-red-600">
							<AlertTriangle className="h-5 w-5" />
							Disputed Payments ({disputedPayments?.data?.length || 0})
						</CardTitle>
					</CardHeader>
					<CardContent>
						{disputedPayments?.data?.length === 0 ? (
							<p className="text-muted-foreground text-center py-4">
								No disputed payments
							</p>
						) : (
							<div className="space-y-2 max-h-60 overflow-y-auto">
								{disputedPayments?.data?.slice(0, 10).map((item: any) => (
									<div
										key={item.id}
										className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-950/20 rounded"
									>
										<div>
											<p className="font-mono text-sm">
												{item.applicationId || item.id.slice(0, 8)}
											</p>
											<p className="text-xs text-muted-foreground">
												{item.disputeReason || "Variance exceeded tolerance"}
											</p>
										</div>
										<div className="text-right">
											<Badge variant="destructive">
												{formatCurrency(
													Number.parseFloat(item.matchVariance) || 0,
												)}
											</Badge>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Link2 className="h-5 w-5" />
						Unmatched Payments ({unmatchedPayments?.data?.length || 0})
					</CardTitle>
				</CardHeader>
				<CardContent>
					{unmatchedPayments?.data?.length === 0 ? (
						<p className="text-muted-foreground text-center py-4">
							No unmatched payments
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Payment ID</TableHead>
									<TableHead>Amount</TableHead>
									<TableHead>Date</TableHead>
									<TableHead>UTR</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{unmatchedPayments?.data?.slice(0, 10).map((payment: any) => (
									<TableRow key={payment.id}>
										<TableCell className="font-mono text-sm">
											{payment.id.slice(0, 8)}
										</TableCell>
										<TableCell>
											{formatCurrency(
												Number.parseFloat(payment.paidAmount) || 0,
											)}
										</TableCell>
										<TableCell>
											{payment.paymentDate
												? new Date(payment.paymentDate).toLocaleDateString()
												: "-"}
										</TableCell>
										<TableCell>{payment.utrNumber || "-"}</TableCell>
										<TableCell>
											<Badge variant="secondary">{payment.matchStatus}</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
