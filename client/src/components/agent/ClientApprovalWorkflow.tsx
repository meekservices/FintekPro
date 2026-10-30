import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import {
	CheckCircle2,
	XCircle,
	Clock,
	Shield as LucideShield,
	FileSignature,
	AlertCircle,
	Loader2,
	ThumbsUp,
	ThumbsDown,
	Calendar,
	ArrowRight,
	Database,
	Building2,
	Send,
	Sparkles,
} from "lucide-react";

interface ApprovalStatus {
	id?: string;
	proposalId: string;
	status: "pending" | "approved" | "rejected" | "deferred";
	disclosureAcknowledged: boolean;
	disclosureAcknowledgedAt?: string;
	riskAcknowledged: boolean;
	riskAcknowledgedAt?: string;
	executionConsent: boolean;
	executionConsentAt?: string;
	signatureType?: string;
	signedAt?: string;
	clientNotes?: string;
	approvedAt?: string;
	rejectedAt?: string;
	rejectionReason?: string;
	deferredUntil?: string;
}

interface ClientApprovalWorkflowProps {
	proposalId: string;
	prospectName: string;
	totalAmount: number;
	onApproved?: () => void;
	onRejected?: () => void;
	isAgentView?: boolean;
}

const STATUS_CONFIG = {
	pending: {
		label: "Pending Approval",
		color:
			"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
		icon: Clock,
	},
	approved: {
		label: "Approved",
		color:
			"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
		icon: CheckCircle2,
	},
	rejected: {
		label: "Rejected",
		color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
		icon: XCircle,
	},
	deferred: {
		label: "Deferred",
		color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
		icon: Calendar,
	},
};

