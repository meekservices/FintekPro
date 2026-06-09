import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	Users,
	UserPlus,
	Search,
	Filter,
	Eye,
	Phone,
	Mail,
	MapPin,
	Calendar,
	Shield as LucideShield,
	CheckCircle2,
	AlertTriangle,
	Clock,
	Upload,
	FileText,
	BarChart3,
	TrendingUp,
	Wallet,
	Target,
	ArrowRight,
	Plus,
	ExternalLink,
	RefreshCw,
	Lock,
	Unlock,
	Send,
	AlertCircle,
	XCircle,
	ChevronRight,
	Copy,
	Link2,
	Building2,
	User,
} from "lucide-react";

interface Client {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	mobile: string;
	panNumber?: string;
	kycStatus: "pending" | "basic" | "enhanced" | "accredited";
	riskProfile?: string;
	clientCategory: "retail" | "hni" | "shni" | "bhni" | "corporate";
	totalPortfolioValue?: number;
	lastActivityDate?: string;
	createdAt: string;
	assignedAgentId?: string;
	isActive: boolean;
}

interface PortfolioUpload {
	id: string;
	clientId: string;
	uploadType: string;
	fileName: string;
	parsingStatus: string;
	confirmationStatus: string;
	parsedSummary?: {
		totalValue: number;
		holdingsCount: number;
		assetBreakdown: Record<string, number>;
	};
	createdAt: string;
}

interface AdvisorySession {
	id: string;
	clientId: string;
	sessionPurpose: string;
	workflowState: string;
	createdAt: string;
	updatedAt: string;
}

interface OnboardingInvitation {
	id: string;
	referralCode: string;
	inviterId: string;
	inviterType: string;
	inviterName: string | null;
	clientEmail: string | null;
	clientMobile: string | null;
	clientName: string | null;
	suggestedEntityType: string | null;
	suggestedMode: string | null;
	status: string;
	currentStep: string | null;
	completedSteps: string[];
	progressPercentage: number;
	createdAt: string;
	expiresAt: string | null;
}

const INVITATION_STATUS_COLORS: Record<string, string> = {
	pending: "bg-muted text-muted-foreground",
	sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	opened:
		"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
	started:
		"bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
	in_progress: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
	completed:
		"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	expired: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const ENTITY_TYPE_OPTIONS = [
	{ value: "individual", label: "Individual", icon: User },
	{ value: "company", label: "Company", icon: Building2 },
	{ value: "huf", label: "HUF", icon: Users },
	{ value: "firm", label: "Firm/LLP", icon: Building2 },
	{ value: "trust", label: "Trust/AOP", icon: Building2 },
];

