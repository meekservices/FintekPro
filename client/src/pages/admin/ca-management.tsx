import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
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
	DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Users,
	UserCheck,
	UserX,
	Clock,
	Search,
	RefreshCw,
	Eye,
	CheckCircle,
	XCircle,
	Star,
	TrendingUp,
	BarChart3,
	Briefcase,
	MapPin,
	Award,
	Filter,
} from "lucide-react";

interface CAApplication {
	id: string;
	name: string;
	email: string;
	mobile: string;
	icaiNumber: string;
	membershipType: string;
	firmName?: string;
	specializations: string[];
	city: string;
	state: string;
	experience: number;
	appliedAt: string;
}

interface CAPartner {
	id: string;
	name: string;
	email: string;
	mobile: string;
	icaiNumber: string;
	membershipType: string;
	firmName?: string;
	specializations: string[];
	city: string;
	state: string;
	experience: number;
	availability: string;
	activeCases: number;
	completedCases: number;
	rating: string;
	verificationStatus: string;
	createdAt: string;
}

interface PerformanceData {
	id: string;
	name: string;
	activeCases: number;
	completedCases: number;
	maxCases: number;
	utilizationRate: number;
	rating: number;
	responseTime: string;
	availability: string;
	specializations: string[];
}

const VERIFICATION_STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
	verified:
		"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
	rejected: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