export function ClientApprovalWorkflow({
	proposalId,
	prospectName,
	totalAmount,
	onApproved,
	onRejected,
	isAgentView: _isAgentView = true,
}: ClientApprovalWorkflowProps) {
	const { toast } = useToast();
	const [disclosureAck, setDisclosureAck] = useState(false);
	const [riskAck, setRiskAck] = useState(false);
	const [executionConsent, setExecutionConsent] = useState(false);
	const [clientNotes, setClientNotes] = useState("");
	const [rejectionReason, setRejectionReason] = useState("");
	const [showRejectForm, setShowRejectForm] = useState(false);

	const { data: approval, isLoading } = useQuery<ApprovalStatus>({
		queryKey: ["/api/agent/proposals", proposalId, "approval"],
		enabled: !!proposalId,
	});

	// Fetch transaction lifecycle and external sync status
	const {
		data: lifecycleData,
		refetch: refetchLifecycle,
	} = useQuery({
		queryKey: ["/api/agent/proposals", proposalId, "transaction-lifecycle"],
		queryFn: async () => {
			const res = await apiRequest(
				`/api/agent/proposals/${proposalId}/transaction-lifecycle`,
			);
			return res?.data || res;
		},
		enabled: !!proposalId && approval?.status === "approved",
		refetchInterval: 15000,
	});

	const lifecycle: any = lifecycleData;

	// Mutation: Initiate Transaction on FintekPro
	const initiateTxMutation = useMutation({
		mutationFn: async (gateway?: string) => {
			return await apiRequest(
				`/api/agent/proposals/${proposalId}/initiate-transaction`,
				{
					method: "POST",
					body: JSON.stringify({
						orderType: "LUMPSUM",
						paymentGateway: gateway || "bse_star",
						executionGateway: gateway || "BSE_STAR_MF",
					}),
					headers: { "Content-Type": "application/json" },
				},
			);
		},
		onSuccess: (res) => {
			toast({
				title: "Transaction Initiated",
				description: `Order ${res.data?.orderNumber || ""} successfully carved on FintekPro.`,
			});
			refetchLifecycle();
		},
		onError: (err: any) => {
			toast({
				title: "Initiation Failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	// Mutation: Complete Transaction & Dispatch Copies to Zoho & SEBI
	const completeTxMutation = useMutation({
		mutationFn: async (orderId: string) => {
			return await apiRequest(
				`/api/agent/proposals/${proposalId}/complete-transaction`,
				{
					method: "POST",
					body: JSON.stringify({
						orderId,
						executionStatus: "completed",
						dispatchToExternalApis: true,
					}),
					headers: { "Content-Type": "application/json" },
				},
			);
		},
		onSuccess: () => {
			toast({
				title: "Transaction Completed & Dispatched",
				description:
					"Recorded at FintekPro. Copies dispatched to Zoho Books and SEBI compliance ledger.",
			});
			refetchLifecycle();
		},
		onError: (err: any) => {
			toast({
				title: "Completion Error",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	// Mutation: On-Demand Dispatch copies
	const dispatchCopiesMutation = useMutation({
		mutationFn: async (orderId: string) => {
			return await apiRequest(`/api/transactions/${orderId}/dispatch-copies`, {
				method: "POST",
				body: JSON.stringify({ destinations: ["zoho", "sebi"] }),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			toast({
				title: "Copies Dispatched",
				description: "Synchronized with Zoho Books and SEBI Regulatory Dossier.",
			});
			refetchLifecycle();
		},
	});

	const submitApprovalMutation = useMutation({
		mutationFn: async (data: Partial<ApprovalStatus>) => {
			return await apiRequest(`/api/agent/proposals/${proposalId}/approval`, {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: (data) => {
			if (data.status === "approved") {
				toast({
					title: "Proposal Approved",
					description: "Client has approved the proposal for execution",
				});
				onApproved?.();
			} else if (data.status === "rejected") {
				toast({
					title: "Proposal Rejected",
					description: "Client has declined this proposal",
				});
				onRejected?.();
			}
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/proposals", proposalId, "approval"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Submission Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const handleApprove = () => {
		submitApprovalMutation.mutate({
			status: "approved",
			disclosureAcknowledged: disclosureAck,
			riskAcknowledged: riskAck,
			executionConsent,
			clientNotes,
			signatureType: "digital",
		});
	};

	const handleReject = () => {
		submitApprovalMutation.mutate({
			status: "rejected",
			rejectionReason,
		});
	};

	const completionSteps = [
		{
			label: "Disclosure Acknowledged",
			completed: approval?.disclosureAcknowledged || disclosureAck,
		},
		{
			label: "Risk Acknowledged",
			completed: approval?.riskAcknowledged || riskAck,
		},
		{
			label: "Execution Consent",
			completed: approval?.executionConsent || executionConsent,
		},
		{ label: "Digital Signature", completed: !!approval?.signedAt },
	];

	const completedCount = completionSteps.filter((s) => s.completed).length;
	const completionPercent = (completedCount / completionSteps.length) * 100;

	if (isLoading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-8">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	const status = approval?.status || "pending";
	const StatusIcon = STATUS_CONFIG[status].icon;

	if (status === "approved") {
		const order = lifecycle?.order;
		const isOrderInitiated = !!order;
		const isOrderCompleted = order?.status === "completed" || order?.status === "settled";
		const sebiDossier = order?.sebiAuditDossier;
		const zohoStatus = order?.dispatchStatus?.zoho;

		return (
			<Card className="border-green-200 dark:border-green-800 shadow-md">
				<CardHeader className="bg-green-50/50 dark:bg-green-950/20 border-b border-green-100 dark:border-green-900/40">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
								<CheckCircle2 className="h-5 w-5 text-green-600" />
								Proposal Approved & Execution Path Active
							</CardTitle>
							<CardDescription>
								{prospectName} approved this proposal on{" "}
								{approval?.approvedAt
									? format(new Date(approval.approvedAt), "MMM d, yyyy h:mm a")
									: "N/A"}
							</CardDescription>
						</div>
						<Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300 font-semibold">
							Consent Recorded
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-6 pt-5">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						<div className="p-3 bg-muted/60 rounded-lg border">
							<p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Value</p>
							<p className="text-lg font-bold text-foreground">
								₹{totalAmount.toLocaleString("en-IN")}
							</p>
						</div>
						<div className="p-3 bg-muted/60 rounded-lg border">
							<p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Verification</p>
							<p className="text-lg font-bold capitalize text-foreground">
								{approval?.signatureType || "Digital OTP"}
							</p>
						</div>
						<div className="p-3 bg-muted/60 rounded-lg border">
							<p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">SEBI Compliance</p>
							<p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
								<LucideShield className="h-4 w-4" /> Compliant
							</p>
						</div>
						<div className="p-3 bg-muted/60 rounded-lg border">
							<p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Order Status</p>
							<p className="text-sm font-semibold capitalize text-foreground mt-1">
								{order?.status ? order.status.replace("_", " ") : "Not Initiated"}
							</p>
						</div>
					</div>

					{approval?.clientNotes && (
						<div className="p-3 bg-muted/40 border rounded-lg text-sm">
							<span className="font-semibold text-muted-foreground">Client Note: </span>
							<span className="text-foreground">{approval.clientNotes}</span>
						</div>
					)}

					{/* Carved Transaction Path Pipeline Stepper */}
					<div className="p-4 rounded-xl border bg-card/60 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Sparkles className="h-4 w-4 text-primary" />
								<h4 className="font-semibold text-sm">End-to-End Transaction Path</h4>
							</div>
							<Badge variant="secondary" className="text-xs">
								FintekPro Ledger
							</Badge>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2">
							{/* Step 1: Consent */}
							<div className="p-3 rounded-lg border border-green-200 dark:border-green-900 bg-green-50/40 dark:bg-green-950/20">
								<div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium text-xs mb-1">
									<CheckCircle2 className="h-4 w-4 text-green-600" />
									1. Client Consent
								</div>
								<p className="text-[11px] text-muted-foreground">
									SEBI risk disclosure acknowledged & OTP digitally signed.
								</p>
							</div>

							{/* Step 2: Order Initiation */}
							<div className={`p-3 rounded-lg border ${
								isOrderInitiated 
									? "border-green-200 dark:border-green-900 bg-green-50/40 dark:bg-green-950/20" 
									: "border-primary/40 bg-primary/5"
							}`}>
								<div className={`flex items-center gap-2 font-medium text-xs mb-1 ${
									isOrderInitiated ? "text-green-700 dark:text-green-300" : "text-primary"
								}`}>
									{isOrderInitiated ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4" />}
									2. Order Initiated
								</div>
								<p className="text-[11px] text-muted-foreground">
									{isOrderInitiated 
										? (order?.orderId || "FIN-ORD Generated") 
										: "Ready to initiate on FintekPro order engine"}
								</p>
							</div>

							{/* Step 3: Transaction Completion */}
							<div className={`p-3 rounded-lg border ${
								isOrderCompleted 
									? "border-green-200 dark:border-green-900 bg-green-50/40 dark:bg-green-950/20" 
									: isOrderInitiated 
									? "border-amber-300 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20" 
									: "border-muted bg-muted/20"
							}`}>
								<div className={`flex items-center gap-2 font-medium text-xs mb-1 ${
									isOrderCompleted 
										? "text-green-700 dark:text-green-300" 
										: isOrderInitiated 
										? "text-amber-700 dark:text-amber-300" 
										: "text-muted-foreground"
								}`}>
									{isOrderCompleted ? (
										<CheckCircle2 className="h-4 w-4 text-green-600" />
									) : (
										<Clock className="h-4 w-4" />
									)}
									3. Settlement
								</div>
								<p className="text-[11px] text-muted-foreground">
									{isOrderCompleted ? "Settled & Cleared" : "Awaiting exchange/bank settlement"}
								</p>
							</div>

							{/* Step 4: Multi-API Dispatch */}
							<div className={`p-3 rounded-lg border ${
								order?.dispatchStatus?.sebi?.status === "dossier_created"
									? "border-green-200 dark:border-green-900 bg-green-50/40 dark:bg-green-950/20"
									: isOrderCompleted
									? "border-blue-300 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20"
									: "border-muted bg-muted/20"
							}`}>
								<div className={`flex items-center gap-2 font-medium text-xs mb-1 ${
									order?.dispatchStatus?.sebi?.status === "dossier_created"
										? "text-green-700 dark:text-green-300"
										: "text-muted-foreground"
								}`}>
									<Send className="h-4 w-4" />
									4. Dual Dispatch
								</div>
								<p className="text-[11px] text-muted-foreground">
									Copies to Zoho Books & SEBI Regulatory Audit Log
								</p>
							</div>
						</div>
					</div>

					{/* Action Trigger Area */}
					{!isOrderInitiated ? (
						<div className="p-5 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-4">
							<div className="space-y-1">
								<h4 className="font-semibold text-foreground flex items-center gap-2">
									<ArrowRight className="h-4 w-4 text-primary" />
									Carve & Transact on FintekPro
								</h4>
								<p className="text-xs text-muted-foreground">
									Route approved proposal items through FintekPro execution gateway (BSE Star MF / Upstox).
								</p>
							</div>
							<Button
								onClick={() => initiateTxMutation.mutate("BSE_STAR_MF")}
								disabled={initiateTxMutation.isPending}
								className="w-full md:w-auto font-medium"
							>
								{initiateTxMutation.isPending ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Initiating Order...
									</>
								) : (
									<>
										<Sparkles className="mr-2 h-4 w-4" />
										Initiate Transaction
									</>
								)}
							</Button>
						</div>
					) : (
						<div className="space-y-4">
							<div className="p-4 rounded-xl border bg-muted/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span className="text-xs text-muted-foreground uppercase font-bold">Order ID:</span>
										<code className="text-xs font-mono font-bold bg-background px-2 py-0.5 rounded border">
											{order.orderId}
										</code>
										<Badge variant={isOrderCompleted ? "default" : "secondary"}>
											{order.status}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										Gateway: <strong className="text-foreground">{order.executionGateway}</strong> | Created: {order.createdAt ? format(new Date(order.createdAt), "dd MMM yyyy, HH:mm") : "N/A"}
									</p>
								</div>

								<div className="flex items-center gap-2 w-full md:w-auto">
									{!isOrderCompleted && (
										<Button
											size="sm"
											onClick={() => completeTxMutation.mutate(order.orderId)}
											disabled={completeTxMutation.isPending}
										>
											{completeTxMutation.isPending ? (
												<>
													<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
													Settling...
												</>
											) : (
												<>
													<CheckCircle2 className="mr-2 h-3.5 w-3.5" />
													Mark Settled & Dispatch
												</>
											)}
										</Button>
									)}

									<Button
										variant="outline"
										size="sm"
										onClick={() => dispatchCopiesMutation.mutate(order.orderId)}
										disabled={dispatchCopiesMutation.isPending}
									>
										{dispatchCopiesMutation.isPending ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<>
												<Send className="mr-1.5 h-3.5 w-3.5" />
												Re-dispatch Copies
											</>
										)}
									</Button>
								</div>
							</div>

							{/* External Sync Status Details (Zoho & SEBI) */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{/* Zoho Books Copy */}
								<div className="p-3.5 rounded-lg border bg-card/60 flex items-start gap-3">
									<Building2 className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
									<div className="space-y-1 text-xs">
										<div className="flex items-center gap-2">
											<span className="font-semibold text-foreground">Zoho Books & CRM</span>
											<Badge variant="outline" className="text-[10px] h-5 text-blue-600 border-blue-300">
												{zohoStatus?.synced ? "Synced" : "Ready / Pending"}
											</Badge>
										</div>
										<p className="text-muted-foreground text-[11px]">
											{zohoStatus?.synced
												? `Invoice / Ledger ID: ${zohoStatus?.invoiceId || zohoStatus?.journalId || "Synced"}`
												: "Transaction copy formatted for accounting & reconciliation."}
										</p>
									</div>
								</div>

								{/* SEBI Regulatory Audit Dossier */}
								<div className="p-3.5 rounded-lg border bg-card/60 flex items-start gap-3">
									<Database className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
									<div className="space-y-1 text-xs">
										<div className="flex items-center gap-2">
											<span className="font-semibold text-foreground">SEBI Audit Dossier</span>
											<Badge variant="outline" className="text-[10px] h-5 text-emerald-600 border-emerald-300">
												{sebiDossier?.auditId ? "Immutable Log" : "Draft"}
											</Badge>
										</div>
										<p className="text-muted-foreground text-[11px]">
											{sebiDossier?.auditId ? (
												<>
													ID: <span className="font-mono">{sebiDossier.auditId}</span> | SHA-256 Hash Verified
												</>
											) : (
												"Pre-cleared with advisory risk disclosure & client consent."
											)}
										</p>
									</div>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		);
	}

	if (status === "rejected") {
		return (
			<Card className="border-red-200 dark:border-red-800">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
						<XCircle className="h-5 w-5" />
						Proposal Rejected
					</CardTitle>
					<CardDescription>
						{prospectName} declined this proposal on{" "}
						{approval?.rejectedAt
							? format(new Date(approval.rejectedAt), "MMM d, yyyy h:mm a")
							: "N/A"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{approval?.rejectionReason && (
						<div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
							<p className="text-sm font-medium">Rejection Reason</p>
							<p className="text-sm text-muted-foreground">
								{approval.rejectionReason}
							</p>
						</div>
					)}
					<Alert className="mt-4">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							Consider revising the proposal based on client feedback and
							resharing.
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<FileSignature className="h-5 w-5" />
							Client Approval Workflow
						</CardTitle>
						<CardDescription>
							Collect consent and approval from {prospectName}
						</CardDescription>
					</div>
					<Badge className={STATUS_CONFIG[status].color}>
						<StatusIcon className="h-3 w-3 mr-1" />
						{STATUS_CONFIG[status].label}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				<div>
					<div className="flex items-center justify-between mb-2">
						<span className="text-sm font-medium">Approval Progress</span>
						<span className="text-sm text-muted-foreground">
							{completedCount}/{completionSteps.length}
						</span>
					</div>
					<Progress value={completionPercent} className="h-2" />
					<div className="flex justify-between mt-2">
						{completionSteps.map((step, idx) => (
							<div key={idx} className="flex flex-col items-center">
								<div
									className={`w-6 h-6 rounded-full flex items-center justify-center ${
										step.completed
											? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
											: "bg-muted"
									}`}
								>
									{step.completed ? (
										<CheckCircle2 className="h-4 w-4" />
									) : (
										<span className="text-xs">{idx + 1}</span>
									)}
								</div>
								<span className="text-[10px] text-muted-foreground mt-1 text-center max-w-[60px]">
									{step.label}
								</span>
							</div>
						))}
					</div>
				</div>

				<Separator />

				<div className="space-y-4">
					<div className="flex items-start space-x-3 p-3 border rounded-lg">
						<Checkbox
							id="disclosure"
							checked={disclosureAck}
							onCheckedChange={(checked) =>
								setDisclosureAck(checked as boolean)
							}
							data-testid="checkbox-disclosure"
						/>
						<div className="flex-1">
							<Label
								htmlFor="disclosure"
								className="font-medium cursor-pointer"
							>
								Disclosure Acknowledgment
							</Label>
							<p className="text-sm text-muted-foreground mt-1">
								I acknowledge that this proposal is advisory in nature and I
								have understood all the terms, conditions, and risks involved.
							</p>
						</div>
						<LucideShield className="h-5 w-5 text-amber-500" />
					</div>

					<div className="flex items-start space-x-3 p-3 border rounded-lg">
						<Checkbox
							id="risk"
							checked={riskAck}
							onCheckedChange={(checked) => setRiskAck(checked as boolean)}
							data-testid="checkbox-risk"
						/>
						<div className="flex-1">
							<Label htmlFor="risk" className="font-medium cursor-pointer">
								Risk Acknowledgment
							</Label>
							<p className="text-sm text-muted-foreground mt-1">
								I understand that investments are subject to market risks and
								past performance is not indicative of future results. I accept
								the risk level of this proposal.
							</p>
						</div>
						<AlertCircle className="h-5 w-5 text-red-500" />
					</div>

					<div className="flex items-start space-x-3 p-3 border rounded-lg">
						<Checkbox
							id="execution"
							checked={executionConsent}
							onCheckedChange={(checked) =>
								setExecutionConsent(checked as boolean)
							}
							disabled={!disclosureAck || !riskAck}
							data-testid="checkbox-execution"
						/>
						<div className="flex-1">
							<Label
								htmlFor="execution"
								className={`font-medium cursor-pointer ${!disclosureAck || !riskAck ? "text-muted-foreground" : ""}`}
							>
								Execution Consent
							</Label>
							<p className="text-sm text-muted-foreground mt-1">
								I authorize FintekPro and my advisor to execute the transactions
								as outlined in this proposal on my behalf.
							</p>
							{(!disclosureAck || !riskAck) && (
								<p className="text-xs text-amber-600 mt-1">
									Complete the above acknowledgments first
								</p>
							)}
						</div>
						<FileSignature className="h-5 w-5 text-green-500" />
					</div>
				</div>

				<div>
					<Label htmlFor="notes">Client Notes (Optional)</Label>
					<Textarea
						id="notes"
						placeholder="Any additional notes or instructions..."
						value={clientNotes}
						onChange={(e) => setClientNotes(e.target.value)}
						className="mt-1"
						data-testid="input-client-notes"
					/>
				</div>

				{showRejectForm && (
					<div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950">
						<Label
							htmlFor="rejection"
							className="text-red-700 dark:text-red-300"
						>
							Reason for Rejection
						</Label>
						<Textarea
							id="rejection"
							placeholder="Please explain why you're declining this proposal..."
							value={rejectionReason}
							onChange={(e) => setRejectionReason(e.target.value)}
							className="mt-1"
							data-testid="input-rejection-reason"
						/>
						<div className="flex gap-2 mt-3">
							<Button
								variant="destructive"
								onClick={handleReject}
								disabled={
									!rejectionReason.trim() || submitApprovalMutation.isPending
								}
							>
								{submitApprovalMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<XCircle className="h-4 w-4 mr-2" />
								)}
								Confirm Rejection
							</Button>
							<Button
								variant="outline"
								onClick={() => setShowRejectForm(false)}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			{!showRejectForm && (
				<CardFooter className="flex justify-between">
					<Button
						variant="outline"
						onClick={() => setShowRejectForm(true)}
						data-testid="btn-reject-proposal"
					>
						<ThumbsDown className="h-4 w-4 mr-2" />
						Decline Proposal
					</Button>
					<Button
						onClick={handleApprove}
						disabled={
							!disclosureAck ||
							!riskAck ||
							!executionConsent ||
							submitApprovalMutation.isPending
						}
						data-testid="btn-approve-proposal"
					>
						{submitApprovalMutation.isPending ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<ThumbsUp className="h-4 w-4 mr-2" />
						)}
						Approve & Execute
					</Button>
				</CardFooter>
			)}
		</Card>
	);
}
