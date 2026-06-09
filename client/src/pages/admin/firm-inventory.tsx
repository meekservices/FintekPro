import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Building2,
	TrendingUp,
	TrendingDown,
	RefreshCw,
	Plus,
	IndianRupee,
	Package,
	ArrowUpRight,
	ArrowDownRight,
	CheckCircle,
	AlertCircle,
	Clock,
	ExternalLink,
	RotateCcw,
} from "lucide-react";

interface Holding {
	id: number;
	securityName: string;
	isin?: string;
	securityType: string;
	quantity: string;
	avgCostPrice?: string;
	currentPrice?: string;
	totalCostValue?: string;
	currentMarketValue?: string;
	zohoItemId?: string;
	updatedAt?: string;
}

interface FirmTransaction {
	id: number;
	transactionType: string;
	securityName: string;
	isin?: string;
	quantity: string;
	pricePerShare?: string;
	totalValue: string;
	charges?: string;
	netValue: string;
	transactionDate: string;
	counterpartyName?: string;
	reference?: string;
	notes?: string;
	zohoStatus: string;
	zohoInvoiceId?: string;
	zohoBillId?: string;
	zohoSyncedAt?: string;
	createdAt?: string;
}

interface Balance {
	totalReceivables: number;
	totalPayables: number;
	netPosition: number;
	lastRefreshed: string;
}

const TXN_TYPES = [
	{ value: "buy", label: "Buy (Acquire Inventory)" },
	{ value: "sell", label: "Sell (Dispose Inventory)" },
	{ value: "transfer_in", label: "Transfer In" },
	{ value: "transfer_out", label: "Transfer Out" },
	{ value: "dividend", label: "Dividend Received" },
	{ value: "fee", label: "Fee / Charge" },
	{ value: "adjustment", label: "Adjustment" },
];

function zohoStatusBadge(status: string) {
	if (status === "synced")
		return (
			<Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
				<CheckCircle className="h-3 w-3" />
				Synced
			</Badge>
		);
	if (status === "pending")
		return (
			<Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 gap-1">
				<Clock className="h-3 w-3" />
				Pending
			</Badge>
		);
	if (status === "failed")
		return (
			<Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 gap-1">
				<AlertCircle className="h-3 w-3" />
				Failed
			</Badge>
		);
	return <Badge variant="secondary">{status}</Badge>;
}

function txnTypeBadge(type: string) {
	const isBuy = ["buy", "transfer_in", "dividend"].includes(type);
	return (
		<Badge
			className={
				isBuy
					? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 gap-1"
					: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 gap-1"
			}
		>
			{isBuy ? (
				<ArrowDownRight className="h-3 w-3" />
			) : (
				<ArrowUpRight className="h-3 w-3" />
			)}
			{type.replace("_", " ").toUpperCase()}
		</Badge>
	);
}

