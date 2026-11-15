import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	RefreshCw,
	CheckCircle2,
	AlertTriangle,
	ArrowRightLeft,
	ShieldCheck,
	Play,
	FileText,
	Building2,
	DollarSign,
	Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function TradeReconciliationPage() {
	const { toast } = useToast();
	const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<any | null>(null);
	const [resolutionNote, setResolutionNote] = useState("");

	const { data: latestReconResponse, isLoading, refetch } = useQuery<{ success: boolean; data: any }>({
		queryKey: ["/api/admin/reconciliation/latest"],
		refetchInterval: 15000,
	});

	const { data: historyResponse, refetch: refetchHistory } = useQuery<{ success: boolean; data: any[] }>({
		queryKey: ["/api/admin/reconciliation/history"],
		refetchInterval: 30000,
	});

	const runMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/admin/reconciliation/run", {});
			return res.json();
		},
		onSuccess: (data) => {
			if (data.success) {
				toast({
					title: "Reconciliation Run Completed",
					description: `Match rate: ${data.data.summary.matchRatePercent}% across ${data.data.summary.totalInternalOrders} orders.`,
				});
				refetch();
				refetchHistory();
			}
		},
		onError: (err: any) => {
			toast({
				title: "Reconciliation Failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const resolveMutation = useMutation({
		mutationFn: async ({ id, note }: { id: string; note: string }) => {
			const res = await apiRequest("POST", `/api/admin/reconciliation/discrepancies/${id}/resolve`, {
				note,
				action: "AUTO_SYNC_STATUS",
			});
			return res.json();
		},
		onSuccess: (data) => {
			if (data.success) {
				toast({
					title: "Discrepancy Resolved",
					description: "The order status has been updated and audited.",
				});
				setSelectedDiscrepancy(null);
				setResolutionNote("");
				refetch();
			}
		},
	});

	const report = latestReconResponse?.data;
	const history = historyResponse?.data || [];

	return (
		<AdminLayout>
			<div className="p-6 space-y-6 max-w-7xl mx-auto">
				{/* Header */}
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
							<ArrowRightLeft className="h-6 w-6 text-primary" />
							T+1 Trade & Broker Reconciliation
						</h1>
						<p className="text-sm text-muted-foreground">
							Automated multi-broker transaction verification, contract note matching, and settlement auditing.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch()}
							className="gap-1.5"
						>
							<RefreshCw className="h-4 w-4" />
							Refresh
						</Button>
						<Button
							size="sm"
							onClick={() => runMutation.mutate()}
							disabled={runMutation.isPending}
							className="gap-1.5"
						>
							<Play className="h-4 w-4" />
							{runMutation.isPending ? "Reconciling..." : "Run Reconciliation"}
						</Button>
					</div>
				</div>

				{/* Summary KPI Strip */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Reconciliation Status</CardDescription>
							<CardTitle className="text-xl flex items-center gap-2">
								{report?.status === "MATCHED" ? (
									<>
										<CheckCircle2 className="h-5 w-5 text-emerald-500" />
										<span className="text-emerald-600">All Matched</span>
									</>
								) : (
									<>
										<AlertTriangle className="h-5 w-5 text-amber-500" />
										<span className="text-amber-600">Discrepancies</span>
									</>
								)}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-muted-foreground">
							Period: {report?.periodStart ? new Date(report.periodStart).toLocaleDateString() : "Today"}
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Overall Match Rate</CardDescription>
							<CardTitle className="text-2xl font-bold text-foreground">
								{report?.summary?.matchRatePercent ?? 100}%
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-muted-foreground">
							{report?.summary?.matchedOrders || 0} / {report?.summary?.totalInternalOrders || 0} orders matched
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Active Discrepancies</CardDescription>
							<CardTitle className="text-2xl font-bold text-orange-600">
								{report?.discrepancies?.length || 0}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-muted-foreground">
							Requires compliance officer or backoffice action
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardDescription>SEBI System Audit Proof</CardDescription>
							<CardTitle className="text-xs font-mono text-muted-foreground truncate">
								{report?.checksum ? `${report.checksum.slice(0, 16)}...` : "PENDING"}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
							<ShieldCheck className="h-3.5 w-3.5" />
							SHA-256 Checksum Chained
						</CardContent>
					</Card>
				</div>

				{/* Broker Venue Breakdown */}
				<div className="grid grid-cols-1 md:grid-cols-5 gap-3">
					{report?.venueBreakdown &&
						Object.entries(report.venueBreakdown).map(([venue, stats]: [string, any]) => (
							<div key={venue} className="p-3.5 rounded-lg border bg-card text-card-foreground">
								<div className="text-xs font-semibold text-muted-foreground truncate">
									{venue.replace(/_/g, " ")}
								</div>
								<div className="text-lg font-bold mt-1">
									{stats.matchedOrders} / {stats.totalOrders}
								</div>
								<div className="text-[11px] text-muted-foreground flex items-center justify-between mt-1">
									<span>Discrepancies:</span>
									<span className={stats.discrepancies > 0 ? "font-bold text-red-500" : "text-emerald-500"}>
										{stats.discrepancies}
									</span>
								</div>
							</div>
						))}
				</div>

				{/* Discrepancy Resolution Table */}
				<Card>
					<CardHeader>
						<CardTitle className="text-lg flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-amber-500" />
							Discrepancy Exception Queue
						</CardTitle>
						<CardDescription>
							Transactions with status divergence, excessive execution slippage, or unlinked settlements.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="py-8 text-center text-muted-foreground">Running reconciliation audit...</div>
						) : !report?.discrepancies || report.discrepancies.length === 0 ? (
							<div className="py-10 text-center">
								<CheckCircle2 className="h-9 w-9 text-emerald-500 mx-auto mb-2" />
								<h4 className="text-sm font-semibold">Zero Discrepancies</h4>
								<p className="text-xs text-muted-foreground mt-1">
									All internal order states match broker trade books with zero unreconciled variance.
								</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Venue</TableHead>
										<TableHead>Order ID</TableHead>
										<TableHead>Anomaly Type</TableHead>
										<TableHead>Internal State</TableHead>
										<TableHead>Broker State</TableHead>
										<TableHead>Severity</TableHead>
										<TableHead className="text-right">Action</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{report.discrepancies.map((disc: any) => (
										<TableRow key={disc.id}>
											<TableCell className="font-semibold text-xs whitespace-nowrap">
												{disc.venue}
											</TableCell>
											<TableCell className="font-mono text-xs">{disc.orderId}</TableCell>
											<TableCell>
												<Badge variant="outline" className="text-xs">
													{disc.discrepancyType.replace(/_/g, " ")}
												</Badge>
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">{disc.internalValue}</TableCell>
											<TableCell className="text-xs font-medium text-foreground">{disc.brokerValue}</TableCell>
											<TableCell>
												<Badge className={disc.severity === "high" ? "bg-red-500 text-white" : "bg-amber-500 text-white"}>
													{disc.severity}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<Button
													size="sm"
													variant="outline"
													onClick={() => setSelectedDiscrepancy(disc)}
													className="text-xs h-7"
												>
													Resolve
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				{/* Resolution Dialog */}
				<Dialog open={!!selectedDiscrepancy} onOpenChange={() => setSelectedDiscrepancy(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Resolve Trade Discrepancy</DialogTitle>
							<DialogDescription>
								Confirm resolution action for order {selectedDiscrepancy?.orderId} ({selectedDiscrepancy?.venue}).
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-2">
							<div className="p-3 rounded-lg border bg-muted/30 text-xs space-y-1">
								<div><strong>Issue:</strong> {selectedDiscrepancy?.discrepancyType}</div>
								<div><strong>Difference:</strong> {selectedDiscrepancy?.difference}</div>
								<div><strong>Recommended Action:</strong> {selectedDiscrepancy?.recommendedAction}</div>
							</div>
							<div className="space-y-1">
								<label htmlFor="compliance-resolution-note" className="text-xs font-semibold">Compliance Resolution Note</label>
								<Input
									id="compliance-resolution-note"
									placeholder="Explain action taken for regulatory audit trail..."
									value={resolutionNote}
									onChange={(e) => setResolutionNote(e.target.value)}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setSelectedDiscrepancy(null)}>
								Cancel
							</Button>
							<Button
								disabled={resolveMutation.isPending || !resolutionNote.trim()}
								onClick={() =>
									resolveMutation.mutate({
										id: selectedDiscrepancy.id,
										note: resolutionNote,
									})
								}
							>
								{resolveMutation.isPending ? "Applying..." : "Confirm & Update"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</AdminLayout>
	);
}