const KYC_STATUS_COLORS: Record<string, string> = {
	pending: "bg-muted text-muted-foreground",
	basic: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	enhanced: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	accredited:
		"bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

const CLIENT_CATEGORY_LABELS: Record<string, string> = {
	retail: "Retail",
	hni: "HNI",
	shni: "Super HNI",
	bhni: "BHNI",
	corporate: "Corporate",
};

const WORKFLOW_STATE_LABELS: Record<string, string> = {
	purpose_selection: "Purpose Selection",
	suitability_check: "Suitability Check",
	optimization: "Optimization",
	draft_review: "Draft Review",
	client_sharing: "Shared with Client",
	client_action: "Awaiting Client Action",
	execution: "Execution",
	completed: "Completed",
	cancelled: "Cancelled",
};

export default function AgentClientsPage() {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState("all");
	const [selectedClient, setSelectedClient] = useState<Client | null>(null);
	const [showPortfolioUploadDialog, setShowPortfolioUploadDialog] =
		useState(false);
	const [showStartSessionDialog, setShowStartSessionDialog] = useState(false);
	const [selectedSessionPurpose, setSelectedSessionPurpose] = useState("");
	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const [showInviteDialog, setShowInviteDialog] = useState(false);
	const [inviteClientName, setInviteClientName] = useState("");
	const [inviteClientEmail, setInviteClientEmail] = useState("");
	const [inviteClientMobile, setInviteClientMobile] = useState("");
	const [inviteEntityType, setInviteEntityType] = useState("");
	const [inviteMode, setInviteMode] = useState("smart");
	const [inviteNotes, setInviteNotes] = useState("");
	const [generatedReferralLink, setGeneratedReferralLink] = useState("");
	const [showInvitationsTab, setShowInvitationsTab] = useState(false);

	const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
		queryKey: ["/api/agent/clients"],
	});

	const { data: pendingUploads } = useQuery<PortfolioUpload[]>({
		queryKey: ["/api/agent/portfolio-uploads/pending"],
		enabled: !!selectedClient,
	});

	const { data: clientSessions } = useQuery<AdvisorySession[]>({
		queryKey: ["/api/agent/advisory-sessions", selectedClient?.id],
		enabled: !!selectedClient,
	});

	const { data: invitationsData, isLoading: invitationsLoading } = useQuery<{
		invitations: OnboardingInvitation[];
		total: number;
	}>({
		queryKey: ["/api/agent/onboarding-invitations"],
	});

	const { data: invitationStats } = useQuery<{ stats: Record<string, number> }>(
		{
			queryKey: ["/api/agent/onboarding-invitations/stats"],
		},
	);

	const createInvitation = useMutation({
		mutationFn: async (data: {
			clientName: string;
			clientEmail?: string;
			clientMobile?: string;
			suggestedEntityType?: string;
			suggestedMode?: string;
			notes?: string;
		}) => {
			const response = await apiRequest("/api/agent/onboarding-invitations", {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
			return response;
		},
		onSuccess: (data: any) => {
			toast({
				title: "Invitation Created",
				description: "Client invitation has been generated",
			});
			setGeneratedReferralLink(
				data.referralLink ||
					`${window.location.origin}/onboarding?ref=${data.invitation.referralCode}`,
			);
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/onboarding-invitations"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/onboarding-invitations/stats"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to create invitation",
				variant: "destructive",
			});
		},
	});

	const resendInvitation = useMutation({
		mutationFn: async (id: string) => {
			return apiRequest(`/api/agent/onboarding-invitations/${id}/resend`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			toast({
				title: "Invitation Resent",
				description: "The invitation has been resent",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/onboarding-invitations"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to resend invitation",
				variant: "destructive",
			});
		},
	});

	const startAdvisorySession = useMutation({
		mutationFn: async (data: { clientId: string; sessionPurpose: string }) => {
			return apiRequest("/api/agent/advisory-sessions", {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			toast({
				title: "Success",
				description: "Advisory session started successfully",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/advisory-sessions"],
			});
			setShowStartSessionDialog(false);
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to start advisory session",
				variant: "destructive",
			});
		},
	});

	const uploadPortfolio = useMutation({
		mutationFn: async (data: FormData) => {
			return apiRequest("/api/agent/portfolio-upload", {
				method: "POST",
				body: data,
			});
		},
		onSuccess: () => {
			toast({
				title: "Success",
				description: "Portfolio uploaded. Client confirmation required.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/portfolio-uploads"],
			});
			setShowPortfolioUploadDialog(false);
			setUploadFile(null);
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to upload portfolio",
				variant: "destructive",
			});
		},
	});

	const filteredClients =
		clients?.filter((client) => {
			const matchesSearch =
				!searchQuery ||
				client.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				client.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				client.mobile?.includes(searchQuery) ||
				client.panNumber?.toLowerCase().includes(searchQuery.toLowerCase());

			if (activeTab === "all") return matchesSearch;
			if (activeTab === "pending_kyc")
				return matchesSearch && client.kycStatus === "pending";
			if (activeTab === "active")
				return (
					matchesSearch && client.isActive && client.kycStatus !== "pending"
				);
			if (activeTab === "hni")
				return (
					matchesSearch &&
					["hni", "shni", "bhni"].includes(client.clientCategory)
				);
			if (activeTab === "corporate")
				return matchesSearch && client.clientCategory === "corporate";
			return matchesSearch;
		}) || [];

	const handleStartSession = () => {
		if (!selectedClient || !selectedSessionPurpose) return;
		startAdvisorySession.mutate({
			clientId: selectedClient.id,
			sessionPurpose: selectedSessionPurpose,
		});
	};

	const handlePortfolioUpload = () => {
		if (!selectedClient || !uploadFile) return;
		const formData = new FormData();
		formData.append("file", uploadFile);
		formData.append("clientId", selectedClient.id);
		uploadPortfolio.mutate(formData);
	};

	const formatCurrency = (amount: number | undefined) => {
		if (!amount) return "₹0";
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const handleCreateInvitation = () => {
		if (!inviteClientEmail && !inviteClientMobile) {
			toast({
				title: "Error",
				description: "Please provide either email or mobile number",
				variant: "destructive",
			});
			return;
		}

		createInvitation.mutate({
			clientName: inviteClientName,
			clientEmail: inviteClientEmail || undefined,
			clientMobile: inviteClientMobile || undefined,
			suggestedEntityType: inviteEntityType || undefined,
			suggestedMode: inviteMode,
			notes: inviteNotes || undefined,
		});
	};

	const handleCopyReferralLink = () => {
		navigator.clipboard.writeText(generatedReferralLink);
		toast({
			title: "Copied!",
			description: "Referral link copied to clipboard",
		});
	};

	const resetInviteForm = () => {
		setInviteClientName("");
		setInviteClientEmail("");
		setInviteClientMobile("");
		setInviteEntityType("");
		setInviteMode("smart");
		setInviteNotes("");
		setGeneratedReferralLink("");
	};

	const invitations = invitationsData?.invitations || [];

	if (clientsLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30">
				<div className="container mx-auto p-6">
					<div className="flex items-center justify-center h-64">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
						<div className="text-lg">Loading clients...</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30"
			data-testid="agent-clients-page"
		>
			<div className="space-y-4 sm:space-y-6">
				<div className="flex items-start sm:items-center justify-between flex-wrap gap-3 mb-4 sm:mb-6">
					<div>
						<h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
							<Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
							Client Management
						</h1>
						<p className="text-muted-foreground text-sm sm:text-base">
							Manage your clients, portfolios, and advisory sessions
						</p>
					</div>
					<div className="flex items-center gap-2 sm:gap-3">
						<Button
							variant="outline"
							className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
							onClick={() => setShowInvitationsTab(true)}
							data-testid="button-view-invitations"
						>
							<Link2 className="h-4 w-4 mr-2" />
							Invitations ({invitationStats?.stats?.total || 0})
						</Button>
						<Button
							className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md hover:shadow-lg transition-all duration-200"
							onClick={() => {
								resetInviteForm();
								setShowInviteDialog(true);
							}}
							data-testid="button-add-client"
						>
							<UserPlus className="h-4 w-4 mr-2" />
							Onboard New Client
						</Button>
					</div>
				</div>

				<div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
							<CardTitle className="text-xs sm:text-sm font-medium">
								Total Clients
							</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
							<div className="text-xl sm:text-2xl font-bold">
								{clients?.length || 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">KYC Pending</CardTitle>
							<Clock className="h-4 w-4 text-yellow-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-yellow-600">
								{clients?.filter((c) => c.kycStatus === "pending").length || 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								HNI+ Clients
							</CardTitle>
							<TrendingUp className="h-4 w-4 text-green-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600">
								{clients?.filter((c) =>
									["hni", "shni", "bhni"].includes(c.clientCategory),
								).length || 0}
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total AUM</CardTitle>
							<Wallet className="h-4 w-4 text-primary" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{formatCurrency(
									clients?.reduce(
										(sum, c) => sum + (c.totalPortfolioValue || 0),
										0,
									),
								)}
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<div className="lg:col-span-2">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle>My Clients</CardTitle>
									<div className="flex items-center gap-2">
										<div className="relative">
											<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												placeholder="Search clients..."
												className="pl-10 w-64"
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												data-testid="input-search-clients"
											/>
										</div>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<Tabs value={activeTab} onValueChange={setActiveTab}>
									<ScrollableTabsList>
										<TabsTrigger value="all" data-testid="tab-all-clients">
											All ({clients?.length || 0})
										</TabsTrigger>
										<TabsTrigger
											value="pending_kyc"
											data-testid="tab-pending-kyc"
										>
											Pending KYC (
											{clients?.filter((c) => c.kycStatus === "pending")
												.length || 0}
											)
										</TabsTrigger>
										<TabsTrigger
											value="active"
											data-testid="tab-active-clients"
										>
											Active
										</TabsTrigger>
										<TabsTrigger value="hni" data-testid="tab-hni-clients">
											HNI+
										</TabsTrigger>
										<TabsTrigger
											value="corporate"
											data-testid="tab-corporate-clients"
										>
											Corporate
										</TabsTrigger>
									</ScrollableTabsList>

									<TabsContent value={activeTab} className="mt-4">
										<div className="rounded-md border">
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Client</TableHead>
														<TableHead>Category</TableHead>
														<TableHead>KYC Status</TableHead>
														<TableHead>Portfolio Value</TableHead>
														<TableHead className="text-right">
															Actions
														</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{filteredClients.length === 0 ? (
														<TableRow>
															<TableCell
																colSpan={5}
																className="text-center py-8 text-muted-foreground"
															>
																No clients found
															</TableCell>
														</TableRow>
													) : (
														filteredClients.map((client) => (
															<TableRow
																key={client.id}
																className={`cursor-pointer ${selectedClient?.id === client.id ? "bg-muted" : ""}`}
																onClick={() => setSelectedClient(client)}
																data-testid={`row-client-${client.id}`}
															>
																<TableCell>
																	<div className="flex items-center gap-3">
																		<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
																			<span className="text-sm font-semibold text-primary">
																				{client.firstName?.[0]}
																				{client.lastName?.[0]}
																			</span>
																		</div>
																		<div>
																			<div className="font-medium">
																				{client.firstName} {client.lastName}
																			</div>
																			<div className="text-sm text-muted-foreground">
																				{client.email}
																			</div>
																		</div>
																	</div>
																</TableCell>
																<TableCell>
																	<Badge variant="outline">
																		{CLIENT_CATEGORY_LABELS[
																			client.clientCategory
																		] || client.clientCategory}
																	</Badge>
																</TableCell>
																<TableCell>
																	<Badge
																		className={
																			KYC_STATUS_COLORS[client.kycStatus]
																		}
																	>
																		{client.kycStatus === "pending" && (
																			<Clock className="h-3 w-3 mr-1" />
																		)}
																		{client.kycStatus === "basic" && (
																			<LucideShield className="h-3 w-3 mr-1" />
																		)}
																		{client.kycStatus === "enhanced" && (
																			<CheckCircle2 className="h-3 w-3 mr-1" />
																		)}
																		{client.kycStatus === "accredited" && (
																			<LucideShield className="h-3 w-3 mr-1" />
																		)}
																		{client.kycStatus.charAt(0).toUpperCase() +
																			client.kycStatus.slice(1)}
																	</Badge>
																</TableCell>
																<TableCell>
																	{formatCurrency(client.totalPortfolioValue)}
																</TableCell>
																<TableCell className="text-right">
																	<Button
																		variant="ghost"
																		size="sm"
																		className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-200 dark:hover:bg-indigo-950"
																		onClick={(e) => {
																			e.stopPropagation();
																			setSelectedClient(client);
																		}}
																		data-testid={`button-view-client-${client.id}`}
																	>
																		<Eye className="h-4 w-4 mr-1" />
																		View
																	</Button>
																</TableCell>
															</TableRow>
														))
													)}
												</TableBody>
											</Table>
										</div>
									</TabsContent>
								</Tabs>
							</CardContent>
						</Card>
					</div>

					<div className="space-y-4">
						{selectedClient ? (
							<>
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center justify-between">
											<span>Client Profile</span>
											<Button
												variant="ghost"
												size="sm"
												data-testid="button-edit-client"
											>
												<ExternalLink className="h-4 w-4" />
											</Button>
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="flex items-center gap-4">
											<div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
												<span className="text-xl font-bold text-primary">
													{selectedClient.firstName?.[0]}
													{selectedClient.lastName?.[0]}
												</span>
											</div>
											<div>
												<h3 className="text-lg font-semibold">
													{selectedClient.firstName} {selectedClient.lastName}
												</h3>
												<Badge
													className={
														KYC_STATUS_COLORS[selectedClient.kycStatus]
													}
												>
													{selectedClient.kycStatus.toUpperCase()} KYC
												</Badge>
											</div>
										</div>

										<Separator />

										<div className="space-y-3 text-sm">
											<div className="flex items-center gap-2">
												<Mail className="h-4 w-4 text-muted-foreground" />
												<span>{selectedClient.email}</span>
											</div>
											<div className="flex items-center gap-2">
												<Phone className="h-4 w-4 text-muted-foreground" />
												<span>{selectedClient.mobile}</span>
											</div>
											{selectedClient.panNumber && (
												<div className="flex items-center gap-2">
													<FileText className="h-4 w-4 text-muted-foreground" />
													<span>PAN: {selectedClient.panNumber}</span>
												</div>
											)}
										</div>

										<Separator />

										<div className="grid grid-cols-2 gap-4">
											<div>
												<p className="text-xs text-muted-foreground">
													Category
												</p>
												<p className="font-medium">
													{
														CLIENT_CATEGORY_LABELS[
															selectedClient.clientCategory
														]
													}
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">
													Risk Profile
												</p>
												<p className="font-medium">
													{selectedClient.riskProfile || "Not Set"}
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">
													Portfolio Value
												</p>
												<p className="font-medium">
													{formatCurrency(selectedClient.totalPortfolioValue)}
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">
													Last Activity
												</p>
												<p className="font-medium text-sm">
													{selectedClient.lastActivityDate
														? new Date(
																selectedClient.lastActivityDate,
															).toLocaleDateString()
														: "N/A"}
												</p>
											</div>
										</div>
									</CardContent>
									<CardFooter className="flex gap-2">
										<Button
											variant="outline"
											className="flex-1"
											onClick={() => setShowPortfolioUploadDialog(true)}
											data-testid="button-upload-portfolio"
										>
											<Upload className="h-4 w-4 mr-2" />
											Upload Portfolio
										</Button>
										<Button
											className="flex-1"
											onClick={() => setShowStartSessionDialog(true)}
											disabled={selectedClient.kycStatus === "pending"}
											data-testid="button-start-session"
										>
											<Target className="h-4 w-4 mr-2" />
											Start Advisory
										</Button>
									</CardFooter>
								</Card>

								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium flex items-center gap-2">
											<LucideShield className="h-4 w-4" />
											Product Eligibility
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-2 text-sm">
											{selectedClient.kycStatus === "pending" ? (
												<Alert variant="destructive">
													<AlertCircle className="h-4 w-4" />
													<AlertDescription>
														KYC required for all products
													</AlertDescription>
												</Alert>
											) : (
												<>
													<div className="flex items-center justify-between">
														<span>Mutual Funds</span>
														<CheckCircle2 className="h-4 w-4 text-green-500" />
													</div>
													<div className="flex items-center justify-between">
														<span>Bonds & FDs</span>
														<CheckCircle2 className="h-4 w-4 text-green-500" />
													</div>
													<div className="flex items-center justify-between">
														<span>Equity</span>
														{selectedClient.kycStatus === "basic" ? (
															<Lock className="h-4 w-4 text-yellow-500" />
														) : (
															<CheckCircle2 className="h-4 w-4 text-green-500" />
														)}
													</div>
													<div className="flex items-center justify-between">
														<span>PMS/AIF</span>
														{["enhanced", "accredited"].includes(
															selectedClient.kycStatus,
														) &&
														["hni", "shni", "bhni"].includes(
															selectedClient.clientCategory,
														) ? (
															<CheckCircle2 className="h-4 w-4 text-green-500" />
														) : (
															<Lock className="h-4 w-4 text-yellow-500" />
														)}
													</div>
													<div className="flex items-center justify-between">
														<span>Unlisted Shares</span>
														{selectedClient.kycStatus === "accredited" ? (
															<CheckCircle2 className="h-4 w-4 text-green-500" />
														) : (
															<Lock className="h-4 w-4 text-yellow-500" />
														)}
													</div>
												</>
											)}
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium flex items-center gap-2">
											<BarChart3 className="h-4 w-4" />
											Active Sessions
										</CardTitle>
									</CardHeader>
									<CardContent>
										{clientSessions && clientSessions.length > 0 ? (
											<div className="space-y-2">
												{clientSessions.map((session) => (
													<div
														key={session.id}
														className="flex items-center justify-between p-2 border rounded-md hover:bg-muted cursor-pointer"
														data-testid={`session-${session.id}`}
													>
														<div>
															<p className="text-sm font-medium capitalize">
																{session.sessionPurpose.replace(/_/g, " ")}
															</p>
															<p className="text-xs text-muted-foreground">
																{WORKFLOW_STATE_LABELS[session.workflowState]}
															</p>
														</div>
														<ChevronRight className="h-4 w-4 text-muted-foreground" />
													</div>
												))}
											</div>
										) : (
											<p className="text-sm text-muted-foreground text-center py-4">
												No active advisory sessions
											</p>
										)}
									</CardContent>
								</Card>
							</>
						) : (
							<Card>
								<CardContent className="py-12 text-center">
									<Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
									<p className="text-muted-foreground">
										Select a client to view details
									</p>
								</CardContent>
							</Card>
						)}
					</div>
				</div>
			</div>

			<Dialog
				open={showStartSessionDialog}
				onOpenChange={setShowStartSessionDialog}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Start Advisory Session</DialogTitle>
						<DialogDescription>
							Select the purpose for this advisory session. The system will
							guide you through the suitability assessment and generate
							optimized recommendations.
						</DialogDescription>
					</DialogHeader>

					{selectedClient && selectedClient.kycStatus === "pending" && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>KYC Required</AlertTitle>
							<AlertDescription>
								Client must complete KYC before starting an advisory session.
							</AlertDescription>
						</Alert>
					)}

					<div className="space-y-4">
						<div>
							<Label>Advisory Purpose</Label>
							<Select
								value={selectedSessionPurpose}
								onValueChange={setSelectedSessionPurpose}
							>
								<SelectTrigger data-testid="select-session-purpose">
									<SelectValue placeholder="Select purpose..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="fresh_investment">
										Fresh Investment
									</SelectItem>
									<SelectItem value="rebalancing">
										Portfolio Rebalancing
									</SelectItem>
									<SelectItem value="goal_review">Goal Review</SelectItem>
									<SelectItem value="retirement_review">
										Retirement Planning Review
									</SelectItem>
									{selectedClient?.clientCategory === "corporate" && (
										<SelectItem value="corporate_treasury">
											Corporate Treasury
										</SelectItem>
									)}
								</SelectContent>
							</Select>
						</div>

						<Alert>
							<Lock className="h-4 w-4" />
							<AlertTitle>Controlled Advisory</AlertTitle>
							<AlertDescription>
								Recommendations are generated by our AI system. You will be able
								to add explanatory notes but cannot modify product allocations.
							</AlertDescription>
						</Alert>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowStartSessionDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleStartSession}
							disabled={
								!selectedSessionPurpose || startAdvisorySession.isPending
							}
							data-testid="button-confirm-start-session"
						>
							{startAdvisorySession.isPending ? (
								<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<ArrowRight className="h-4 w-4 mr-2" />
							)}
							Start Session
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={showPortfolioUploadDialog}
				onOpenChange={setShowPortfolioUploadDialog}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Upload Client Portfolio</DialogTitle>
						<DialogDescription>
							Upload the client's existing portfolio for analysis. The client
							must confirm the data before we can proceed with recommendations.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="border-2 border-dashed rounded-lg p-6 text-center">
							<Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
							<Input
								type="file"
								accept=".pdf,.xlsx,.xls,.csv"
								className="hidden"
								id="portfolio-file"
								onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
							/>
							<Label htmlFor="portfolio-file" className="cursor-pointer">
								<span className="text-primary hover:underline">
									Click to upload
								</span>{" "}
								or drag and drop
							</Label>
							<p className="text-xs text-muted-foreground mt-1">
								PDF, Excel, or CSV files supported
							</p>
							{uploadFile && (
								<div className="mt-3 flex items-center justify-center gap-2 text-sm">
									<FileText className="h-4 w-4" />
									<span>{uploadFile.name}</span>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setUploadFile(null)}
									>
										<XCircle className="h-4 w-4" />
									</Button>
								</div>
							)}
						</div>

						<Alert>
							<Send className="h-4 w-4" />
							<AlertTitle>Client Confirmation Required</AlertTitle>
							<AlertDescription>
								After upload, an OTP will be sent to the client's registered
								mobile/email for confirmation. Portfolio analysis will only
								begin after client approval.
							</AlertDescription>
						</Alert>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowPortfolioUploadDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handlePortfolioUpload}
							disabled={!uploadFile || uploadPortfolio.isPending}
							data-testid="button-confirm-upload"
						>
							{uploadPortfolio.isPending ? (
								<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Upload className="h-4 w-4 mr-2" />
							)}
							Upload & Request Confirmation
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Onboard New Client Dialog */}
			<Dialog
				open={showInviteDialog}
				onOpenChange={(open) => {
					if (!open) resetInviteForm();
					setShowInviteDialog(open);
				}}
			>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<UserPlus className="h-5 w-5 text-primary" />
							Invite Client for Onboarding
						</DialogTitle>
						<DialogDescription>
							Send a personalized onboarding link to your client. They'll
							complete KYC through our guided process.
						</DialogDescription>
					</DialogHeader>

					{!generatedReferralLink ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="clientName">Client Name</Label>
								<Input
									id="clientName"
									placeholder="Enter client's full name"
									value={inviteClientName}
									onChange={(e) => setInviteClientName(e.target.value)}
									data-testid="input-invite-name"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="clientEmail">Email</Label>
									<Input
										id="clientEmail"
										type="email"
										placeholder="client@example.com"
										value={inviteClientEmail}
										onChange={(e) => setInviteClientEmail(e.target.value)}
										data-testid="input-invite-email"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="clientMobile">Mobile</Label>
									<Input
										id="clientMobile"
										placeholder="+91 9999999999"
										value={inviteClientMobile}
										onChange={(e) => setInviteClientMobile(e.target.value)}
										data-testid="input-invite-mobile"
									/>
								</div>
							</div>

							<Separator />

							<div className="space-y-2">
								<Label>Entity Type (Optional)</Label>
								<Select
									value={inviteEntityType}
									onValueChange={setInviteEntityType}
								>
									<SelectTrigger data-testid="select-entity-type">
										<SelectValue placeholder="Select entity type (optional)" />
									</SelectTrigger>
									<SelectContent>
										{ENTITY_TYPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												<div className="flex items-center gap-2">
													<option.icon className="h-4 w-4" />
													{option.label}
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									Pre-select entity type to skip this step during onboarding
								</p>
							</div>

							<div className="space-y-2">
								<Label>Onboarding Mode</Label>
								<Select value={inviteMode} onValueChange={setInviteMode}>
									<SelectTrigger data-testid="select-onboarding-mode">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="smart">
											<div className="flex items-center gap-2">
												<CheckCircle2 className="h-4 w-4 text-green-500" />
												Smart Mode (Recommended)
											</div>
										</SelectItem>
										<SelectItem value="manual">
											<div className="flex items-center gap-2">
												<FileText className="h-4 w-4 text-blue-500" />
												Manual Mode
											</div>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="notes">Notes (Internal)</Label>
								<Textarea
									id="notes"
									placeholder="Add any internal notes about this client..."
									value={inviteNotes}
									onChange={(e) => setInviteNotes(e.target.value)}
									rows={2}
									data-testid="textarea-invite-notes"
								/>
							</div>
						</div>
					) : (
						<div className="space-y-4">
							<Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
								<CheckCircle2 className="h-4 w-4 text-green-600" />
								<AlertTitle className="text-green-800 dark:text-green-200">
									Invitation Created!
								</AlertTitle>
								<AlertDescription className="text-green-700 dark:text-green-300">
									Share this link with {inviteClientName || "your client"} to
									start their onboarding.
								</AlertDescription>
							</Alert>

							<div className="space-y-2">
								<Label>Referral Link</Label>
								<div className="flex gap-2">
									<Input
										value={generatedReferralLink}
										readOnly
										className="font-mono text-sm"
										data-testid="input-referral-link"
									/>
									<Button
										onClick={handleCopyReferralLink}
										data-testid="button-copy-link"
									>
										<Copy className="h-4 w-4" />
									</Button>
								</div>
							</div>

							<div className="flex gap-2">
								<Button
									variant="outline"
									className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
									onClick={() => {
										window.open(
											`mailto:${inviteClientEmail}?subject=Complete Your FintekPro Onboarding&body=Dear ${inviteClientName || "Client"},%0D%0A%0D%0APlease complete your onboarding by clicking the link below:%0D%0A${generatedReferralLink}%0D%0A%0D%0ABest regards`,
										);
									}}
									disabled={!inviteClientEmail}
									data-testid="button-send-email"
								>
									<Mail className="h-4 w-4 mr-2" />
									Email Client
								</Button>
								<Button
									variant="outline"
									className="flex-1 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
									onClick={() => {
										window.open(
											`https://wa.me/${inviteClientMobile?.replace(/[^0-9]/g, "")}?text=Dear ${inviteClientName || "Client"},%0A%0APlease complete your FintekPro onboarding:%0A${encodeURIComponent(generatedReferralLink)}`,
										);
									}}
									disabled={!inviteClientMobile}
									data-testid="button-send-whatsapp"
								>
									<Send className="h-4 w-4 mr-2" />
									WhatsApp
								</Button>
							</div>
						</div>
					)}

					<DialogFooter>
						{!generatedReferralLink ? (
							<>
								<Button
									variant="outline"
									className="border-border text-muted-foreground hover:bg-muted"
									onClick={() => setShowInviteDialog(false)}
								>
									Cancel
								</Button>
								<Button
									className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-sm"
									onClick={handleCreateInvitation}
									disabled={
										createInvitation.isPending ||
										(!inviteClientEmail && !inviteClientMobile)
									}
									data-testid="button-create-invitation"
								>
									{createInvitation.isPending ? (
										<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Link2 className="h-4 w-4 mr-2" />
									)}
									Generate Invitation Link
								</Button>
							</>
						) : (
							<Button
								className="bg-green-600 hover:bg-green-700 text-white"
								onClick={() => {
									resetInviteForm();
									setShowInviteDialog(false);
								}}
							>
								Done
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Invitations Dashboard Dialog */}
			<Dialog open={showInvitationsTab} onOpenChange={setShowInvitationsTab}>
				<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Link2 className="h-5 w-5 text-primary" />
							Client Onboarding Invitations
						</DialogTitle>
						<DialogDescription>
							Track the progress of your client onboarding invitations
						</DialogDescription>
					</DialogHeader>

					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
						<Card className="p-3">
							<div className="text-2xl font-bold">
								{invitationStats?.stats?.total || 0}
							</div>
							<div className="text-xs text-muted-foreground">Total</div>
						</Card>
						<Card className="p-3">
							<div className="text-2xl font-bold text-yellow-600">
								{invitationStats?.stats?.pending || 0}
							</div>
							<div className="text-xs text-muted-foreground">Pending</div>
						</Card>
						<Card className="p-3">
							<div className="text-2xl font-bold text-blue-600">
								{invitationStats?.stats?.in_progress || 0}
							</div>
							<div className="text-xs text-muted-foreground">In Progress</div>
						</Card>
						<Card className="p-3">
							<div className="text-2xl font-bold text-green-600">
								{invitationStats?.stats?.completed || 0}
							</div>
							<div className="text-xs text-muted-foreground">Completed</div>
						</Card>
					</div>

					{invitationsLoading ? (
						<div className="flex items-center justify-center py-8">
							<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : invitations.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
							<p>No invitations yet</p>
							<Button
								className="mt-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground"
								onClick={() => {
									setShowInvitationsTab(false);
									setShowInviteDialog(true);
								}}
							>
								Create First Invitation
							</Button>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Client</TableHead>
									<TableHead>Contact</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Progress</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{invitations.map((inv) => (
									<TableRow
										key={inv.id}
										data-testid={`row-invitation-${inv.id}`}
									>
										<TableCell className="font-medium">
											{inv.clientName || "—"}
											{inv.suggestedEntityType && (
												<Badge variant="outline" className="ml-2 text-xs">
													{inv.suggestedEntityType}
												</Badge>
											)}
										</TableCell>
										<TableCell>
											<div className="text-sm">
												{inv.clientEmail && (
													<div className="flex items-center gap-1">
														<Mail className="h-3 w-3" />
														{inv.clientEmail}
													</div>
												)}
												{inv.clientMobile && (
													<div className="flex items-center gap-1">
														<Phone className="h-3 w-3" />
														{inv.clientMobile}
													</div>
												)}
											</div>
										</TableCell>
										<TableCell>
											<Badge
												className={INVITATION_STATUS_COLORS[inv.status] || ""}
											>
												{inv.status.replace("_", " ")}
											</Badge>
										</TableCell>
										<TableCell>
											<div className="w-24">
												<Progress
													value={inv.progressPercentage}
													className="h-2"
												/>
												<span className="text-xs text-muted-foreground">
													{inv.progressPercentage}%
												</span>
											</div>
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{new Date(inv.createdAt).toLocaleDateString()}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="sm"
													className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
													onClick={() => {
														const link = `${window.location.origin}/onboarding?ref=${inv.referralCode}`;
														navigator.clipboard.writeText(link);
														toast({
															title: "Copied!",
															description: "Link copied to clipboard",
														});
													}}
													data-testid={`button-copy-${inv.id}`}
												>
													<Copy className="h-4 w-4" />
												</Button>
												{(inv.status === "pending" ||
													inv.status === "expired") && (
													<Button
														variant="ghost"
														size="sm"
														className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
														onClick={() => resendInvitation.mutate(inv.id)}
														disabled={resendInvitation.isPending}
														data-testid={`button-resend-${inv.id}`}
													>
														<RefreshCw
															className={`h-4 w-4 ${resendInvitation.isPending ? "animate-spin" : ""}`}
														/>
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