const AVAILABILITY_COLORS: Record<string, string> = {
	available:
		"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
	busy: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
	on_leave:
		"bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
	unavailable: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

export default function CAManagement() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState("pending");
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [selectedCA, setSelectedCA] = useState<CAApplication | null>(null);
	const [rejectionReason, setRejectionReason] = useState("");
	const [showVerifyDialog, setShowVerifyDialog] = useState(false);
	const [verifyAction, setVerifyAction] = useState<"approve" | "reject">(
		"approve",
	);

	const { data: pendingData, isLoading: pendingLoading } = useQuery<{
		success: boolean;
		pendingCAs: CAApplication[];
	}>({
		queryKey: ["/api/ca/admin/pending-verifications"],
		enabled: activeTab === "pending",
	});

	const { data: allCAsData, isLoading: allCAsLoading } = useQuery<{
		success: boolean;
		cas: CAPartner[];
		pagination: {
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		};
	}>({
		queryKey: ["/api/ca/admin/all", statusFilter, searchQuery],
		enabled: activeTab === "all",
	});

	const { data: performanceData, isLoading: performanceLoading } = useQuery<{
		success: boolean;
		performance: PerformanceData[];
		summary: {
			totalCAs: number;
			availableCAs: number;
			avgUtilization: number;
			avgRating: string;
		};
	}>({
		queryKey: ["/api/ca/admin/performance"],
		enabled: activeTab === "performance",
	});

	const verifyMutation = useMutation({
		mutationFn: async ({
			partnerId,
			action,
			rejectionReason,
		}: {
			partnerId: string;
			action: "approve" | "reject";
			rejectionReason?: string;
		}) => {
			return await apiRequest(`/api/ca/admin/verify/${partnerId}`, {
				method: "POST",
				body: JSON.stringify({
					action,
					rejectionReason,
					adminId: "current-admin",
				}),
			});
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/ca/admin/pending-verifications"],
			});
			queryClient.invalidateQueries({ queryKey: ["/api/ca/admin/all"] });
			toast({
				title: variables.action === "approve" ? "CA Approved" : "CA Rejected",
				description:
					variables.action === "approve"
						? "The CA has been approved and can now accept cases."
						: "The CA application has been rejected.",
			});
			setShowVerifyDialog(false);
			setSelectedCA(null);
			setRejectionReason("");
		},
		onError: () => {
			toast({
				title: "Action Failed",
				description: "Failed to process the verification. Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleVerify = () => {
		if (!selectedCA) return;

		if (verifyAction === "reject" && !rejectionReason.trim()) {
			toast({
				title: "Rejection Reason Required",
				description: "Please provide a reason for rejection.",
				variant: "destructive",
			});
			return;
		}

		verifyMutation.mutate({
			partnerId: selectedCA.id,
			action: verifyAction,
			rejectionReason: verifyAction === "reject" ? rejectionReason : undefined,
		});
	};

	const pendingCAs = pendingData?.pendingCAs || [];
	const allCAs = allCAsData?.cas || [];
	const performance = performanceData?.performance || [];
	const summary = performanceData?.summary;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">CA Partner Management</h1>
					<p className="text-muted-foreground">
						Manage Chartered Accountant partners and their performance
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Pending Applications
						</CardTitle>
						<Clock className="h-4 w-4 text-yellow-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{pendingCAs.length}</div>
						<p className="text-xs text-muted-foreground">
							Awaiting verification
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Active CAs</CardTitle>
						<UserCheck className="h-4 w-4 text-green-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{summary?.availableCAs || 0}
						</div>
						<p className="text-xs text-muted-foreground">Available for cases</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Avg Utilization
						</CardTitle>
						<BarChart3 className="h-4 w-4 text-blue-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{summary?.avgUtilization || 0}%
						</div>
						<p className="text-xs text-muted-foreground">Capacity used</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
						<Star className="h-4 w-4 text-yellow-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold flex items-center gap-1">
							{summary?.avgRating || "0.00"}
							<Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
						</div>
						<p className="text-xs text-muted-foreground">Client ratings</p>
					</CardContent>
				</Card>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<ScrollableTabsList>
					<TabsTrigger value="pending" data-testid="tab-pending">
						<Clock className="h-4 w-4 mr-2" />
						Pending Verification ({pendingCAs.length})
					</TabsTrigger>
					<TabsTrigger value="all" data-testid="tab-all">
						<Users className="h-4 w-4 mr-2" />
						All CAs
					</TabsTrigger>
					<TabsTrigger value="performance" data-testid="tab-performance">
						<TrendingUp className="h-4 w-4 mr-2" />
						Performance
					</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value="pending" className="mt-6">
					<Card>
						<CardHeader>
							<CardTitle>Pending CA Applications</CardTitle>
							<CardDescription>
								Review and verify CA registrations
							</CardDescription>
						</CardHeader>
						<CardContent>
							{pendingLoading ? (
								<div className="flex justify-center py-8">
									<RefreshCw className="h-6 w-6 animate-spin" />
								</div>
							) : pendingCAs.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500 opacity-50" />
									<h3 className="text-lg font-medium mb-1">All caught up!</h3>
									<p>No pending CA applications to review</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>CA Details</TableHead>
											<TableHead>ICAI Info</TableHead>
											<TableHead>Location</TableHead>
											<TableHead>Specializations</TableHead>
											<TableHead>Applied</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{pendingCAs.map((ca) => (
											<TableRow key={ca.id}>
												<TableCell>
													<div>
														<p className="font-medium">{ca.name}</p>
														<p className="text-sm text-muted-foreground">
															{ca.email}
														</p>
														<p className="text-sm text-muted-foreground">
															{ca.mobile}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<div>
														<p className="font-mono">{ca.icaiNumber}</p>
														<Badge variant="outline">{ca.membershipType}</Badge>
														{ca.firmName && (
															<p className="text-sm text-muted-foreground mt-1">
																{ca.firmName}
															</p>
														)}
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1">
														<MapPin className="h-4 w-4 text-muted-foreground" />
														{ca.city}, {ca.state}
													</div>
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap gap-1 max-w-[200px]">
														{ca.specializations?.slice(0, 3).map((spec) => (
															<Badge
																key={spec}
																variant="secondary"
																className="text-xs capitalize"
															>
																{spec.replace(/_/g, " ")}
															</Badge>
														))}
														{(ca.specializations?.length || 0) > 3 && (
															<Badge variant="outline" className="text-xs">
																+{ca.specializations.length - 3} more
															</Badge>
														)}
													</div>
												</TableCell>
												<TableCell>
													{new Date(ca.appliedAt).toLocaleDateString()}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<Button
															size="sm"
															variant="outline"
															className="text-green-600 hover:text-green-700 dark:text-green-300"
															onClick={() => {
																setSelectedCA(ca);
																setVerifyAction("approve");
																setShowVerifyDialog(true);
															}}
															data-testid={`button-approve-${ca.id}`}
														>
															<CheckCircle className="h-4 w-4 mr-1" />
															Approve
														</Button>
														<Button
															size="sm"
															variant="outline"
															className="text-red-600 hover:text-red-700 dark:text-red-300"
															onClick={() => {
																setSelectedCA(ca);
																setVerifyAction("reject");
																setShowVerifyDialog(true);
															}}
															data-testid={`button-reject-${ca.id}`}
														>
															<XCircle className="h-4 w-4 mr-1" />
															Reject
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

				<TabsContent value="all" className="mt-6">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>All Chartered Accountants</CardTitle>
									<CardDescription>
										Manage all registered CA partners
									</CardDescription>
								</div>
								<div className="flex items-center gap-3">
									<div className="relative">
										<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											placeholder="Search CAs..."
											className="pl-10 w-[250px]"
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											data-testid="input-search-cas"
										/>
									</div>
									<Select value={statusFilter} onValueChange={setStatusFilter}>
										<SelectTrigger
											className="w-[150px]"
											data-testid="select-status-filter"
										>
											<SelectValue placeholder="All Statuses" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Statuses</SelectItem>
											<SelectItem value="verified">Verified</SelectItem>
											<SelectItem value="pending">Pending</SelectItem>
											<SelectItem value="rejected">Rejected</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{allCAsLoading ? (
								<div className="flex justify-center py-8">
									<RefreshCw className="h-6 w-6 animate-spin" />
								</div>
							) : allCAs.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
									<h3 className="text-lg font-medium mb-1">No CAs found</h3>
									<p>Try adjusting your search or filters</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>CA Details</TableHead>
											<TableHead>ICAI</TableHead>
											<TableHead>Location</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Availability</TableHead>
											<TableHead>Cases</TableHead>
											<TableHead>Rating</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{allCAs.map((ca) => (
											<TableRow key={ca.id}>
												<TableCell>
													<div>
														<p className="font-medium">{ca.name}</p>
														<p className="text-sm text-muted-foreground">
															{ca.email}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<div>
														<p className="font-mono text-sm">{ca.icaiNumber}</p>
														<Badge variant="outline" className="text-xs">
															{ca.membershipType}
														</Badge>
													</div>
												</TableCell>
												<TableCell>
													{ca.city}, {ca.state}
												</TableCell>
												<TableCell>
													<Badge
														className={
															VERIFICATION_STATUS_COLORS[
																ca.verificationStatus
															] || "bg-muted"
														}
													>
														{ca.verificationStatus}
													</Badge>
												</TableCell>
												<TableCell>
													<Badge
														className={
															AVAILABILITY_COLORS[ca.availability] || "bg-muted"
														}
													>
														{ca.availability?.replace(/_/g, " ")}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="text-sm">
														<span className="font-medium">
															{ca.activeCases}
														</span>{" "}
														active
														<br />
														<span className="text-muted-foreground">
															{ca.completedCases} completed
														</span>
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1">
														<Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
														{Number.parseFloat(ca.rating || "0").toFixed(1)}
													</div>
												</TableCell>
												<TableCell>
													<Button
														variant="ghost"
														size="icon"
														data-testid={`button-view-ca-${ca.id}`}
													>
														<Eye className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="performance" className="mt-6">
					<Card>
						<CardHeader>
							<CardTitle>CA Performance Dashboard</CardTitle>
							<CardDescription>
								Monitor CA workload and performance metrics
							</CardDescription>
						</CardHeader>
						<CardContent>
							{performanceLoading ? (
								<div className="flex justify-center py-8">
									<RefreshCw className="h-6 w-6 animate-spin" />
								</div>
							) : performance.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
									<h3 className="text-lg font-medium mb-1">
										No performance data
									</h3>
									<p>
										Performance metrics will appear once CAs start working on
										cases
									</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>CA Name</TableHead>
											<TableHead>Availability</TableHead>
											<TableHead>Active / Max Cases</TableHead>
											<TableHead>Utilization</TableHead>
											<TableHead>Completed</TableHead>
											<TableHead>Rating</TableHead>
											<TableHead>Response Time</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{performance.map((ca) => (
											<TableRow key={ca.id}>
												<TableCell>
													<p className="font-medium">{ca.name}</p>
												</TableCell>
												<TableCell>
													<Badge
														className={
															AVAILABILITY_COLORS[ca.availability] || "bg-muted"
														}
													>
														{ca.availability?.replace(/_/g, " ")}
													</Badge>
												</TableCell>
												<TableCell>
													{ca.activeCases} / {ca.maxCases}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2 min-w-[120px]">
														<Progress
															value={ca.utilizationRate}
															className="h-2 flex-1"
														/>
														<span className="text-sm">
															{ca.utilizationRate}%
														</span>
													</div>
												</TableCell>
												<TableCell>{ca.completedCases}</TableCell>
												<TableCell>
													<div className="flex items-center gap-1">
														<Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
														{ca.rating.toFixed(1)}
													</div>
												</TableCell>
												<TableCell>{ca.responseTime}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{verifyAction === "approve"
								? "Approve CA Application"
								: "Reject CA Application"}
						</DialogTitle>
						<DialogDescription>
							{verifyAction === "approve"
								? "This CA will be able to accept tax cases once approved."
								: "Please provide a reason for rejection."}
						</DialogDescription>
					</DialogHeader>

					{selectedCA && (
						<div className="space-y-4">
							<div className="p-4 bg-muted rounded-lg space-y-2">
								<p className="font-medium">{selectedCA.name}</p>
								<p className="text-sm text-muted-foreground">
									{selectedCA.email}
								</p>
								<div className="flex items-center gap-2 text-sm">
									<Badge variant="outline">{selectedCA.icaiNumber}</Badge>
									<Badge variant="outline">{selectedCA.membershipType}</Badge>
								</div>
							</div>

							{verifyAction === "reject" && (
								<div className="space-y-2">
									<label className="text-sm font-medium">
										Rejection Reason
									</label>
									<Textarea
										placeholder="Enter reason for rejection..."
										value={rejectionReason}
										onChange={(e) => setRejectionReason(e.target.value)}
										data-testid="input-rejection-reason"
									/>
								</div>
							)}
						</div>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowVerifyDialog(false)}
						>
							Cancel
						</Button>
						<Button
							variant={verifyAction === "approve" ? "default" : "destructive"}
							onClick={handleVerify}
							disabled={verifyMutation.isPending}
							data-testid="button-confirm-verify"
						>
							{verifyMutation.isPending ? (
								<RefreshCw className="h-4 w-4 animate-spin mr-2" />
							) : verifyAction === "approve" ? (
								<CheckCircle className="h-4 w-4 mr-2" />
							) : (
								<XCircle className="h-4 w-4 mr-2" />
							)}
							{verifyAction === "approve" ? "Approve" : "Reject"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
