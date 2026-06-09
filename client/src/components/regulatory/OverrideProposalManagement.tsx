import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	Plus,
	CheckCircle,
	XCircle,
	Clock,
	AlertTriangle,
	FileText,
	Shield as LucideShield,
	User,
	ArrowUpRight,
} from "lucide-react";

interface OverrideProposal {
	id: string;
	userId: string;
	productCategory: string;
	productSubCategory?: string;
	isin?: string;
	overrideType: string;
	currentInvestorType?: string;
	proposedInvestorType?: string;
	currentMinInvestment?: string;
	proposedMinInvestment?: string;
	currentMaxInvestment?: string;
	proposedMaxInvestment?: string;
	currentBrokeragePercent?: string;
	proposedBrokeragePercent?: string;
	justification: string;
	validFrom: string;
	validUntil: string;
	proposedBy: string;
	proposerRole: string;
	status: string;
	proposedAt: string;
	level1Status?: string;
	level1Notes?: string;
	level2Status?: string;
	level2Notes?: string;
}

const statusColors: Record<string, string> = {
	pending:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
	under_review:
		"bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
	approved:
		"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
	rejected:
		"bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
	expired: "bg-muted text-muted-foreground border-border",
	revoked:
		"bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

const statusIcons: Record<string, typeof Clock> = {
	pending: Clock,
	under_review: FileText,
	approved: CheckCircle,
	rejected: XCircle,
	expired: AlertTriangle,
	revoked: LucideShield,
};

export function OverrideProposalManagement() {
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showReviewDialog, setShowReviewDialog] = useState(false);
	const [selectedProposal, setSelectedProposal] =
		useState<OverrideProposal | null>(null);
	const { toast } = useToast();

	const { data: proposalsResponse, isLoading } = useQuery<{
		success: boolean;
		proposals: OverrideProposal[];
	}>({
		queryKey: [
			`/api/regulatory/override-proposals${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`,
		],
	});

	const reviewMutation = useMutation({
		mutationFn: async ({
			proposalId,
			reviewLevel,
			decision,
			notes,
		}: {
			proposalId: string;
			reviewLevel: "level1" | "level2" | "final";
			decision: "approved" | "rejected" | "escalated";
			notes: string;
		}) => {
			return apiRequest(
				`/api/regulatory/override-proposals/${proposalId}/review`,
				{
					method: "POST",
					body: JSON.stringify({ reviewLevel, decision, notes }),
				},
			);
		},
		onSuccess: () => {
			toast({
				title: "Review Submitted",
				description: "Your review has been recorded successfully.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/regulatory/override-proposals"],
			});
			setShowReviewDialog(false);
			setSelectedProposal(null);
		},
		onError: (error: Error) => {
			toast({
				title: "Review Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const proposals = proposalsResponse?.proposals || [];

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString("en-IN", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	const formatCurrency = (amount: string | undefined) => {
		if (!amount) return "-";
		const num = Number.parseFloat(amount);
		if (num >= 10000000) {
			return `₹${(num / 10000000).toFixed(1)} Cr`;
		}
		if (num >= 100000) {
			return `₹${(num / 100000).toFixed(1)} L`;
		}
		return `₹${num.toLocaleString("en-IN")}`;
	};

	return (
		<Card data-testid="card-override-proposal-management">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<LucideShield className="h-5 w-5" />
							Investment Limit Override Proposals
						</CardTitle>
						<CardDescription>
							Manage override requests for investment limits, investor types,
							and brokerage rates
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger
								className="w-[140px]"
								data-testid="select-status-filter"
							>
								<SelectValue placeholder="Filter status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="under_review">Under Review</SelectItem>
								<SelectItem value="approved">Approved</SelectItem>
								<SelectItem value="rejected">Rejected</SelectItem>
							</SelectContent>
						</Select>
						<Button
							onClick={() => setShowCreateDialog(true)}
							data-testid="button-create-proposal"
						>
							<Plus className="h-4 w-4 mr-1" />
							New Proposal
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				) : proposals.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground">
						<FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
						<p>No override proposals found</p>
						<p className="text-sm">
							Create a new proposal to request limit overrides
						</p>
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User/Product</TableHead>
								<TableHead>Override Type</TableHead>
								<TableHead>Proposed Change</TableHead>
								<TableHead>Valid Period</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{proposals.map((proposal) => {
								const StatusIcon = statusIcons[proposal.status] || Clock;
								return (
									<TableRow
										key={proposal.id}
										data-testid={`row-proposal-${proposal.id}`}
									>
										<TableCell>
											<div className="space-y-1">
												<div className="flex items-center gap-1 text-sm font-medium">
													<User className="h-3 w-3" />
													{proposal.userId.substring(0, 8)}...
												</div>
												<div className="text-xs text-muted-foreground capitalize">
													{proposal.productCategory}
													{proposal.productSubCategory &&
														` / ${proposal.productSubCategory}`}
												</div>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant="outline" className="capitalize">
												{proposal.overrideType.replace(/_/g, " ")}
											</Badge>
										</TableCell>
										<TableCell>
											{proposal.overrideType === "investment_limit" && (
												<div className="text-sm">
													<span className="text-muted-foreground">Max: </span>
													<span className="line-through mr-1">
														{formatCurrency(proposal.currentMaxInvestment)}
													</span>
													<ArrowUpRight className="h-3 w-3 inline text-green-600" />
													<span className="text-green-600 font-medium">
														{formatCurrency(proposal.proposedMaxInvestment)}
													</span>
												</div>
											)}
											{proposal.overrideType === "investor_type" && (
												<div className="text-sm">
													<span className="capitalize">
														{proposal.currentInvestorType}
													</span>
													<ArrowUpRight className="h-3 w-3 inline mx-1 text-green-600" />
													<span className="text-green-600 font-medium capitalize">
														{proposal.proposedInvestorType}
													</span>
												</div>
											)}
											{proposal.overrideType === "brokerage" && (
												<div className="text-sm">
													<span className="text-muted-foreground">
														Brokerage:{" "}
													</span>
													<span className="line-through mr-1">
														{proposal.currentBrokeragePercent}%
													</span>
													<ArrowUpRight className="h-3 w-3 inline text-green-600" />
													<span className="text-green-600 font-medium">
														{proposal.proposedBrokeragePercent}%
													</span>
												</div>
											)}
										</TableCell>
										<TableCell className="text-sm">
											<div>{formatDate(proposal.validFrom)}</div>
											<div className="text-muted-foreground">
												to {formatDate(proposal.validUntil)}
											</div>
										</TableCell>
										<TableCell>
											<Badge className={statusColors[proposal.status]}>
												<StatusIcon className="h-3 w-3 mr-1" />
												{proposal.status.replace(/_/g, " ")}
											</Badge>
										</TableCell>
										<TableCell>
											{proposal.status === "pending" && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => {
														setSelectedProposal(proposal);
														setShowReviewDialog(true);
													}}
													data-testid={`button-review-${proposal.id}`}
												>
													Review
												</Button>
											)}
											{proposal.status === "under_review" && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => {
														setSelectedProposal(proposal);
														setShowReviewDialog(true);
													}}
													data-testid={`button-continue-review-${proposal.id}`}
												>
													Continue Review
												</Button>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</CardContent>

			<ReviewProposalDialog
				proposal={selectedProposal}
				open={showReviewDialog}
				onOpenChange={setShowReviewDialog}
				onSubmit={(reviewLevel, decision, notes) => {
					if (selectedProposal) {
						reviewMutation.mutate({
							proposalId: selectedProposal.id,
							reviewLevel,
							decision,
							notes,
						});
					}
				}}
				isPending={reviewMutation.isPending}
			/>

			<CreateProposalDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
			/>
		</Card>
	);
}

function ReviewProposalDialog({
	proposal,
	open,
	onOpenChange,
	onSubmit,
	isPending,
}: {
	proposal: OverrideProposal | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (
		reviewLevel: "level1" | "level2" | "final",
		decision: "approved" | "rejected" | "escalated",
		notes: string,
	) => void;
	isPending: boolean;
}) {
	const [notes, setNotes] = useState("");
	const [reviewLevel, setReviewLevel] = useState<"level1" | "level2" | "final">(
		"level1",
	);

	if (!proposal) return null;

	const determineReviewLevel = () => {
		if (!proposal.level1Status) return "level1";
		if (!proposal.level2Status) return "level2";
		return "final";
	};

	const currentLevel = determineReviewLevel();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Review Override Proposal</DialogTitle>
					<DialogDescription>
						Review Level:{" "}
						{currentLevel === "level1"
							? "Compliance Review"
							: currentLevel === "level2"
								? "Senior Management"
								: "Final Approval"}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="bg-muted p-4 rounded-lg space-y-2">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Override Type:</span>
							<span className="font-medium capitalize">
								{proposal.overrideType.replace(/_/g, " ")}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Product:</span>
							<span className="font-medium capitalize">
								{proposal.productCategory}
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Proposer:</span>
							<span className="font-medium capitalize">
								{proposal.proposerRole}
							</span>
						</div>
					</div>

					<div>
						<Label className="text-sm text-muted-foreground">
							Justification
						</Label>
						<p className="text-sm mt-1 p-3 bg-muted rounded-md">
							{proposal.justification}
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="review-notes">Review Notes</Label>
						<Textarea
							id="review-notes"
							placeholder="Enter your review notes..."
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={4}
							data-testid="textarea-review-notes"
						/>
					</div>
				</div>

				<DialogFooter className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						data-testid="button-cancel-review"
					>
						Cancel
					</Button>
					{currentLevel !== "final" && (
						<Button
							variant="secondary"
							onClick={() => onSubmit(currentLevel, "escalated", notes)}
							disabled={isPending || !notes}
							data-testid="button-escalate"
						>
							Escalate
						</Button>
					)}
					<Button
						variant="destructive"
						onClick={() => onSubmit(currentLevel, "rejected", notes)}
						disabled={isPending || !notes}
						data-testid="button-reject"
					>
						<XCircle className="h-4 w-4 mr-1" />
						Reject
					</Button>
					<Button
						onClick={() => onSubmit(currentLevel, "approved", notes)}
						disabled={isPending || !notes}
						data-testid="button-approve"
					>
						<CheckCircle className="h-4 w-4 mr-1" />
						Approve
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CreateProposalDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { toast } = useToast();
	const [formData, setFormData] = useState({
		userId: "",
		productCategory: "bonds",
		overrideType: "investment_limit",
		currentMaxInvestment: "",
		proposedMaxInvestment: "",
		justification: "",
		validDays: "90",
	});

	const createMutation = useMutation({
		mutationFn: async () => {
			const validFrom = new Date();
			const validUntil = new Date(
				Date.now() + Number.parseInt(formData.validDays) * 24 * 60 * 60 * 1000,
			);

			return apiRequest("/api/regulatory/override-proposals", {
				method: "POST",
				body: JSON.stringify({
					userId: formData.userId,
					productCategory: formData.productCategory,
					overrideType: formData.overrideType,
					currentMaxInvestment:
						Number.parseFloat(formData.currentMaxInvestment) || undefined,
					proposedMaxInvestment:
						Number.parseFloat(formData.proposedMaxInvestment) || undefined,
					justification: formData.justification,
					validFrom: validFrom.toISOString(),
					validUntil: validUntil.toISOString(),
				}),
			});
		},
		onSuccess: () => {
			toast({
				title: "Proposal Created",
				description: "Your override proposal has been submitted for review.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/regulatory/override-proposals"],
			});
			onOpenChange(false);
			setFormData({
				userId: "",
				productCategory: "bonds",
				overrideType: "investment_limit",
				currentMaxInvestment: "",
				proposedMaxInvestment: "",
				justification: "",
				validDays: "90",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Creation Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Create Override Proposal</DialogTitle>
					<DialogDescription>
						Submit a request to override investment limits for a user
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="user-id">User ID</Label>
						<Input
							id="user-id"
							placeholder="Enter user ID"
							value={formData.userId}
							onChange={(e) =>
								setFormData({ ...formData, userId: e.target.value })
							}
							data-testid="input-user-id"
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Product Category</Label>
							<Select
								value={formData.productCategory}
								onValueChange={(v) =>
									setFormData({ ...formData, productCategory: v })
								}
							>
								<SelectTrigger data-testid="select-product-category">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="bonds">Bonds</SelectItem>
									<SelectItem value="ncds">NCDs</SelectItem>
									<SelectItem value="gsec">G-Sec</SelectItem>
									<SelectItem value="sgb">SGB</SelectItem>
									<SelectItem value="mld">MLDs</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Override Type</Label>
							<Select
								value={formData.overrideType}
								onValueChange={(v) =>
									setFormData({ ...formData, overrideType: v })
								}
							>
								<SelectTrigger data-testid="select-override-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="investment_limit">
										Investment Limit
									</SelectItem>
									<SelectItem value="investor_type">Investor Type</SelectItem>
									<SelectItem value="brokerage">Brokerage Rate</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="current-limit">Current Max Investment</Label>
							<Input
								id="current-limit"
								type="number"
								placeholder="₹0"
								value={formData.currentMaxInvestment}
								onChange={(e) =>
									setFormData({
										...formData,
										currentMaxInvestment: e.target.value,
									})
								}
								data-testid="input-current-limit"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="proposed-limit">Proposed Max Investment</Label>
							<Input
								id="proposed-limit"
								type="number"
								placeholder="₹0"
								value={formData.proposedMaxInvestment}
								onChange={(e) =>
									setFormData({
										...formData,
										proposedMaxInvestment: e.target.value,
									})
								}
								data-testid="input-proposed-limit"
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="valid-days">Valid For (Days)</Label>
						<Select
							value={formData.validDays}
							onValueChange={(v) => setFormData({ ...formData, validDays: v })}
						>
							<SelectTrigger data-testid="select-valid-days">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="30">30 Days</SelectItem>
								<SelectItem value="90">90 Days</SelectItem>
								<SelectItem value="180">180 Days</SelectItem>
								<SelectItem value="365">1 Year</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="justification">Justification</Label>
						<Textarea
							id="justification"
							placeholder="Explain why this override is needed..."
							value={formData.justification}
							onChange={(e) =>
								setFormData({ ...formData, justification: e.target.value })
							}
							rows={4}
							data-testid="textarea-justification"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						data-testid="button-cancel-create"
					>
						Cancel
					</Button>
					<Button
						onClick={() => createMutation.mutate()}
						disabled={
							createMutation.isPending ||
							!formData.userId ||
							!formData.justification
						}
						data-testid="button-submit-proposal"
					>
						{createMutation.isPending ? "Submitting..." : "Submit Proposal"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
