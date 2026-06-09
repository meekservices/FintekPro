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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
	isAgentView = true,
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
		return (
			<Card className="border-green-200 dark:border-green-800">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
						<CheckCircle2 className="h-5 w-5" />
						Proposal Approved
					</CardTitle>
					<CardDescription>
						{prospectName} approved this proposal on{" "}
						{approval?.approvedAt
							? format(new Date(approval.approvedAt), "MMM d, yyyy h:mm a")
							: "N/A"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-4">
						<div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
							<p className="text-sm text-muted-foreground">Total Amount</p>
							<p className="text-lg font-bold">
								₹{totalAmount.toLocaleString("en-IN")}
							</p>
						</div>
						<div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
							<p className="text-sm text-muted-foreground">Signature</p>
							<p className="text-lg font-bold capitalize">
								{approval?.signatureType || "Digital"}
							</p>
						</div>
					</div>
					{approval?.clientNotes && (
						<div className="mt-4 p-3 bg-muted rounded-lg">
							<p className="text-sm font-medium">Client Notes</p>
							<p className="text-sm text-muted-foreground">
								{approval.clientNotes}
							</p>
						</div>
					)}
					<Alert className="mt-4 bg-green-50 dark:bg-green-950 border-green-200">
						<CheckCircle2 className="h-4 w-4 text-green-600" />
						<AlertTitle>Ready for Execution</AlertTitle>
						<AlertDescription>
							All consents received. You can now proceed with executing the
							transactions on FintekPro.
						</AlertDescription>
					</Alert>
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
