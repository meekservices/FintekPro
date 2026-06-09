import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import {
	BarChart3,
	Briefcase,
	Calendar,
	CheckCircle2,
	Clock,
	FileText,
	IndianRupee,
	Star,
	TrendingUp,
	User,
	Users,
	AlertCircle,
	Play,
	Eye,
	MessageSquare,
	Upload,
	RefreshCw,
	Settings,
	Award,
	Target,
	Shield as LucideShield,
	UserPlus,
	Copy,
	Link2,
	CheckCircle,
} from "lucide-react";

interface DashboardStats {
	activeCases: number;
	completedCases: number;
	pendingCases: number;
	avgRating: number;
	totalEarnings: number;
	thisMonthEarnings: number;
	casesByType: Record<string, number>;
}

interface CAProfile {
	id: string;
	name: string;
	email: string;
	icaiNumber: string;
	membershipType: string;
	specializations: string[];
	city: string;
	state: string;
	availability: string;
	maxCases: number;
	verificationStatus: string;
}

interface Case {
	id: string;
	caseNumber: string;
	clientName: string;
	clientEmail: string;
	caseType: string;
	itrFormType?: string;
	status: string;
	priority: string;
	createdAt: string;
	dueDate?: string;
	fee: number;
	progress: number;
}

const AVAILABILITY_OPTIONS = [
	{
		value: "available",
		label: "Available",
		color:
			"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
	},
	{
		value: "busy",
		label: "Busy",
		color:
			"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
	},
	{
		value: "on_leave",
		label: "On Leave",
		color:
			"bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
	},
	{
		value: "unavailable",
		label: "Unavailable",
		color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
	},
];

const STATUS_COLORS: Record<string, string> = {
	initiated: "bg-muted text-muted-foreground",
	documents_pending:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
	documents_received:
		"bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
	under_review:
		"bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
	ca_assigned:
		"bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
	processing:
		"bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300",
	filed:
		"bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
	acknowledged:
		"bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
	completed:
		"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
};

