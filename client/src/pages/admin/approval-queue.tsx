import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import {
	CheckCircle2,
	XCircle,
	Clock,
	AlertCircle,
	FileText,
	User,
	Shield,
	RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types matching /api/master-agent/pending-transactions ────────────────────

interface PendingTransaction {
	id: string;
	initiatedByUserId: string;
	initiatedByRole: "agent" | "partner";
	clientPan: string | null;
	transactionType: string;
	productType: string;
	status: "pending" | "approved" | "rejected" | "executed" | "cancelled";
	approverRole: "parent_agent" | "partner" | "master_agent" | "admin";
	approvalNotes: string | null;
	rejectionReason: string | null;
	irisOrderId: string | null;
	createdAt: string;
	approvedAt: string | null;
	executedAt: string | null;
}

interface DashboardStats {
	pending: number;
	approved: number;
	rejected: number;
	executed: number;
	byApproverRole: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const approverRoleLabel: Record<string, string> = {
	parent_agent: "Parent Agent",
	partner:      "Partner",
	master_agent: "Master Agent",
	admin:        "Admin",
};

const approverRoleColor: Record<string, string> = {
	parent_agent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	partner:      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
	master_agent: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
	admin:        "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
};

function StatusBadge({ status }: { status: string }) {
	const map: Record<string, { label: string; cls: string }> = {
		pending:   { label: "Pending",   cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
		approved:  { label: "Approved",  cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
		rejected:  { label: "Rejected",  cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
		executed:  { label: "Executed",  cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
		cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
	};
	const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-800" };
	return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminApprovalQueue() {
	const { toast } = useToast();
	const [selectedTx, setSelectedTx]     = useState<PendingTransaction | null>(null);
	const [notes, setNotes]               = useState("");
	const [rejectReason, setRejectReason] = useState("");
	const [statusTab, setStatusTab]       = useState("pending");

	// Dashboard stats
	const { data: stats, refetch: refetchStats } = useQuery<DashboardStats>({
		queryKey: ["/api/master-agent/pending-transactions/dashboard"],
	});

	// Paginated transaction list
	const { data: txList, isLoading, refetch: refetchList } = useQuery<{ data: PendingTransaction[]; meta: { total: number } }>({
		queryKey: ["/api/master-agent/pending-transactions", statusTab],
		queryFn: () => apiRequest(`/api/master-agent/pending-transactions?status=${statusTab}&limit=50`),
	});

	const approveMutation = useMutation({
		mutationFn: ({ id, notes }: { id: string; notes: string }) =>
			apiRequest(`/api/master-agent/pending-transactions/${id}/approve`, {
				method: "POST",
				body: JSON.stringify({ notes }),
			}),
		onSuccess: (res: any) => {
			toast({
				title: "Transaction Approved ✅",
				description: res?.data?.irisOrderId
					? `IRIS Order: ${res.data.irisOrderId}`
					: "Approved. Pending IRIS execution.",
			});
			setSelectedTx(null);
			setNotes("");
			refetchStats();
			refetchList();
		},
		onError: (err: any) => {
			toast({ variant: "destructive", title: "Approval Failed", description: err.message });
		},
	});

	const rejectMutation = useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) =>
			apiRequest(`/api/master-agent/pending-transactions/${id}/reject`, {
				method: "POST",
				body: JSON.stringify({ reason }),
			}),
		onSuccess: () => {
			toast({ title: "Transaction Rejected", description: "Returned to initiating agent." });
			setSelectedTx(null);
			setRejectReason("");
			refetchStats();
			refetchList();
		},
		onError: (err: any) => {
			toast({ variant: "destructive", title: "Rejection Failed", description: err.message });
		},
	});

	const rows = txList?.data ?? (Array.isArray(txList) ? txList : []);

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
						<Shield className="w-8 h-8 text-amber-600" />
						EUIN Governance Queue
					</h1>
					<p className="text-muted-foreground mt-1">
						Transactions queued for EUIN-chain approval. Approvers are notified via WhatsApp + Email.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={() => { refetchStats(); refetchList(); }}>
					<RefreshCw className="w-4 h-4 mr-2" /> Refresh
				</Button>
			</div>

			{/* Stats cards */}
			{stats && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{[
						{ label: "Pending",  value: stats.pending,  icon: Clock,       color: "text-yellow-600" },
						{ label: "Approved", value: stats.approved, icon: CheckCircle2, color: "text-green-600" },
						{ label: "Rejected", value: stats.rejected, icon: XCircle,      color: "text-red-600" },
						{ label: "Executed", value: stats.executed, icon: FileText,     color: "text-emerald-600" },
					].map((s) => (
						<Card key={s.label}>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">{s.label}</p>
										<p className="text-2xl font-bold">{s.value}</p>
									</div>
									<s.icon className={`w-8 h-8 ${s.color} opacity-80`} />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Approver Role Breakdown */}
			{stats?.byApproverRole && Object.keys(stats.byApproverRole).length > 0 && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Pending by Approver Type</CardTitle>
						<CardDescription>Where transactions are currently queued in the EUIN chain</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-3">
						{Object.entries(stats.byApproverRole).map(([role, count]) => (
							<div key={role} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${approverRoleColor[role] ?? "bg-gray-100 text-gray-800"}`}>
								<span>{approverRoleLabel[role] ?? role}</span>
								<span className="font-bold">{count}</span>
							</div>
						))}
					</CardContent>
				</Card>
			)}

			<Separator />

			{/* Transaction list with status tabs */}
			<Tabs value={statusTab} onValueChange={setStatusTab}>
				<TabsList>
					<TabsTrigger value="pending">Pending</TabsTrigger>
					<TabsTrigger value="approved">Approved</TabsTrigger>
					<TabsTrigger value="rejected">Rejected</TabsTrigger>
					<TabsTrigger value="executed">Executed</TabsTrigger>
					<TabsTrigger value="all">All</TabsTrigger>
				</TabsList>

				<TabsContent value={statusTab} className="mt-4">
					{isLoading ? (
						<div className="p-8 text-center text-muted-foreground">Loading transactions…</div>
					) : rows.length === 0 ? (
						<div className="p-8 text-center text-muted-foreground">
							<AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
							No {statusTab} transactions.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>ID</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Product</TableHead>
									<TableHead>Initiated By</TableHead>
									<TableHead>Approver Type</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Queued</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((tx) => (
									<TableRow key={tx.id}>
										<TableCell className="font-mono text-xs">{tx.id.slice(0, 8).toUpperCase()}</TableCell>
										<TableCell className="capitalize">{tx.transactionType.replace(/_/g, " ")}</TableCell>
										<TableCell className="capitalize">{tx.productType.replace(/_/g, " ")}</TableCell>
										<TableCell>
											<div className="flex items-center gap-1.5">
												<User className="w-3.5 h-3.5 text-muted-foreground" />
												<span className="capitalize text-sm">{tx.initiatedByRole}</span>
											</div>
										</TableCell>
										<TableCell>
											<span className={`px-2 py-0.5 rounded-full text-xs font-medium ${approverRoleColor[tx.approverRole] ?? ""}`}>
												{approverRoleLabel[tx.approverRole] ?? tx.approverRole}
											</span>
										</TableCell>
										<TableCell><StatusBadge status={tx.status} /></TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{format(new Date(tx.createdAt), "dd MMM yy, HH:mm")}
										</TableCell>
										<TableCell className="text-right">
											{tx.status === "pending" && (
												<Dialog>
													<DialogTrigger asChild>
														<Button size="sm" variant="outline" onClick={() => { setSelectedTx(tx); setNotes(""); setRejectReason(""); }}>
															Review
														</Button>
													</DialogTrigger>
													<DialogContent className="max-w-lg">
														<DialogHeader>
															<DialogTitle>Review Transaction</DialogTitle>
															<DialogDescription>
																{tx.transactionType.replace(/_/g, " ")} — {tx.productType.replace(/_/g, " ")}
															</DialogDescription>
														</DialogHeader>
														<div className="space-y-3 text-sm">
															<div className="flex justify-between"><span className="text-muted-foreground">Transaction ID</span><span className="font-mono">{tx.id.slice(0, 8).toUpperCase()}</span></div>
															<div className="flex justify-between"><span className="text-muted-foreground">Initiated by</span><span className="capitalize">{tx.initiatedByRole}</span></div>
															<div className="flex justify-between"><span className="text-muted-foreground">Approver type</span><span>{approverRoleLabel[tx.approverRole]}</span></div>
															{tx.clientPan && <div className="flex justify-between"><span className="text-muted-foreground">Client PAN</span><span className="font-mono">{tx.clientPan}</span></div>}
															<Separator />
															<div>
																<Label htmlFor="approve-notes">Approval Notes (optional)</Label>
																<Textarea id="approve-notes" className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add context or notes…" />
															</div>
															<div>
																<Label htmlFor="reject-reason" className="text-destructive">Rejection Reason (required to reject)</Label>
																<Textarea id="reject-reason" className="mt-1 border-destructive" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Minimum 5 characters…" />
															</div>
															<p className="text-xs text-muted-foreground">
																⚠️ SEBI Disclosure: Approval uses your EUIN as executing principal. Market risks apply.
															</p>
														</div>
														<DialogFooter className="gap-2">
															<Button
																variant="destructive"
																disabled={rejectReason.trim().length < 5 || rejectMutation.isPending}
																onClick={() => rejectMutation.mutate({ id: tx.id, reason: rejectReason.trim() })}
															>
																<XCircle className="w-4 h-4 mr-1" /> Reject
															</Button>
															<Button
																disabled={approveMutation.isPending}
																onClick={() => approveMutation.mutate({ id: tx.id, notes })}
															>
																<CheckCircle2 className="w-4 h-4 mr-1" /> Approve
															</Button>
														</DialogFooter>
													</DialogContent>
												</Dialog>
											)}
											{tx.status !== "pending" && tx.irisOrderId && (
												<span className="text-xs font-mono text-emerald-600">{tx.irisOrderId}</span>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