function fmt(val?: string | number, decimals = 2) {
	const n = Number.parseFloat(String(val ?? "0"));
	return Number.isNaN(n)
		? "—"
		: `₹${n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtQty(val?: string | number) {
	const n = Number.parseFloat(String(val ?? "0"));
	return Number.isNaN(n)
		? "—"
		: n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

const DEFAULT_FORM = {
	transactionType: "buy",
	securityName: "",
	isin: "",
	quantity: "",
	pricePerShare: "",
	totalValue: "",
	charges: "",
	transactionDate: new Date().toISOString().split("T")[0],
	counterpartyName: "",
	reference: "",
	notes: "",
};

export default function AdminFirmInventory() {
	const { toast } = useToast();
	const [addDialog, setAddDialog] = useState(false);
	const [form, setForm] = useState({ ...DEFAULT_FORM });
	const [page, setPage] = useState(1);

	const {
		data: holdingsData,
		isLoading: holdingsLoading,
		refetch: refetchHoldings,
	} = useQuery<{
		holdings: Holding[];
		summary: {
			count: number;
			totalCostValue: number;
			totalMarketValue: number;
		};
	}>({
		queryKey: ["/api/admin/firm-inventory/holdings"],
	});

	const {
		data: txData,
		isLoading: txLoading,
		refetch: refetchTx,
	} = useQuery<{ transactions: FirmTransaction[] }>({
		queryKey: ["/api/admin/firm-inventory/transactions", page],
		queryFn: async () => {
			const res = await fetch(
				`/api/admin/firm-inventory/transactions?page=${page}&limit=50`,
			);
			if (!res.ok) throw new Error("Failed");
			return res.json();
		},
	});

	const {
		data: balance,
		isLoading: balanceLoading,
		refetch: refetchBalance,
	} = useQuery<Balance>({
		queryKey: ["/api/admin/firm-inventory/balance"],
	});

	const addTxMutation = useMutation({
		mutationFn: (data: typeof form) =>
			apiRequest("POST", "/api/admin/firm-inventory/transactions", data),
		onSuccess: () => {
			toast({
				title: "Transaction recorded",
				description: "Zoho Books sync initiated automatically.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/firm-inventory/holdings"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/firm-inventory/transactions"],
			});
			setAddDialog(false);
			setForm({ ...DEFAULT_FORM });
		},
		onError: (e: any) =>
			toast({
				title: "Failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const syncMutation = useMutation({
		mutationFn: () => apiRequest("POST", "/api/admin/firm-inventory/sync", {}),
		onSuccess: (data: any) => {
			toast({
				title: "Sync complete",
				description: `Retried ${data.retried} | Succeeded ${data.succeeded} | Failed ${data.failed}`,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/firm-inventory/transactions"],
			});
		},
		onError: (e: any) =>
			toast({
				title: "Sync failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const retryOneTx = useMutation({
		mutationFn: (id: number) =>
			apiRequest(
				"POST",
				`/api/admin/firm-inventory/transactions/${id}/sync`,
				{},
			),
		onSuccess: () => {
			toast({ title: "Sync triggered" });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/firm-inventory/transactions"],
			});
		},
	});

	const holdings = holdingsData?.holdings ?? [];
	const summary = holdingsData?.summary;
	const transactions = txData?.transactions ?? [];

	function handleQtyPriceChange(field: string, val: string) {
		const updated = { ...form, [field]: val };
		if (field === "quantity" || field === "pricePerShare") {
			const q = Number.parseFloat(updated.quantity || "0");
			const p = Number.parseFloat(updated.pricePerShare || "0");
			if (!Number.isNaN(q) && !Number.isNaN(p) && q > 0 && p > 0) {
				updated.totalValue = (q * p).toFixed(2);
			}
		}
		setForm(updated);
	}

	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center justify-between flex-wrap gap-3">
				<div>
					<h1 className="text-2xl font-bold">Firm Inventory — DP Holdings</h1>
					<p className="text-sm text-muted-foreground">
						Fintekpro Financial Services LLP · Zoho Books two-way sync
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							refetchHoldings();
							refetchTx();
							refetchBalance();
						}}
					>
						<RefreshCw className="h-4 w-4 mr-1" />
						Refresh
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => syncMutation.mutate()}
						disabled={syncMutation.isPending}
					>
						<RotateCcw className="h-4 w-4 mr-1" />
						{syncMutation.isPending ? "Syncing…" : "Retry Pending Sync"}
					</Button>
					<Button size="sm" onClick={() => setAddDialog(true)}>
						<Plus className="h-4 w-4 mr-1" />
						Record Transaction
					</Button>
				</div>
			</div>

			{/* ─── Stats ─── */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="pt-4 pb-3">
						<div className="text-xs text-muted-foreground">Securities Held</div>
						<div className="text-2xl font-bold">
							{holdingsLoading ? "…" : summary?.count ?? 0}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 pb-3">
						<div className="text-xs text-muted-foreground">
							Total Cost Value
						</div>
						<div className="text-2xl font-bold">
							{holdingsLoading ? "…" : fmt(summary?.totalCostValue)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 pb-3">
						<div className="text-xs text-muted-foreground flex items-center gap-1">
							<TrendingUp className="h-3 w-3 text-green-600" />
							Zoho Receivables
						</div>
						<div className="text-2xl font-bold text-green-600">
							{balanceLoading ? "…" : fmt(balance?.totalReceivables)}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 pb-3">
						<div className="text-xs text-muted-foreground flex items-center gap-1">
							<TrendingDown className="h-3 w-3 text-red-500" />
							Zoho Payables
						</div>
						<div className="text-2xl font-bold text-red-500">
							{balanceLoading ? "…" : fmt(balance?.totalPayables)}
						</div>
					</CardContent>
				</Card>
			</div>

			{balance && !balanceLoading && (
				<div className="text-xs text-muted-foreground flex items-center gap-1">
					<ExternalLink className="h-3 w-3" />
					Zoho Books net position:{" "}
					<span
						className={
							balance.netPosition >= 0
								? "text-green-600 font-medium"
								: "text-red-500 font-medium"
						}
					>
						{fmt(balance.netPosition)}
					</span>
					<span className="ml-1">
						· Last refreshed{" "}
						{new Date(balance.lastRefreshed).toLocaleTimeString()}
					</span>
				</div>
			)}

			<Tabs defaultValue="holdings">
				<ScrollableTabsList>
					<TabsTrigger value="holdings">
						<Package className="h-4 w-4 mr-1" />
						DP Holdings ({holdings.length})
					</TabsTrigger>
					<TabsTrigger value="transactions">
						<IndianRupee className="h-4 w-4 mr-1" />
						Transactions ({transactions.length})
					</TabsTrigger>
				</ScrollableTabsList>

				{/* ─── Holdings ─── */}
				<TabsContent value="holdings" className="mt-4">
					<Card>
						<CardContent className="p-0">
							{holdingsLoading ? (
								<div className="p-4 space-y-3">
									{[1, 2, 3].map((i) => (
										<Skeleton key={i} className="h-12 w-full" />
									))}
								</div>
							) : holdings.length === 0 ? (
								<div className="py-16 text-center text-muted-foreground">
									<Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
									<p className="font-medium">No DP holdings yet</p>
									<p className="text-sm mt-1">
										Record a Buy or Transfer In transaction to add inventory
									</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Security</TableHead>
											<TableHead className="text-right">Quantity</TableHead>
											<TableHead className="text-right">Avg Cost</TableHead>
											<TableHead className="text-right">
												Total Cost Value
											</TableHead>
											<TableHead>Zoho Item</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{holdings.map((h) => (
											<TableRow key={h.id}>
												<TableCell>
													<div className="font-medium">{h.securityName}</div>
													{h.isin && (
														<div className="text-xs text-muted-foreground">
															ISIN: {h.isin}
														</div>
													)}
													<div className="text-xs text-muted-foreground">
														{h.securityType.replace("_", " ")}
													</div>
												</TableCell>
												<TableCell className="text-right font-mono">
													{fmtQty(h.quantity)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{fmt(h.avgCostPrice)}
												</TableCell>
												<TableCell className="text-right font-mono">
													{fmt(h.totalCostValue)}
												</TableCell>
												<TableCell>
													{h.zohoItemId ? (
														<Badge
															variant="outline"
															className="text-xs text-green-700 border-green-400 gap-1"
														>
															<CheckCircle className="h-3 w-3" />
															Linked
														</Badge>
													) : (
														<Badge variant="secondary" className="text-xs">
															Not linked
														</Badge>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* ─── Transactions ─── */}
				<TabsContent value="transactions" className="mt-4">
					<Card>
						<CardContent className="p-0">
							{txLoading ? (
								<div className="p-4 space-y-3">
									{[1, 2, 3, 4].map((i) => (
										<Skeleton key={i} className="h-12 w-full" />
									))}
								</div>
							) : transactions.length === 0 ? (
								<div className="py-16 text-center text-muted-foreground">
									<IndianRupee className="h-10 w-10 mx-auto mb-3 opacity-40" />
									<p className="font-medium">No transactions recorded</p>
									<p className="text-sm mt-1">
										Use "Record Transaction" to log a firm-level buy or sell
									</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Date</TableHead>
											<TableHead>Security</TableHead>
											<TableHead>Type</TableHead>
											<TableHead className="text-right">Qty</TableHead>
											<TableHead className="text-right">Net Value</TableHead>
											<TableHead>Counterparty</TableHead>
											<TableHead>Zoho Sync</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{transactions.map((tx) => (
											<TableRow key={tx.id}>
												<TableCell className="text-sm">
													{tx.transactionDate}
												</TableCell>
												<TableCell>
													<div className="font-medium text-sm">
														{tx.securityName}
													</div>
													{tx.reference && (
														<div className="text-xs text-muted-foreground">
															Ref: {tx.reference}
														</div>
													)}
												</TableCell>
												<TableCell>
													{txnTypeBadge(tx.transactionType)}
												</TableCell>
												<TableCell className="text-right font-mono text-sm">
													{fmtQty(tx.quantity)}
												</TableCell>
												<TableCell className="text-right font-mono text-sm">
													{fmt(tx.netValue)}
												</TableCell>
												<TableCell className="text-sm">
													{tx.counterpartyName || "—"}
												</TableCell>
												<TableCell>
													<div>{zohoStatusBadge(tx.zohoStatus)}</div>
													{tx.zohoInvoiceId && (
														<div className="text-xs text-muted-foreground mt-0.5">
															INV: {tx.zohoInvoiceId.slice(0, 12)}…
														</div>
													)}
													{tx.zohoBillId && (
														<div className="text-xs text-muted-foreground mt-0.5">
															BILL: {tx.zohoBillId.slice(0, 12)}…
														</div>
													)}
												</TableCell>
												<TableCell className="text-right">
													{(tx.zohoStatus === "pending" ||
														tx.zohoStatus === "failed") && (
														<Button
															size="icon"
															variant="ghost"
															title="Retry Zoho sync"
															onClick={() => retryOneTx.mutate(tx.id)}
														>
															<RotateCcw className="h-3.5 w-3.5" />
														</Button>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
					{transactions.length >= 50 && (
						<div className="flex justify-center gap-2 mt-4">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
							>
								Previous
							</Button>
							<span className="self-center text-sm text-muted-foreground">
								Page {page}
							</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPage((p) => p + 1)}
							>
								Next
							</Button>
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* ─── Add Transaction Dialog ─── */}
			<Dialog open={addDialog} onOpenChange={setAddDialog}>
				<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Record Firm Transaction</DialogTitle>
						<p className="text-sm text-muted-foreground">
							This will update the DP inventory and auto-sync to Zoho Books
						</p>
					</DialogHeader>
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="col-span-2">
								<Label>Transaction Type</Label>
								<Select
									value={form.transactionType}
									onValueChange={(v) =>
										setForm((f) => ({ ...f, transactionType: v }))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{TXN_TYPES.map((t) => (
											<SelectItem key={t.value} value={t.value}>
												{t.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="col-span-2">
								<Label>Security Name *</Label>
								<Input
									placeholder="e.g. Groww Financial Services Ltd"
									value={form.securityName}
									onChange={(e) =>
										setForm((f) => ({ ...f, securityName: e.target.value }))
									}
								/>
							</div>
							<div>
								<Label>ISIN</Label>
								<Input
									placeholder="INE…"
									value={form.isin}
									onChange={(e) =>
										setForm((f) => ({ ...f, isin: e.target.value }))
									}
								/>
							</div>
							<div>
								<Label>Date *</Label>
								<Input
									type="date"
									value={form.transactionDate}
									onChange={(e) =>
										setForm((f) => ({ ...f, transactionDate: e.target.value }))
									}
								/>
							</div>
							<div>
								<Label>Quantity *</Label>
								<Input
									type="number"
									placeholder="0"
									value={form.quantity}
									onChange={(e) =>
										handleQtyPriceChange("quantity", e.target.value)
									}
								/>
							</div>
							<div>
								<Label>Price per Share (₹)</Label>
								<Input
									type="number"
									placeholder="0.00"
									value={form.pricePerShare}
									onChange={(e) =>
										handleQtyPriceChange("pricePerShare", e.target.value)
									}
								/>
							</div>
							<div>
								<Label>Total Value (₹) *</Label>
								<Input
									type="number"
									placeholder="0.00"
									value={form.totalValue}
									onChange={(e) =>
										setForm((f) => ({ ...f, totalValue: e.target.value }))
									}
								/>
							</div>
							<div>
								<Label>Charges / STT (₹)</Label>
								<Input
									type="number"
									placeholder="0.00"
									value={form.charges}
									onChange={(e) =>
										setForm((f) => ({ ...f, charges: e.target.value }))
									}
								/>
							</div>
							<div className="col-span-2">
								<Label>Counterparty Name</Label>
								<Input
									placeholder="Buyer / Seller name"
									value={form.counterpartyName}
									onChange={(e) =>
										setForm((f) => ({ ...f, counterpartyName: e.target.value }))
									}
								/>
							</div>
							<div className="col-span-2">
								<Label>Reference No.</Label>
								<Input
									placeholder="Cheque / NEFT / Contract note"
									value={form.reference}
									onChange={(e) =>
										setForm((f) => ({ ...f, reference: e.target.value }))
									}
								/>
							</div>
							<div className="col-span-2">
								<Label>Notes</Label>
								<Textarea
									placeholder="Optional remarks"
									rows={2}
									value={form.notes}
									onChange={(e) =>
										setForm((f) => ({ ...f, notes: e.target.value }))
									}
								/>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAddDialog(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => addTxMutation.mutate(form)}
							disabled={
								addTxMutation.isPending ||
								!form.securityName ||
								!form.quantity ||
								!form.totalValue ||
								!form.transactionDate
							}
						>
							{addTxMutation.isPending ? "Recording…" : "Record & Sync to Zoho"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
