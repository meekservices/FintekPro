import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Shield as LucideShield,
	FileCheck,
	AlertTriangle,
	CheckCircle,
	XCircle,
	Clock,
	Eye,
	Download,
	Filter,
	Search,
	RefreshCw,
	User,
	Calendar,
	FileText,
	Users,
} from "lucide-react";
import {
	BulkSelectTable,
	type Column,
	type BulkAction,
} from "@/components/admin/BulkSelectTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ActiveTab = "dashboard" | "submissions" | "documents" | "alerts";

interface DashboardStats {
	pendingKyc: number;
	approvedToday: number;
	rejectedToday: number;
	pendingDocuments: number;
	activeAlerts: number;
	tier1Count: number;
	tier2Count: number;
	tier3Count: number;
}

interface KycSubmission {
	id: string;
	userId: string;
	userName: string;
	userEmail: string;
	type: string;
	tier: string;
	status: string;
	submittedAt: string;
	reviewedAt?: string;
	reviewedBy?: string;
}

interface ComplianceAlert {
	id: string;
	severity: string;
	type: string;
	message: string;
	userId?: string;
	createdAt: string;
	status: string;
}

function buildUrl(baseUrl: string, params: Record<string, any>): string {
	const url = new URL(baseUrl, window.location.origin);
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== "") {
			url.searchParams.set(key, String(value));
		}
	});
	return url.toString();
}