const PRIORITY_COLORS: Record<string, string> = {
	low: "bg-muted text-muted-foreground",
	normal: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
	high: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
	urgent: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

export default function CADashboard() {
	const { toast } = useToast();
	const [, setLocation] = useLocation();
	const queryClient = useQueryClient();
	const { user, isLoading: authLoading } = useAuth();
	const [activeTab, setActiveTab] = useState(() => {
		if (typeof window !== "undefined") {
			const p = new URLSearchParams(window.location.search).get("tab");
			return p || "overview";
		}
		return "overview";
	});
	const [statusFilter, setStatusFilter] = useState("all");
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteName, setInviteName] = useState("");
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteMobile, setInviteMobile] = useState("");
	const [inviteLink, setInviteLink] = useState("");
	const linkRef = useRef<HTMLInputElement>(null);

	const { data: caPartnerData } = useQuery<{
		success: boolean;
		partnerId: string;
	}>({
		queryKey: ["/api/ca/my-profile"],
		enabled: !!user,
	});

	const partnerId = caPartnerData?.partnerId || "";

	const { data: dashboardData, isLoading } = useQuery<{
		success: boolean;
		profile: CAProfile;
		stats: DashboardStats;
	}>({
		queryKey: [`/api/ca/dashboard/${partnerId}`],
		enabled: !!partnerId,
	});

	const { data: casesData, isLoading: casesLoading } = useQuery<{
		success: boolean;
		cases: Case[];
	}>({
		queryKey: [`/api/ca/cases/${partnerId}`, statusFilter],
		enabled: !!partnerId,
	});

	const { data: clientsData, isLoading: clientsLoading } = useQuery<{
		success: boolean;
		clients: {
			clientId: string;
			name: string;
			email: string;
			totalCases: number;
			activeCases: number;
			completedCases: number;
			totalFees: number;
			latestStatus: string;
			joinedAt: string;
		}[];
		totalCases: number;
	}>({
		queryKey: [`/api/ca/clients/${partnerId}`],
		enabled: !!partnerId,
	});

	const inviteMutation = useMutation({
		mutationFn: async (data: {
			name: string;
			email: string;
			mobile: string;
		}) => {
			return await apiRequest("/api/ca/clients/invite", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: (data: any) => {
			setInviteLink(data.inviteLink || "");
			toast({
				title: "Invite Link Ready",
				description: "Share this link with your client to get started.",
			});
		},
		onError: () => {
			toast({
				title: "Failed",
				description: "Could not generate invite link. Try again.",
				variant: "destructive",
			});
		},
	});

	const updateAvailabilityMutation = useMutation({
		mutationFn: async (availability: string) => {
			return await apiRequest(`/api/ca/availability/${partnerId}`, {
				method: "PATCH",
				body: JSON.stringify({ availability }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [`/api/ca/dashboard/${partnerId}`],
			});
			toast({
				title: "Availability Updated",
				description: "Your availability status has been updated.",
			});
		},
		onError: () => {
			toast({
				title: "Update Failed",
				description: "Failed to update availability. Please try again.",
				variant: "destructive",
			});
		},
	});

	const profile = dashboardData?.profile;
	const stats = dashboardData?.stats || {
		activeCases: 0,
		completedCases: 0,
		pendingCases: 0,
		avgRating: 5.0,
		totalEarnings: 0,
		thisMonthEarnings: 0,
		casesByType: {},
	};
	const cases = casesData?.cases || [];

	const utilizationRate = profile
		? Math.round((stats.activeCases / (profile.maxCases || 50)) * 100)
		: 0;

	if (authLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
			</div>
		);
	}

	if (!user) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-4">
				<LucideShield className="h-16 w-16 text-muted-foreground" />
				<h2 className="text-xl font-semibold text-muted-foreground">
					Authentication Required
				</h2>
				<p className="text-muted-foreground">
					Please log in to access your CA Dashboard
				</p>
				<Button onClick={() => setLocation("/login")}>Go to Login</Button>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-muted">
			<div className="border-b bg-card">
				<div className="max-w-7xl mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<Avatar className="h-12 w-12">
								<AvatarFallback className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 font-semibold">
									{profile?.name
										?.split(" ")
										.map((n) => n[0])
										.join("") || "CA"}
								</AvatarFallback>
							</Avatar>
							<div>
								<h1 className="text-xl font-bold text-foreground">
									{profile?.name || "CA Dashboard"}
								</h1>
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<span>{profile?.icaiNumber}</span>
									<span>•</span>
									<Badge variant="outline">{profile?.membershipType}</Badge>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-3">
							<Select
								value={profile?.availability || "available"}
								onValueChange={(value) =>
									updateAvailabilityMutation.mutate(value)
								}
							>
								<SelectTrigger
									className="w-[150px]"
									data-testid="select-availability"
								>
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									{AVAILABILITY_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											<div className="flex items-center gap-2">
												<div
													className={`w-2 h-2 rounded-full ${option.color.split(" ")[0]}`}
												/>
												{option.label}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Button
								variant="outline"
								size="icon"
								data-testid="button-settings"
							>
								<Settings className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 py-6">
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<ScrollableTabsList>
						<TabsTrigger value="overview" data-testid="tab-overview">
							<BarChart3 className="h-4 w-4 mr-2" />
							Overview
						</TabsTrigger>
						<TabsTrigger value="cases" data-testid="tab-cases">
							<Briefcase className="h-4 w-4 mr-2" />
							My Cases
						</TabsTrigger>
						<TabsTrigger value="earnings" data-testid="tab-earnings">
							<IndianRupee className="h-4 w-4 mr-2" />
							Earnings
						</TabsTrigger>
						<TabsTrigger value="performance" data-testid="tab-performance">
							<TrendingUp className="h-4 w-4 mr-2" />
							Performance
						</TabsTrigger>
						<TabsTrigger value="clients" data-testid="tab-clients">
							<Users className="h-4 w-4 mr-2" />
							My Clients
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent value="overview" className="mt-6 space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Active Cases
									</CardTitle>
									<Briefcase className="h-4 w-4 text-blue-600" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">{stats.activeCases}</div>
									<div className="flex items-center gap-2 mt-2">
										<Progress value={utilizationRate} className="h-2 flex-1" />
										<span className="text-xs text-muted-foreground">
											{utilizationRate}% capacity
										</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Completed This Month
									</CardTitle>
									<CheckCircle2 className="h-4 w-4 text-green-600" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{stats.completedCases}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										Total: {stats.completedCases} cases
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										This Month Earnings
									</CardTitle>
									<IndianRupee className="h-4 w-4 text-emerald-600" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										₹{stats.thisMonthEarnings.toLocaleString()}
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										Total: ₹{stats.totalEarnings.toLocaleString()}
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Average Rating
									</CardTitle>
									<Star className="h-4 w-4 text-yellow-500" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold flex items-center gap-1">
										{stats.avgRating.toFixed(1)}
										<Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										Based on client reviews
									</p>
								</CardContent>
							</Card>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle>Recent Cases</CardTitle>
									<CardDescription>
										Your most recent assigned cases
									</CardDescription>
								</CardHeader>
								<CardContent>
									{cases.length === 0 ? (
										<div className="text-center py-8 text-muted-foreground">
											<Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
											<p>No cases assigned yet</p>
										</div>
									) : (
										<div className="space-y-4">
											{cases.slice(0, 5).map((caseItem) => (
												<div
													key={caseItem.id}
													className="flex items-center justify-between p-3 border rounded-lg"
												>
													<div>
														<p className="font-medium">{caseItem.clientName}</p>
														<div className="flex items-center gap-2 text-sm text-muted-foreground">
															<span>{caseItem.caseType}</span>
															{caseItem.itrFormType && (
																<>
																	<span>•</span>
																	<span>{caseItem.itrFormType}</span>
																</>
															)}
														</div>
													</div>
													<div className="flex items-center gap-2">
														<Badge
															className={
																STATUS_COLORS[caseItem.status] || "bg-muted"
															}
														>
															{caseItem.status.replace(/_/g, " ")}
														</Badge>
														<Button
															variant="ghost"
															size="sm"
															data-testid={`button-view-case-${caseItem.id}`}
														>
															<Eye className="h-4 w-4" />
														</Button>
													</div>
												</div>
											))}
										</div>
									)}
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Your Specializations</CardTitle>
									<CardDescription>
										Areas where you provide services
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex flex-wrap gap-2">
										{profile?.specializations?.map((spec) => (
											<Badge
												key={spec}
												variant="secondary"
												className="capitalize"
											>
												{spec.replace(/_/g, " ")}
											</Badge>
										)) || (
											<p className="text-muted-foreground">
												No specializations set
											</p>
										)}
									</div>

									<Separator className="my-4" />

									<div className="space-y-3">
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">Location</span>
											<span>
												{profile?.city}, {profile?.state}
											</span>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">
												Max Cases/Month
											</span>
											<span>{profile?.maxCases || 50}</span>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">
												Verification Status
											</span>
											<Badge
												variant={
													profile?.verificationStatus === "verified"
														? "default"
														: "secondary"
												}
											>
												{profile?.verificationStatus || "pending"}
											</Badge>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="cases" className="mt-6">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>My Cases</CardTitle>
										<CardDescription>
											All your assigned tax cases
										</CardDescription>
									</div>
									<Select value={statusFilter} onValueChange={setStatusFilter}>
										<SelectTrigger
											className="w-[180px]"
											data-testid="select-case-filter"
										>
											<SelectValue placeholder="Filter by status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Cases</SelectItem>
											<SelectItem value="active">Active</SelectItem>
											<SelectItem value="pending">Pending Review</SelectItem>
											<SelectItem value="completed">Completed</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</CardHeader>
							<CardContent>
								{casesLoading ? (
									<div className="flex justify-center py-8">
										<RefreshCw className="h-6 w-6 animate-spin" />
									</div>
								) : cases.length === 0 ? (
									<div className="text-center py-12 text-muted-foreground">
										<Briefcase className="h-16 w-16 mx-auto mb-4 opacity-50" />
										<h3 className="text-lg font-medium mb-1">No cases found</h3>
										<p>Cases will appear here once assigned to you</p>
									</div>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Client</TableHead>
												<TableHead>Case Type</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Priority</TableHead>
												<TableHead>Due Date</TableHead>
												<TableHead>Fee</TableHead>
												<TableHead>Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{cases.map((caseItem) => (
												<TableRow key={caseItem.id}>
													<TableCell>
														<div>
															<p className="font-medium">
																{caseItem.clientName}
															</p>
															<p className="text-sm text-muted-foreground">
																{caseItem.clientEmail}
															</p>
														</div>
													</TableCell>
													<TableCell>
														<div>
															<p>{caseItem.caseType}</p>
															{caseItem.itrFormType && (
																<p className="text-sm text-muted-foreground">
																	{caseItem.itrFormType}
																</p>
															)}
														</div>
													</TableCell>
													<TableCell>
														<Badge
															className={
																STATUS_COLORS[caseItem.status] || "bg-muted"
															}
														>
															{caseItem.status.replace(/_/g, " ")}
														</Badge>
													</TableCell>
													<TableCell>
														<Badge
															className={
																PRIORITY_COLORS[caseItem.priority] || "bg-muted"
															}
														>
															{caseItem.priority}
														</Badge>
													</TableCell>
													<TableCell>
														{caseItem.dueDate
															? new Date(caseItem.dueDate).toLocaleDateString()
															: "-"}
													</TableCell>
													<TableCell>
														₹{caseItem.fee?.toLocaleString() || 0}
													</TableCell>
													<TableCell>
														<div className="flex items-center gap-1">
															<Button
																variant="ghost"
																size="icon"
																title="View Details"
																data-testid={`button-view-${caseItem.id}`}
															>
																<Eye className="h-4 w-4" />
															</Button>
															<Button
																variant="ghost"
																size="icon"
																title="Messages"
																data-testid={`button-message-${caseItem.id}`}
															>
																<MessageSquare className="h-4 w-4" />
															</Button>
															<Button
																variant="ghost"
																size="icon"
																title="Upload Document"
																data-testid={`button-upload-${caseItem.id}`}
															>
																<Upload className="h-4 w-4" />
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

					<TabsContent value="earnings" className="mt-6">
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							<Card className="lg:col-span-2">
								<CardHeader>
									<CardTitle>Earnings Summary</CardTitle>
									<CardDescription>
										Your commission earnings from completed cases
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
										<div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
											<p className="text-sm text-muted-foreground">
												This Month
											</p>
											<p className="text-2xl font-bold text-green-600">
												₹{stats.thisMonthEarnings.toLocaleString()}
											</p>
										</div>
										<div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
											<p className="text-sm text-muted-foreground">
												Total Earnings
											</p>
											<p className="text-2xl font-bold text-blue-600">
												₹{stats.totalEarnings.toLocaleString()}
											</p>
										</div>
										<div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
											<p className="text-sm text-muted-foreground">Pending</p>
											<p className="text-2xl font-bold text-yellow-600">₹0</p>
										</div>
										<div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
											<p className="text-sm text-muted-foreground">
												Avg per Case
											</p>
											<p className="text-2xl font-bold text-purple-600">
												₹
												{stats.completedCases > 0
													? Math.round(
															stats.totalEarnings / stats.completedCases,
														).toLocaleString()
													: 0}
											</p>
										</div>
									</div>

									<div className="text-center py-8 text-muted-foreground border rounded-lg">
										<BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
										<p>Earnings chart will be displayed here</p>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Fee Structure</CardTitle>
									<CardDescription>
										Your base fees by service type
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex justify-between items-center p-3 bg-muted rounded-lg">
										<span>ITR-1</span>
										<span className="font-semibold">₹500</span>
									</div>
									<div className="flex justify-between items-center p-3 bg-muted rounded-lg">
										<span>ITR-2</span>
										<span className="font-semibold">₹1,500</span>
									</div>
									<div className="flex justify-between items-center p-3 bg-muted rounded-lg">
										<span>ITR-3</span>
										<span className="font-semibold">₹3,000</span>
									</div>
									<div className="flex justify-between items-center p-3 bg-muted rounded-lg">
										<span>ITR-4</span>
										<span className="font-semibold">₹2,000</span>
									</div>
									<Separator />
									<Button
										variant="outline"
										className="w-full"
										data-testid="button-update-fees"
									>
										Update Fee Structure
									</Button>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="performance" className="mt-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle>Performance Metrics</CardTitle>
									<CardDescription>
										Your key performance indicators
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>Case Completion Rate</span>
											<span className="font-medium">
												{stats.activeCases + stats.completedCases > 0
													? Math.round(
															(stats.completedCases /
																(stats.activeCases + stats.completedCases)) *
																100,
														)
													: 100}
												%
											</span>
										</div>
										<Progress
											value={
												stats.activeCases + stats.completedCases > 0
													? (stats.completedCases /
															(stats.activeCases + stats.completedCases)) *
														100
													: 100
											}
											className="h-2"
										/>
									</div>

									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>Capacity Utilization</span>
											<span className="font-medium">{utilizationRate}%</span>
										</div>
										<Progress value={utilizationRate} className="h-2" />
									</div>

									<div className="space-y-2">
										<div className="flex justify-between text-sm">
											<span>Client Satisfaction</span>
											<span className="font-medium">
												{((stats.avgRating / 5) * 100).toFixed(0)}%
											</span>
										</div>
										<Progress
											value={(stats.avgRating / 5) * 100}
											className="h-2"
										/>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Achievements</CardTitle>
									<CardDescription>Your milestones and badges</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 gap-4">
										<div className="flex items-center gap-3 p-3 border rounded-lg">
											<div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
												<Star className="h-5 w-5 text-yellow-600" />
											</div>
											<div>
												<p className="font-medium">Top Rated</p>
												<p className="text-xs text-muted-foreground">
													5.0 Rating
												</p>
											</div>
										</div>

										<div className="flex items-center gap-3 p-3 border rounded-lg">
											<div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
												<CheckCircle2 className="h-5 w-5 text-green-600" />
											</div>
											<div>
												<p className="font-medium">Verified</p>
												<p className="text-xs text-muted-foreground">
													ICAI Verified
												</p>
											</div>
										</div>

										<div className="flex items-center gap-3 p-3 border rounded-lg">
											<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
												<Target className="h-5 w-5 text-blue-600" />
											</div>
											<div>
												<p className="font-medium">Goal Setter</p>
												<p className="text-xs text-muted-foreground">
													{stats.completedCases}+ Cases
												</p>
											</div>
										</div>

										<div className="flex items-center gap-3 p-3 border rounded-lg">
											<div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
												<Award className="h-5 w-5 text-purple-600" />
											</div>
											<div>
												<p className="font-medium">Expert</p>
												<p className="text-xs text-muted-foreground">
													{profile?.membershipType || "ACA"}
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>
					<TabsContent value="clients" className="mt-6 space-y-4">
						{/* Header row */}
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-xl font-semibold">My Clients</h2>
								<p className="text-sm text-muted-foreground mt-0.5">
									Clients whose tax cases are assigned to you
								</p>
							</div>
							<Dialog
								open={inviteOpen}
								onOpenChange={(v) => {
									setInviteOpen(v);
									if (!v) {
										setInviteLink("");
										setInviteName("");
										setInviteEmail("");
										setInviteMobile("");
									}
								}}
							>
								<DialogTrigger asChild>
									<Button className="gap-2" data-testid="btn-invite-client">
										<UserPlus className="h-4 w-4" />
										Invite Client
									</Button>
								</DialogTrigger>
								<DialogContent className="sm:max-w-md">
									<DialogHeader>
										<DialogTitle className="flex items-center gap-2">
											<UserPlus className="h-5 w-5 text-violet-600" />
											Invite a Client
										</DialogTitle>
									</DialogHeader>

									{!inviteLink ? (
										<div className="space-y-4 pt-2">
											<p className="text-sm text-muted-foreground">
												Generate a personalised invite link to share with your
												client. They'll land directly on the ITR filing page
												attributed to you.
											</p>
											<div className="space-y-3">
												<div>
													<Label htmlFor="invite-name">Client Name</Label>
													<Input
														id="invite-name"
														placeholder="Rajesh Kumar"
														value={inviteName}
														onChange={(e) => setInviteName(e.target.value)}
														data-testid="input-invite-name"
													/>
												</div>
												<div>
													<Label htmlFor="invite-email">Email Address</Label>
													<Input
														id="invite-email"
														type="email"
														placeholder="rajesh@example.com"
														value={inviteEmail}
														onChange={(e) => setInviteEmail(e.target.value)}
														data-testid="input-invite-email"
													/>
												</div>
												<div>
													<Label htmlFor="invite-mobile">
														Mobile Number (optional)
													</Label>
													<Input
														id="invite-mobile"
														placeholder="9876543210"
														value={inviteMobile}
														onChange={(e) => setInviteMobile(e.target.value)}
														data-testid="input-invite-mobile"
													/>
												</div>
											</div>
											<Button
												className="w-full gap-2"
												disabled={
													(!inviteEmail && !inviteMobile) ||
													inviteMutation.isPending
												}
												onClick={() =>
													inviteMutation.mutate({
														name: inviteName,
														email: inviteEmail,
														mobile: inviteMobile,
													})
												}
												data-testid="btn-generate-invite"
											>
												{inviteMutation.isPending ? (
													<RefreshCw className="h-4 w-4 animate-spin" />
												) : (
													<Link2 className="h-4 w-4" />
												)}
												Generate Invite Link
											</Button>
										</div>
									) : (
										<div className="space-y-4 pt-2">
											<div className="flex items-center gap-2 text-green-600 dark:text-green-400">
												<CheckCircle className="h-5 w-5" />
												<span className="font-medium">Invite link ready!</span>
											</div>
											<p className="text-sm text-muted-foreground">
												Share this link with{" "}
												<strong>
													{inviteName || inviteEmail || inviteMobile}
												</strong>
												. When they sign up and file through this link, the case
												will be tracked under your CA dashboard.
											</p>
											<div className="flex gap-2">
												<Input
													ref={linkRef}
													value={inviteLink}
													readOnly
													className="font-mono text-xs"
													data-testid="input-invite-link"
												/>
												<Button
													variant="outline"
													size="icon"
													onClick={() => {
														navigator.clipboard.writeText(inviteLink);
														toast({
															title: "Copied!",
															description: "Invite link copied to clipboard.",
														});
													}}
													data-testid="btn-copy-link"
												>
													<Copy className="h-4 w-4" />
												</Button>
											</div>
											<Button
												variant="outline"
												className="w-full"
												onClick={() => {
													setInviteLink("");
													setInviteName("");
													setInviteEmail("");
													setInviteMobile("");
												}}
											>
												Invite Another Client
											</Button>
										</div>
									)}
								</DialogContent>
							</Dialog>
						</div>

						{/* Summary cards */}
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<Card>
								<CardContent className="pt-5">
									<p className="text-sm text-muted-foreground">Total Clients</p>
									<p className="text-3xl font-bold mt-1">
										{clientsData?.clients?.length ?? 0}
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-5">
									<p className="text-sm text-muted-foreground">Active Cases</p>
									<p className="text-3xl font-bold mt-1 text-blue-600 dark:text-blue-400">
										{clientsData?.clients?.reduce(
											(s, c) => s + c.activeCases,
											0,
										) ?? 0}
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-5">
									<p className="text-sm text-muted-foreground">
										Total Fees Billed
									</p>
									<p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
										₹
										{(
											clientsData?.clients?.reduce(
												(s, c) => s + c.totalFees,
												0,
											) ?? 0
										).toLocaleString("en-IN")}
									</p>
								</CardContent>
							</Card>
						</div>

						{/* Client table */}
						{clientsLoading ? (
							<div className="flex justify-center py-12">
								<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : !clientsData?.clients?.length ? (
							<Card>
								<CardContent className="py-16 text-center">
									<Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<h3 className="font-semibold text-lg mb-2">No clients yet</h3>
									<p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
										Use the "Invite Client" button above to share a personalised
										link. When a client files through your link, they'll appear
										here.
									</p>
									<Button onClick={() => setInviteOpen(true)} className="gap-2">
										<UserPlus className="h-4 w-4" />
										Invite Your First Client
									</Button>
								</CardContent>
							</Card>
						) : (
							<Card>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Client</TableHead>
											<TableHead className="text-center">Total Cases</TableHead>
											<TableHead className="text-center">Active</TableHead>
											<TableHead className="text-center">Completed</TableHead>
											<TableHead className="text-right">Fees Billed</TableHead>
											<TableHead>Latest Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{clientsData.clients.map((client) => (
											<TableRow key={client.clientId}>
												<TableCell>
													<div className="flex items-center gap-3">
														<Avatar className="h-8 w-8">
															<AvatarFallback className="text-xs bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">
																{(client.name || "C").charAt(0).toUpperCase()}
															</AvatarFallback>
														</Avatar>
														<div>
															<p className="font-medium text-sm">
																{client.name}
															</p>
															<p className="text-xs text-muted-foreground">
																{client.email}
															</p>
														</div>
													</div>
												</TableCell>
												<TableCell className="text-center font-medium">
													{client.totalCases}
												</TableCell>
												<TableCell className="text-center">
													<Badge
														variant="secondary"
														className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
													>
														{client.activeCases}
													</Badge>
												</TableCell>
												<TableCell className="text-center">
													<Badge
														variant="secondary"
														className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
													>
														{client.completedCases}
													</Badge>
												</TableCell>
												<TableCell className="text-right font-medium">
													₹{client.totalFees.toLocaleString("en-IN")}
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className="capitalize text-xs"
													>
														{(client.latestStatus || "").replace(/_/g, " ")}
													</Badge>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</Card>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
