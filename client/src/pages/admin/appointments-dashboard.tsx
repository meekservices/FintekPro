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
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	Users,
	Clock,
	CheckCircle2,
	XCircle,
	AlertTriangle,
	Search,
	Eye,
	Check,
	X,
	Ban,
	FileText,
	Download,
	Shield as LucideShield,
} from "lucide-react";

interface PendingAppointment {
	id: string;
	userId: string;
	email: string;
	firstName: string;
	lastName: string;
	roles: string[];
	appointmentStatus: string;
	appointmentInitiatedBy: string;
	appointmentInitiatorRole: string;
	appointmentCostCentreId: string | null;
	createdAt: string;
	initiatorName: string;
	requestedRole: string;
	panNumber: string | null;
	city: string | null;
	state: string | null;
}

interface AppointmentStats {
	pending: number;
	active: number;
	rejected: number;
	suspended: number;
	total: number;
}

export default function AdminAppointmentsDashboard() {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [selectedUser, setSelectedUser] = useState<PendingAppointment | null>(
		null,
	);
	const [showRejectDialog, setShowRejectDialog] = useState(false);
	const [showApproveDialog, setShowApproveDialog] = useState(false);
	const [rejectionReason, setRejectionReason] = useState("");

	// Fetch pending appointments
	const { data: pendingData, isLoading } = useQuery<{
		appointments: PendingAppointment[];
		total: number;
		page: number;
		totalPages: number;
	}>({
		queryKey: ["/api/admin/appointments/pending"],
	});

	// Fetch appointment stats
	const { data: stats } = useQuery<AppointmentStats>({
		queryKey: ["/api/admin/appointments/stats"],
	});

	// Approve mutation
	const approveMutation = useMutation({
		mutationFn: (userId: string) =>
			apiRequest(`/api/admin/appointments/${userId}/approve`, {
				method: "POST",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/appointments/pending"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/appointments/stats"],
			});
			toast({
				title: "Appointment Approved",
				description: "The user has been activated successfully.",
			});
			setShowApproveDialog(false);
			setSelectedUser(null);
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to approve appointment",
				variant: "destructive",
			});
		},
	});

	// Reject mutation
	const rejectMutation = useMutation({
		mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
			apiRequest(`/api/admin/appointments/${userId}/reject`, {
				method: "POST",
				body: JSON.stringify({ reason }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/appointments/pending"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/appointments/stats"],
			});
			toast({
				title: "Appointment Rejected",
				description: "The appointment has been rejected.",
			});
			setShowRejectDialog(false);
			setSelectedUser(null);
			setRejectionReason("");
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to reject appointment",
				variant: "destructive",
			});
		},
	});

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "pending_admin_approval":
				return (
					<Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
						<Clock className="h-3 w-3 mr-1" />
						Pending
					</Badge>
				);
			case "active":
				return (
					<Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
						<CheckCircle2 className="h-3 w-3 mr-1" />
						Active
					</Badge>
				);
			case "rejected":
				return (
					<Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
						<XCircle className="h-3 w-3 mr-1" />
						Rejected
					</Badge>
				);
			case "suspended":
				return (
					<Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
						<Ban className="h-3 w-3 mr-1" />
						Suspended
					</Badge>
				);
			default:
				return <Badge variant="outline">{status}</Badge>;
		}
	};

	const getRoleBadge = (role: string) => {
		const roleColors: Record<string, string> = {
			partner:
				"bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
			master_agent:
				"bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
			agent:
				"bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
			sub_agent:
				"bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200",
			support_staff: "bg-muted text-foreground",
			ca: "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200",
		};
		const roleLabels: Record<string, string> = {
			sub_agent: "FIELD EXECUTIVE",
			associate: "BUSINESS ASSOCIATE",
			district_associate: "DISTRICT ASSOCIATE",
			field_associate: "FIELD ASSOCIATE",
		};
		return (
			<Badge className={roleColors[role] || "bg-muted text-foreground"}>
				{roleLabels[role] || role.replace(/_/g, " ").toUpperCase()}
			</Badge>
		);
	};

	const filteredAppointments =
		pendingData?.appointments?.filter((apt) => {
			const matchesSearch =
				apt.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				apt.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				apt.email?.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesRole =
				roleFilter === "all" || apt.requestedRole === roleFilter;
			return matchesSearch && matchesRole;
		}) || [];

	return (
		<AdminLayout>
			<div className="p-6 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold flex items-center gap-3">
							<LucideShield className="h-8 w-8 text-primary" />
							Appointments Approval Queue
						</h1>
						<p className="text-muted-foreground mt-2">
							Review and approve role appointments across the platform
						</p>
					</div>
					<Button
						variant="outline"
						data-testid="button-export-audit-trail"
						onClick={() => {
							window.open(
								"/api/admin/appointments/audit-trail?format=csv",
								"_blank",
							);
						}}
					>
						<Download className="h-4 w-4 mr-2" />
						Export Audit Trail
					</Button>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
					<Card data-testid="card-stats-pending">
						<CardHeader className="pb-2">
							<CardDescription>Pending Approval</CardDescription>
							<CardTitle
								className="text-3xl text-yellow-600"
								data-testid="text-pending-count"
							>
								{stats?.pending || 0}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Clock className="h-4 w-4" />
								<span>Awaiting review</span>
							</div>
						</CardContent>
					</Card>

					<Card data-testid="card-stats-active">
						<CardHeader className="pb-2">
							<CardDescription>Active Users</CardDescription>
							<CardTitle
								className="text-3xl text-green-600"
								data-testid="text-active-count"
							>
								{stats?.active || 0}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<CheckCircle2 className="h-4 w-4" />
								<span>Approved & active</span>
							</div>
						</CardContent>
					</Card>

					<Card data-testid="card-stats-rejected">
						<CardHeader className="pb-2">
							<CardDescription>Rejected</CardDescription>
							<CardTitle
								className="text-3xl text-red-600"
								data-testid="text-rejected-count"
							>
								{stats?.rejected || 0}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<XCircle className="h-4 w-4" />
								<span>Application denied</span>
							</div>
						</CardContent>
					</Card>

					<Card data-testid="card-stats-suspended">
						<CardHeader className="pb-2">
							<CardDescription>Suspended</CardDescription>
							<CardTitle
								className="text-3xl text-orange-600"
								data-testid="text-suspended-count"
							>
								{stats?.suspended || 0}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Ban className="h-4 w-4" />
								<span>Account blocked</span>
							</div>
						</CardContent>
					</Card>

					<Card data-testid="card-stats-total">
						<CardHeader className="pb-2">
							<CardDescription>Total Users</CardDescription>
							<CardTitle className="text-3xl" data-testid="text-total-count">
								{stats?.total || 0}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Users className="h-4 w-4" />
								<span>All statuses</span>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Filters */}
				<div className="flex items-center gap-4">
					<div className="relative flex-1 max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name or email..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
							data-testid="search-appointments"
						/>
					</div>
					<Select value={roleFilter} onValueChange={setRoleFilter}>
						<SelectTrigger className="w-48" data-testid="select-role-filter">
							<SelectValue placeholder="Filter by role" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Roles</SelectItem>
							<SelectItem value="partner">Partner</SelectItem>
							<SelectItem value="master_agent">Master Agent</SelectItem>
							<SelectItem value="agent">Agent</SelectItem>
							<SelectItem value="sub_agent">Sub-Agent</SelectItem>
							<SelectItem value="support_staff">Support Staff</SelectItem>
							<SelectItem value="ca">CA</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Pending Appointments Table */}
				<Tabs defaultValue="pending">
					<TabsList>
						<TabsTrigger value="pending" data-testid="tab-pending-approvals">
							Pending Approval ({stats?.pending || 0})
						</TabsTrigger>
						<TabsTrigger value="audit" data-testid="tab-audit-trail">
							Audit Trail
						</TabsTrigger>
					</TabsList>

					<TabsContent value="pending" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle>Pending Appointments</CardTitle>
								<CardDescription>
									Review and take action on pending role appointments
								</CardDescription>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="flex items-center justify-center py-12">
										<div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
									</div>
								) : filteredAppointments.length === 0 ? (
									<div className="text-center py-12 text-muted-foreground">
										<CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
										<p>No pending appointments</p>
									</div>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>User</TableHead>
												<TableHead>Role</TableHead>
												<TableHead>Initiated By</TableHead>
												<TableHead>Cost Centre</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Created</TableHead>
												<TableHead className="text-right">Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredAppointments.map((apt) => (
												<TableRow
													key={apt.id}
													data-testid={`appointment-row-${apt.id}`}
												>
													<TableCell>
														<div>
															<div className="font-medium">
																{apt.firstName} {apt.lastName}
															</div>
															<div className="text-sm text-muted-foreground">
																{apt.email}
															</div>
															{apt.panNumber && (
																<div className="text-xs text-muted-foreground">
																	PAN: {apt.panNumber}
																</div>
															)}
														</div>
													</TableCell>
													<TableCell>
														{getRoleBadge(apt.requestedRole)}
													</TableCell>
													<TableCell>
														<div>
															<div className="text-sm">{apt.initiatorName}</div>
															<div className="text-xs text-muted-foreground">
																{apt.appointmentInitiatorRole?.replace(
																	/_/g,
																	" ",
																)}
															</div>
														</div>
													</TableCell>
													<TableCell>
														{apt.appointmentCostCentreId || (
															<span className="text-muted-foreground">-</span>
														)}
													</TableCell>
													<TableCell>
														{getStatusBadge(apt.appointmentStatus)}
													</TableCell>
													<TableCell>
														{new Date(apt.createdAt).toLocaleDateString()}
													</TableCell>
													<TableCell className="text-right">
														<div className="flex items-center justify-end gap-2">
															<Button
																variant="ghost"
																size="sm"
																onClick={() => {
																	setSelectedUser(apt);
																}}
															>
																<Eye className="h-4 w-4" />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="text-green-600 hover:text-green-700 dark:text-green-300 hover:bg-green-50 dark:bg-green-950/30"
																onClick={() => {
																	setSelectedUser(apt);
																	setShowApproveDialog(true);
																}}
																data-testid={`approve-btn-${apt.id}`}
															>
																<Check className="h-4 w-4" />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="text-red-600 hover:text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-950/30"
																onClick={() => {
																	setSelectedUser(apt);
																	setShowRejectDialog(true);
																}}
																data-testid={`reject-btn-${apt.id}`}
															>
																<X className="h-4 w-4" />
															</Button>
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="audit" className="mt-6">
						<Card>
							<CardHeader>
								<CardTitle>Appointment Audit Trail</CardTitle>
								<CardDescription>
									Complete history of appointment actions
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="text-center py-8 text-muted-foreground">
									<FileText className="h-12 w-12 mx-auto mb-4" />
									<p>Audit trail will be displayed here</p>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				{/* Approve Dialog */}
				<Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
								<CheckCircle2 className="h-5 w-5" />
								Approve Appointment
							</DialogTitle>
							<DialogDescription>
								Are you sure you want to approve this appointment?
							</DialogDescription>
						</DialogHeader>
						{selectedUser && (
							<div className="py-4 space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label className="text-muted-foreground">Name</Label>
										<p className="font-medium">
											{selectedUser.firstName} {selectedUser.lastName}
										</p>
									</div>
									<div>
										<Label className="text-muted-foreground">Email</Label>
										<p className="font-medium">{selectedUser.email}</p>
									</div>
									<div>
										<Label className="text-muted-foreground">Role</Label>
										<p>{getRoleBadge(selectedUser.requestedRole)}</p>
									</div>
									<div>
										<Label className="text-muted-foreground">
											Initiated By
										</Label>
										<p className="font-medium">{selectedUser.initiatorName}</p>
									</div>
								</div>
								<div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
									<p className="text-sm text-green-800 dark:text-green-200">
										Upon approval, this user will be able to log in and access
										platform features based on their assigned role.
									</p>
								</div>
							</div>
						)}
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setShowApproveDialog(false)}
							>
								Cancel
							</Button>
							<Button
								className="bg-green-600 hover:bg-green-700"
								onClick={() =>
									selectedUser && approveMutation.mutate(selectedUser.id)
								}
								disabled={approveMutation.isPending}
								data-testid="confirm-approve-btn"
							>
								{approveMutation.isPending
									? "Approving..."
									: "Approve Appointment"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Reject Dialog */}
				<Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
								<XCircle className="h-5 w-5" />
								Reject Appointment
							</DialogTitle>
							<DialogDescription>
								Please provide a reason for rejecting this appointment.
							</DialogDescription>
						</DialogHeader>
						{selectedUser && (
							<div className="py-4 space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label className="text-muted-foreground">Name</Label>
										<p className="font-medium">
											{selectedUser.firstName} {selectedUser.lastName}
										</p>
									</div>
									<div>
										<Label className="text-muted-foreground">Role</Label>
										<p>{getRoleBadge(selectedUser.requestedRole)}</p>
									</div>
								</div>
								<div>
									<Label htmlFor="rejection-reason">
										Rejection Reason (Required)
									</Label>
									<Textarea
										id="rejection-reason"
										placeholder="Enter the reason for rejecting this appointment..."
										value={rejectionReason}
										onChange={(e) => setRejectionReason(e.target.value)}
										className="mt-2"
										rows={3}
										data-testid="rejection-reason-input"
									/>
								</div>
								<div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
									<p className="text-sm text-red-800 dark:text-red-200">
										This action is permanent. The user will not be able to
										access the platform.
									</p>
								</div>
							</div>
						)}
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setShowRejectDialog(false);
									setRejectionReason("");
								}}
							>
								Cancel
							</Button>
							<Button
								variant="destructive"
								onClick={() =>
									selectedUser &&
									rejectMutation.mutate({
										userId: selectedUser.id,
										reason: rejectionReason,
									})
								}
								disabled={rejectMutation.isPending || !rejectionReason.trim()}
								data-testid="confirm-reject-btn"
							>
								{rejectMutation.isPending
									? "Rejecting..."
									: "Reject Appointment"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</AdminLayout>
	);
}