export default function KycCompliancePage() {
	const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [tierFilter, setTierFilter] = useState<string>("all");
	const [selectedSubmission, setSelectedSubmission] =
		useState<KycSubmission | null>(null);
	const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
	const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(
		null,
	);
	const [reviewNotes, setReviewNotes] = useState("");
	const [rejectionReason, setRejectionReason] = useState("");
	const { toast } = useToast();

	// Fetch dashboard stats
	const { data: statsResponse, refetch: refetchStats } = useQuery<{
		success: boolean;
		data: DashboardStats;
	}>({
		queryKey: ["/api/admin/kyc/dashboard"],
		enabled: activeTab === "dashboard",
	});
	const stats = statsResponse?.data;

	// Fetch KYC submissions
	const {
		data: submissionsResponse,
		refetch: refetchSubmissions,
		isLoading: isLoadingSubmissions,
	} = useQuery<{
		success: boolean;
		data: KycSubmission[];
		pagination: {
			total: number;
			limit: number;
			offset: number;
			hasMore: boolean;
		};
	}>({
		queryKey: [
			"/api/admin/kyc/submissions",
			statusFilter,
			tierFilter,
			searchQuery,
		],
		queryFn: async () => {
			const url = buildUrl("/api/admin/kyc/submissions", {
				status: statusFilter === "all" ? undefined : statusFilter,
				tier: tierFilter === "all" ? undefined : tierFilter,
				search: searchQuery || undefined,
			});
			const res = await fetch(url, { credentials: "include" });
			if (!res.ok) throw new Error("Failed to fetch submissions");
			return res.json();
		},
		enabled: activeTab === "submissions",
	});

	// Fetch compliance alerts
	const { data: alertsResponse, refetch: refetchAlerts } = useQuery<{
		alerts: ComplianceAlert[];
		total: number;
		unresolved: number;
	}>({
		queryKey: ["/api/admin/compliance/alerts", statusFilter],
		queryFn: async () => {
			const url = buildUrl("/api/admin/compliance/alerts", {
				resolved:
					statusFilter === "resolved"
						? "true"
						: statusFilter === "unresolved"
							? "false"
							: undefined,
			});
			const res = await fetch(url, { credentials: "include" });
			if (!res.ok) throw new Error("Failed to fetch alerts");
			return res.json();
		},
		enabled: activeTab === "alerts",
	});

	// Review KYC submission mutation
	const reviewMutation = useMutation({
		mutationFn: async ({ id, status, notes, reason }: any) => {
			return await apiRequest(
				`/api/admin/kyc/manual-submissions/${id}/review`,
				{
					method: "POST",
					body: JSON.stringify({ status, notes, rejectionReason: reason }),
				},
			);
		},
		onSuccess: () => {
			toast({
				title: "Success",
				description: `KYC ${reviewAction === "approve" ? "approved" : "rejected"} successfully`,
			});
			setReviewDialogOpen(false);
			setSelectedSubmission(null);
			setReviewNotes("");
			setRejectionReason("");
			refetchSubmissions();
			refetchStats();
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to review KYC submission",
				variant: "destructive",
			});
		},
	});

	const handleReview = () => {
		if (!selectedSubmission || !reviewAction) return;

		reviewMutation.mutate({
			id: selectedSubmission.id,
			status: reviewAction === "approve" ? "approved" : "rejected",
			notes: reviewNotes,
			reason: reviewAction === "reject" ? rejectionReason : undefined,
		});
	};

	const openReviewDialog = (
		submission: KycSubmission,
		action: "approve" | "reject",
	) => {
		setSelectedSubmission(submission);
		setReviewAction(action);
		setReviewDialogOpen(true);
	};

	const submissions = submissionsResponse?.data || [];
	const alerts = alertsResponse?.alerts || [];

	const kycColumns: Column<KycSubmission>[] = useMemo(
		() => [
			{
				id: "user",
				header: "User",
				cell: (submission) => (
					<div className="flex items-center gap-2">
						<User className="h-4 w-4 text-muted-foreground" />
						<div>
							<div className="font-medium">{submission.userName}</div>
							<div className="text-sm text-muted-foreground">
								{submission.userEmail}
							</div>
						</div>
					</div>
				),
			},
			{
				id: "type",
				header: "Type",
				cell: (submission) => (
					<Badge variant="outline">{submission.type}</Badge>
				),
			},
			{
				id: "tier",
				header: "Tier",
				cell: (submission) => (
					<Badge variant="secondary">{submission.tier}</Badge>
				),
			},
			{
				id: "status",
				header: "Status",
				cell: (submission) => (
					<Badge
						variant={
							submission.status === "approved"
								? "default"
								: submission.status === "rejected"
									? "destructive"
									: "secondary"
						}
						className={
							submission.status === "pending"
								? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
								: ""
						}
					>
						{submission.status}
					</Badge>
				),
			},
			{
				id: "submittedAt",
				header: "Submitted",
				cell: (submission) => (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Calendar className="h-4 w-4" />
						{new Date(submission.submittedAt).toLocaleDateString()}
					</div>
				),
			},
			{
				id: "actions",
				header: "Actions",
				cell: (submission) => (
					<div className="flex gap-2">
						<Button
							variant="ghost"
							size="sm"
							data-testid={`button-view-${submission.id}`}
						>
							<Eye className="h-4 w-4" />
						</Button>
						{submission.status === "pending" && (
							<>
								<Button
									variant="ghost"
									size="sm"
									className="text-green-600"
									onClick={() => openReviewDialog(submission, "approve")}
									data-testid={`button-approve-${submission.id}`}
								>
									<CheckCircle className="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="text-red-600"
									onClick={() => openReviewDialog(submission, "reject")}
									data-testid={`button-reject-${submission.id}`}
								>
									<XCircle className="h-4 w-4" />
								</Button>
							</>
						)}
					</div>
				),
			},
		],
		[],
	);

	const kycBulkActions: BulkAction<KycSubmission>[] = useMemo(
		() => [
			{
				id: "batch-approve",
				label: "Approve Selected",
				icon: <CheckCircle className="h-4 w-4 mr-2" />,
				variant: "default",
				requiresConfirmation: true,
				confirmTitle: "Batch Approve KYC Submissions",
				confirmDescription:
					"Are you sure you want to approve the selected KYC submissions? This action cannot be undone.",
				onExecute: async (items) => {
					try {
						const pendingItems = items.filter((i) => i.status === "pending");
						if (pendingItems.length === 0) {
							toast({
								title: "No pending submissions selected",
								variant: "destructive",
							});
							return;
						}
						const result = await apiRequest("/api/admin/kyc/batch-approve", {
							method: "POST",
							body: JSON.stringify({
								ids: pendingItems.map((i) => i.id),
								notes: "Batch approved via admin console",
							}),
						});
						toast({
							title: result.success ? "Success" : "Partial Success",
							description: result.message,
							variant: result.success ? "default" : "destructive",
						});
						await refetchSubmissions();
						await refetchStats();
					} catch (error: any) {
						toast({
							title: "Error",
							description: error.message || "Batch approval failed",
							variant: "destructive",
						});
					}
				},
			},
			{
				id: "batch-reject",
				label: "Reject Selected",
				icon: <XCircle className="h-4 w-4 mr-2" />,
				variant: "destructive",
				requiresConfirmation: true,
				confirmTitle: "Batch Reject KYC Submissions",
				confirmDescription:
					"Are you sure you want to reject the selected KYC submissions? Please provide a reason below.",
				onExecute: async (items) => {
					try {
						const pendingItems = items.filter((i) => i.status === "pending");
						if (pendingItems.length === 0) {
							toast({
								title: "No pending submissions selected",
								variant: "destructive",
							});
							return;
						}
						const result = await apiRequest("/api/admin/kyc/batch-reject", {
							method: "POST",
							body: JSON.stringify({
								ids: pendingItems.map((i) => i.id),
								reason: "Batch rejected - Incomplete documentation",
							}),
						});
						toast({
							title: result.success ? "Success" : "Partial Success",
							description: result.message,
							variant: result.success ? "default" : "destructive",
						});
						await refetchSubmissions();
						await refetchStats();
					} catch (error: any) {
						toast({
							title: "Error",
							description: error.message || "Batch rejection failed",
							variant: "destructive",
						});
					}
				},
			},
			{
				id: "batch-export",
				label: "Export Selected",
				icon: <Download className="h-4 w-4 mr-2" />,
				variant: "outline",
				requiresConfirmation: false,
				onExecute: async (items) => {
					try {
						const response = await fetch("/api/admin/kyc/batch-export", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								ids: items.map((i) => i.id),
								format: "csv",
							}),
							credentials: "include",
						});
						if (!response.ok) {
							throw new Error("Export failed");
						}
						const blob = await response.blob();
						const url = window.URL.createObjectURL(blob);
						const a = document.createElement("a");
						a.href = url;
						a.download = "kyc_export.csv";
						document.body.appendChild(a);
						a.click();
						window.URL.revokeObjectURL(url);
						document.body.removeChild(a);
						toast({
							title: "Export Complete",
							description: `Exported ${items.length} submissions`,
						});
					} catch (error: any) {
						toast({
							title: "Error",
							description: error.message || "Export failed",
							variant: "destructive",
						});
					}
				},
			},
		],
		[toast, refetchSubmissions, refetchStats],
	);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-foreground">
					KYC & Compliance Hub
				</h1>
				<p className="text-muted-foreground mt-2">
					Review KYC submissions, verify documents, and monitor compliance
					alerts
				</p>
			</div>

			{/* Tabs */}
			<Tabs
				value={activeTab}
				onValueChange={(v) => setActiveTab(v as ActiveTab)}
			>
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="dashboard" data-testid="tab-kyc-dashboard">
						<LucideShield className="h-4 w-4 mr-2" />
						Dashboard
					</TabsTrigger>
					<TabsTrigger value="submissions" data-testid="tab-kyc-submissions">
						<FileCheck className="h-4 w-4 mr-2" />
						Submissions
					</TabsTrigger>
					<TabsTrigger value="documents" data-testid="tab-kyc-documents">
						<FileText className="h-4 w-4 mr-2" />
						Documents
					</TabsTrigger>
					<TabsTrigger value="alerts" data-testid="tab-compliance-alerts">
						<AlertTriangle className="h-4 w-4 mr-2" />
						Alerts
					</TabsTrigger>
				</TabsList>

				{/* Dashboard Tab */}
				<TabsContent value="dashboard" className="mt-6 space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
						<Card data-testid="card-pending-kyc">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Pending KYC
								</CardTitle>
								<Clock className="h-4 w-4 text-orange-600" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-foreground">
									{stats?.pendingKyc || 0}
								</div>
							</CardContent>
						</Card>

						<Card data-testid="card-approved-today">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Approved Today
								</CardTitle>
								<CheckCircle className="h-4 w-4 text-green-600" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-foreground">
									{stats?.approvedToday || 0}
								</div>
							</CardContent>
						</Card>

						<Card data-testid="card-rejected-today">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Rejected Today
								</CardTitle>
								<XCircle className="h-4 w-4 text-red-600" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-foreground">
									{stats?.rejectedToday || 0}
								</div>
							</CardContent>
						</Card>

						<Card data-testid="card-pending-docs">
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Pending Documents
								</CardTitle>
								<FileText className="h-4 w-4 text-blue-600" />
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-foreground">
									{stats?.pendingDocuments || 0}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Tier Distribution */}
					<Card>
						<CardHeader>
							<CardTitle>KYC Tier Distribution</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-3 gap-4">
								<div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
									<div className="text-2xl font-bold text-blue-600">
										{stats?.tier1Count || 0}
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Tier 1
									</div>
								</div>
								<div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
									<div className="text-2xl font-bold text-purple-600">
										{stats?.tier2Count || 0}
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Tier 2
									</div>
								</div>
								<div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
									<div className="text-2xl font-bold text-green-600">
										{stats?.tier3Count || 0}
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Tier 3
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Compliance Alerts Summary */}
					<Card data-testid="card-active-alerts">
						<CardHeader className="flex flex-row items-center justify-between">
							<CardTitle>Active Compliance Alerts</CardTitle>
							<Badge variant="destructive" className="ml-auto">
								{stats?.activeAlerts || 0}
							</Badge>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								{stats?.activeAlerts
									? `${stats.activeAlerts} alerts require attention`
									: "No active alerts"}
							</p>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Submissions Tab */}
				<TabsContent value="submissions" className="mt-6 space-y-6">
					{/* Filters */}
					<div className="flex flex-col sm:flex-row gap-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search by name or email..."
								className="pl-10"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								data-testid="input-search-kyc"
							/>
						</div>
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger
								className="w-[180px]"
								data-testid="select-status-filter"
							>
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="approved">Approved</SelectItem>
								<SelectItem value="rejected">Rejected</SelectItem>
							</SelectContent>
						</Select>
						<Select value={tierFilter} onValueChange={setTierFilter}>
							<SelectTrigger
								className="w-[180px]"
								data-testid="select-tier-filter"
							>
								<SelectValue placeholder="Filter by tier" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Tiers</SelectItem>
								<SelectItem value="tier_1">Tier 1</SelectItem>
								<SelectItem value="tier_2">Tier 2</SelectItem>
								<SelectItem value="tier_3">Tier 3</SelectItem>
							</SelectContent>
						</Select>
						<Button
							variant="outline"
							onClick={() => refetchSubmissions()}
							data-testid="button-refresh"
						>
							<RefreshCw className="h-4 w-4 mr-2" />
							Refresh
						</Button>
					</div>

					{/* Submissions Table with Bulk Selection */}
					<Card>
						<CardContent className="p-0">
							<BulkSelectTable
								data={submissions}
								columns={kycColumns}
								bulkActions={kycBulkActions}
								isLoading={isLoadingSubmissions}
								emptyMessage="No KYC submissions found"
							/>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Documents Tab */}
				<TabsContent value="documents" className="mt-6">
					<Card>
						<CardHeader>
							<CardTitle>Document Verification</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground">
								Document verification interface will be displayed here
							</p>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Alerts Tab */}
				<TabsContent value="alerts" className="mt-6 space-y-6">
					<Card>
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Severity</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Message</TableHead>
										<TableHead>Created</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{alerts.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center py-8 text-muted-foreground"
											>
												No compliance alerts
											</TableCell>
										</TableRow>
									) : (
										alerts.map((alert: ComplianceAlert) => (
											<TableRow
												key={alert.id}
												data-testid={`row-alert-${alert.id}`}
											>
												<TableCell>
													<Badge
														variant={
															alert.severity === "high"
																? "destructive"
																: alert.severity === "medium"
																	? "default"
																	: "secondary"
														}
													>
														{alert.severity}
													</Badge>
												</TableCell>
												<TableCell>{alert.type}</TableCell>
												<TableCell>{alert.message}</TableCell>
												<TableCell>
													{new Date(alert.createdAt).toLocaleDateString()}
												</TableCell>
												<TableCell>
													<Badge
														variant={
															alert.status === "active"
																? "destructive"
																: "secondary"
														}
													>
														{alert.status}
													</Badge>
												</TableCell>
												<TableCell>
													<Button
														variant="ghost"
														size="sm"
														data-testid={`button-resolve-${alert.id}`}
													>
														Resolve
													</Button>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Review Dialog */}
			<Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
				<DialogContent data-testid="dialog-review-kyc">
					<DialogHeader>
						<DialogTitle>
							{reviewAction === "approve" ? "Approve" : "Reject"} KYC Submission
						</DialogTitle>
						<DialogDescription>
							Review and {reviewAction} the KYC submission for{" "}
							{selectedSubmission?.userName}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<label className="text-sm font-medium">Notes</label>
							<Textarea
								value={reviewNotes}
								onChange={(e) => setReviewNotes(e.target.value)}
								placeholder="Add review notes..."
								className="mt-1"
								data-testid="textarea-review-notes"
							/>
						</div>
						{reviewAction === "reject" && (
							<div>
								<label className="text-sm font-medium">
									Rejection Reason *
								</label>
								<Textarea
									value={rejectionReason}
									onChange={(e) => setRejectionReason(e.target.value)}
									placeholder="Provide reason for rejection..."
									className="mt-1"
									required
									data-testid="textarea-rejection-reason"
								/>
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setReviewDialogOpen(false)}
							data-testid="button-cancel-review"
						>
							Cancel
						</Button>
						<Button
							onClick={handleReview}
							disabled={
								reviewMutation.isPending ||
								(reviewAction === "reject" && !rejectionReason)
							}
							data-testid="button-confirm-review"
						>
							{reviewMutation.isPending
								? "Processing..."
								: `${reviewAction === "approve" ? "Approve" : "Reject"}`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
