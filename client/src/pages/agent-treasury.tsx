import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
	Building2,
	Search,
	Plus,
	DollarSign,
	TrendingUp,
	Shield as LucideShield,
	Clock,
	CheckCircle2,
	XCircle,
	AlertTriangle,
	FileText,
	Users,
	Eye,
	ArrowRight,
	Lock,
	Unlock,
	Calendar,
	PieChart,
	UserPlus,
} from "lucide-react";

interface CorporateClient {
	id: string;
	name: string;
	entityName: string;
	totalCorpus: string;
	cashDeployed: string;
	status: string;
	makerCheckerEnabled: boolean;
	mandateId?: string;
}

interface EligibleClient {
	id: string;
	name: string;
	email: string;
	mobile: string;
	kycStatus: string;
	kycTier: string;
	hasTreasuryMandate: boolean;
}

interface TreasuryProposal {
	id: string;
	proposalNumber: string;
	proposalType: string;
	entityName: string;
	currentIdleCash: string;
	expectedTotalYield: string;
	status: string;
	makerUserId: string | null;
	checkerUserId: string | null;
	makerApprovedAt: string | null;
	checkerApprovedAt: string | null;
	createdAt: string;
	validUntil: string;
	makerCheckerEnabled: boolean;
	recommendedAllocation: {
		bucket: string;
		instrument: string;
		instrumentName: string;
		amount: number;
		expectedYield: number;
		maturityDays: number;
		creditRating: string;
	}[];
}

const statusColors: Record<string, string> = {
	draft: "bg-muted text-foreground",
	pending_approval:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	pending_maker:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	pending_checker:
		"bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
	approved:
		"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	executed: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
	expired:
		"bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
};

const bucketColors: Record<string, string> = {
	operating_cash: "bg-blue-500",
	liquidity_buffer: "bg-green-500",
	short_term_parking: "bg-yellow-500",
	yield_accrual: "bg-purple-500",
};

export default function AgentTreasuryPage() {
	const { toast } = useToast();
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedTab, setSelectedTab] = useState("clients");
	const [selectedClient, setSelectedClient] = useState<CorporateClient | null>(
		null,
	);
	const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
	const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
	const [selectedProposal, setSelectedProposal] =
		useState<TreasuryProposal | null>(null);
	const [approvalAction, setApprovalAction] = useState<"approve" | "reject">(
		"approve",
	);
	const [rejectionReason, setRejectionReason] = useState("");
	const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false);
	const [onboardingStep, setOnboardingStep] = useState(1);
	const [onboardingForm, setOnboardingForm] = useState({
		clientId: "",
		entityName: "",
		cin: "",
		gstNumber: "",
		totalCashAvailable: "",
		capitalProtection: true,
		liquidityManagement: false,
		yieldEnhancement: false,
		liabilityMatching: false,
		maxCreditRisk: "AAA",
		maxDurationDays: "365",
		maxSingleCounterparty: "10",
		makerCheckerEnabled: true,
	});

	const { data: corporateClients, isLoading: loadingClients } = useQuery<
		CorporateClient[]
	>({
		queryKey: ["/api/agent/treasury/clients"],
	});

	const { data: proposals, isLoading: loadingProposals } = useQuery<
		TreasuryProposal[]
	>({
		queryKey: ["/api/agent/treasury/proposals"],
	});

	const { data: buckets } = useQuery({
		queryKey: ["/api/treasury/buckets"],
	});

	const { data: objectives } = useQuery({
		queryKey: ["/api/treasury/objectives"],
	});

	const { data: eligibleClients } = useQuery<EligibleClient[]>({
		queryKey: ["/api/agent/treasury/eligible-clients"],
		enabled: onboardingDialogOpen,
	});

	const createMandateMutation = useMutation({
		mutationFn: async (data: typeof onboardingForm) => {
			return apiRequest("/api/agent/treasury/mandates", {
				method: "POST",
				body: JSON.stringify({
					...data,
					totalCashAvailable: Number.parseFloat(data.totalCashAvailable),
					maxDurationDays: Number.parseInt(data.maxDurationDays),
					maxSingleCounterparty: Number.parseInt(data.maxSingleCounterparty),
				}),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/treasury/clients"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/treasury/eligible-clients"],
			});
			setOnboardingDialogOpen(false);
			setOnboardingStep(1);
			setOnboardingForm({
				clientId: "",
				entityName: "",
				cin: "",
				gstNumber: "",
				totalCashAvailable: "",
				capitalProtection: true,
				liquidityManagement: false,
				yieldEnhancement: false,
				liabilityMatching: false,
				maxCreditRisk: "AAA",
				maxDurationDays: "365",
				maxSingleCounterparty: "10",
				makerCheckerEnabled: true,
			});
			toast({
				title: "Client Onboarded",
				description: "Treasury mandate has been created successfully.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const generateProposalMutation = useMutation({
		mutationFn: async (data: { mandateId: string; proposalType: string }) => {
			return apiRequest("/api/agent/treasury/proposals/generate", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/treasury/proposals"],
			});
			setProposalDialogOpen(false);
			toast({
				title: "Proposal generated",
				description: "Treasury proposal has been created.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const makerApprovalMutation = useMutation({
		mutationFn: async (data: {
			proposalId: string;
			action: "approve" | "reject";
			reason?: string;
		}) => {
			return apiRequest(
				`/api/agent/treasury/proposals/${data.proposalId}/maker-action`,
				{
					method: "POST",
					body: JSON.stringify({ action: data.action, reason: data.reason }),
				},
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/treasury/proposals"],
			});
			setApprovalDialogOpen(false);
			toast({
				title: "Action completed",
				description: "Maker action has been recorded.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const checkerApprovalMutation = useMutation({
		mutationFn: async (data: {
			proposalId: string;
			action: "approve" | "reject";
			reason?: string;
		}) => {
			return apiRequest(
				`/api/agent/treasury/proposals/${data.proposalId}/checker-action`,
				{
					method: "POST",
					body: JSON.stringify({ action: data.action, reason: data.reason }),
				},
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/treasury/proposals"],
			});
			setApprovalDialogOpen(false);
			toast({
				title: "Action completed",
				description: "Checker action has been recorded and proposal executed.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const singleApprovalMutation = useMutation({
		mutationFn: async (data: {
			proposalId: string;
			action: "approve" | "reject";
			reason?: string;
		}) => {
			return apiRequest(
				`/api/agent/treasury/proposals/${data.proposalId}/single-approval`,
				{
					method: "POST",
					body: JSON.stringify({ action: data.action, reason: data.reason }),
				},
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/treasury/proposals"],
			});
			setApprovalDialogOpen(false);
			toast({
				title: "Action completed",
				description: "Proposal has been approved and executed.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const filteredClients =
		corporateClients?.filter(
			(client) =>
				client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				client.entityName?.toLowerCase().includes(searchTerm.toLowerCase()),
		) || [];

	const pendingApprovals =
		proposals?.filter(
			(p) =>
				p.status === "pending_maker" ||
				p.status === "pending_checker" ||
				p.status === "pending_approval",
		) || [];

	const isSingleApprovalMode = (proposal: TreasuryProposal) => {
		return (
			proposal.status === "pending_approval" ||
			(proposal.makerCheckerEnabled === false &&
				proposal.status !== "pending_checker")
		);
	};

	const getApprovalMutation = (proposal: TreasuryProposal) => {
		if (isSingleApprovalMode(proposal)) {
			return singleApprovalMutation;
		}
		if (proposal.status === "pending_maker") {
			return makerApprovalMutation;
		}
		return checkerApprovalMutation;
	};

	const getApprovalLabel = (proposal: TreasuryProposal) => {
		if (isSingleApprovalMode(proposal)) {
			return "Approve";
		}
		if (proposal.status === "pending_maker") {
			return "Maker Action";
		}
		return "Checker Action";
	};

	const getApprovalDialogTitle = (proposal: TreasuryProposal | null) => {
		if (!proposal) return "Approval";
		if (isSingleApprovalMode(proposal)) {
			return "Single Approval";
		}
		if (proposal.status === "pending_maker") {
			return "Maker Approval";
		}
		return "Checker Approval";
	};

	const handleApprovalSubmit = () => {
		if (!selectedProposal) return;

		const mutation = getApprovalMutation(selectedProposal);

		mutation.mutate({
			proposalId: selectedProposal.id,
			action: approvalAction,
			reason: approvalAction === "reject" ? rejectionReason : undefined,
		});
	};

	const renderClientsList = () => (
		<div className="space-y-4">
			<div className="flex gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search corporate clients..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-9"
						data-testid="input-search-clients"
					/>
				</div>
				<Button variant="outline" data-testid="button-filter">
					<Building2 className="h-4 w-4 mr-2" />
					Filter
				</Button>
			</div>

			{loadingClients ? (
				<div className="text-center py-8 text-muted-foreground">
					Loading clients...
				</div>
			) : filteredClients.length === 0 ? (
				<Card className="p-8 text-center">
					<Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
					<h3 className="text-lg font-medium mb-2">No Corporate Clients</h3>
					<p className="text-muted-foreground mb-4">
						No corporate clients with treasury mandates found.
					</p>
				</Card>
			) : (
				<div className="grid gap-4">
					{filteredClients.map((client) => (
						<Card
							key={client.id}
							className="hover:shadow-md transition-shadow cursor-pointer"
							onClick={() => setSelectedClient(client)}
							data-testid={`card-client-${client.id}`}
						>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-4">
										<div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
											<Building2 className="h-6 w-6 text-blue-600" />
										</div>
										<div>
											<h3 className="font-medium">{client.entityName}</h3>
											<p className="text-sm text-muted-foreground">
												{client.name}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-6">
										<div className="text-right">
											<p className="text-sm text-muted-foreground">
												Total Corpus
											</p>
											<p className="font-medium">
												₹
												{Number.parseFloat(client.totalCorpus).toLocaleString(
													"en-IN",
												)}
											</p>
										</div>
										<div className="text-right">
											<p className="text-sm text-muted-foreground">Deployed</p>
											<p className="font-medium text-green-600">
												₹
												{Number.parseFloat(
													client.cashDeployed || "0",
												).toLocaleString("en-IN")}
											</p>
										</div>
										<div className="flex items-center gap-2">
											{client.makerCheckerEnabled ? (
												<Badge variant="outline" className="gap-1">
													<Lock className="h-3 w-3" />
													Maker-Checker
												</Badge>
											) : (
												<Badge variant="secondary" className="gap-1">
													<Unlock className="h-3 w-3" />
													Single Approval
												</Badge>
											)}
										</div>
										<Button size="sm" variant="ghost">
											<ArrowRight className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);

	const renderProposalsList = () => (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<h3 className="text-lg font-medium">Treasury Proposals</h3>
				<Dialog open={proposalDialogOpen} onOpenChange={setProposalDialogOpen}>
					<DialogTrigger asChild>
						<Button data-testid="button-new-proposal">
							<Plus className="h-4 w-4 mr-2" />
							New Proposal
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Generate Treasury Proposal</DialogTitle>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div>
								<Label>Select Corporate Client</Label>
								<Select
									value={selectedClient?.mandateId || ""}
									onValueChange={(v) => {
										const client = corporateClients?.find(
											(c) => c.mandateId === v,
										);
										setSelectedClient(client || null);
									}}
								>
									<SelectTrigger data-testid="select-client">
										<SelectValue placeholder="Choose client" />
									</SelectTrigger>
									<SelectContent>
										{corporateClients?.map((client) => (
											<SelectItem
												key={client.id}
												value={client.mandateId || client.id}
											>
												{client.entityName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label>Proposal Type</Label>
								<Select>
									<SelectTrigger data-testid="select-proposal-type">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="initial_deployment">
											Initial Deployment
										</SelectItem>
										<SelectItem value="rebalancing">Rebalancing</SelectItem>
										<SelectItem value="maturity_reinvestment">
											Maturity Reinvestment
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setProposalDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={() =>
									generateProposalMutation.mutate({
										mandateId: selectedClient?.mandateId || "",
										proposalType: "initial_deployment",
									})
								}
								disabled={
									!selectedClient?.mandateId ||
									generateProposalMutation.isPending
								}
								data-testid="button-generate-proposal"
							>
								{generateProposalMutation.isPending
									? "Generating..."
									: "Generate Proposal"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{loadingProposals ? (
				<div className="text-center py-8 text-muted-foreground">
					Loading proposals...
				</div>
			) : proposals?.length === 0 ? (
				<Card className="p-8 text-center">
					<FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
					<h3 className="text-lg font-medium mb-2">No Proposals</h3>
					<p className="text-muted-foreground">
						Generate a new treasury proposal for a corporate client.
					</p>
				</Card>
			) : (
				<div className="grid gap-4">
					{proposals?.map((proposal) => (
						<Card
							key={proposal.id}
							data-testid={`card-proposal-${proposal.id}`}
						>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-4">
										<div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
											<FileText className="h-6 w-6 text-purple-600" />
										</div>
										<div>
											<div className="flex items-center gap-2">
												<h3 className="font-medium">
													{proposal.proposalNumber}
												</h3>
												<Badge
													className={
														statusColors[proposal.status] || "bg-muted"
													}
												>
													{proposal.status.replace(/_/g, " ").toUpperCase()}
												</Badge>
											</div>
											<p className="text-sm text-muted-foreground">
												{proposal.entityName} •{" "}
												{proposal.proposalType.replace(/_/g, " ")}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-6">
										<div className="text-right">
											<p className="text-sm text-muted-foreground">Idle Cash</p>
											<p className="font-medium">
												₹
												{Number.parseFloat(
													proposal.currentIdleCash || "0",
												).toLocaleString("en-IN")}
											</p>
										</div>
										<div className="text-right">
											<p className="text-sm text-muted-foreground">
												Expected Yield
											</p>
											<p className="font-medium text-green-600">
												{proposal.expectedTotalYield}%
											</p>
										</div>
										<div className="flex gap-2">
											<Button
												size="sm"
												variant="outline"
												data-testid={`button-view-${proposal.id}`}
											>
												<Eye className="h-4 w-4" />
											</Button>
											{(proposal.status === "pending_maker" ||
												proposal.status === "pending_checker" ||
												proposal.status === "pending_approval") && (
												<Button
													size="sm"
													onClick={() => {
														setSelectedProposal(proposal);
														setApprovalDialogOpen(true);
													}}
													data-testid={`button-action-${proposal.id}`}
												>
													{getApprovalLabel(proposal)}
												</Button>
											)}
										</div>
									</div>
								</div>

								{proposal.recommendedAllocation &&
									proposal.recommendedAllocation.length > 0 && (
										<div className="mt-4 pt-4 border-t">
											<p className="text-sm font-medium mb-2">
												Recommended Allocation
											</p>
											<div className="grid grid-cols-4 gap-2">
												{proposal.recommendedAllocation
													.slice(0, 4)
													.map((alloc, idx) => (
														<div
															key={idx}
															className="p-2 rounded-lg bg-muted/50 text-sm"
														>
															<p className="font-medium truncate">
																{alloc.instrumentName}
															</p>
															<p className="text-muted-foreground">
																₹{alloc.amount.toLocaleString("en-IN")} •{" "}
																{alloc.expectedYield}%
															</p>
														</div>
													))}
											</div>
										</div>
									)}

								{(proposal.makerApprovedAt || proposal.checkerApprovedAt) && (
									<div className="mt-4 pt-4 border-t">
										<div className="flex gap-4 text-sm">
											{proposal.makerApprovedAt && (
												<div className="flex items-center gap-2 text-green-600">
													<CheckCircle2 className="h-4 w-4" />
													<span>Maker approved</span>
												</div>
											)}
											{proposal.checkerApprovedAt && (
												<div className="flex items-center gap-2 text-green-600">
													<CheckCircle2 className="h-4 w-4" />
													<span>Checker approved</span>
												</div>
											)}
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);

	const renderPendingApprovals = () => (
		<div className="space-y-4">
			<div className="flex items-center gap-2 mb-4">
				<AlertTriangle className="h-5 w-5 text-orange-500" />
				<h3 className="text-lg font-medium">Pending Approvals</h3>
				<Badge variant="secondary">{pendingApprovals.length}</Badge>
			</div>

			{pendingApprovals.length === 0 ? (
				<Card className="p-8 text-center">
					<CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
					<h3 className="text-lg font-medium mb-2">All Clear</h3>
					<p className="text-muted-foreground">
						No pending approvals at this time.
					</p>
				</Card>
			) : (
				<div className="grid gap-4">
					{pendingApprovals.map((proposal) => {
						const singleMode = isSingleApprovalMode(proposal);
						const statusBadge = singleMode
							? {
									class:
										"bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
									text: "SINGLE APPROVAL",
								}
							: proposal.status === "pending_maker"
								? {
										class:
											"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
										text: "AWAITING MAKER",
									}
								: {
										class:
											"bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
										text: "AWAITING CHECKER",
									};

						return (
							<Card
								key={proposal.id}
								className={`border-l-4 ${singleMode ? "border-l-blue-500" : "border-l-orange-500"}`}
							>
								<CardContent className="p-4">
									<div className="flex items-center justify-between">
										<div>
											<div className="flex items-center gap-2">
												<h3 className="font-medium">
													{proposal.proposalNumber}
												</h3>
												<Badge className={statusBadge.class}>
													{statusBadge.text}
												</Badge>
												{singleMode && (
													<Badge variant="secondary" className="gap-1">
														<Unlock className="h-3 w-3" />
														No Maker-Checker
													</Badge>
												)}
											</div>
											<p className="text-sm text-muted-foreground">
												{proposal.entityName} • ₹
												{Number.parseFloat(
													proposal.currentIdleCash,
												).toLocaleString("en-IN")}
											</p>
										</div>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													setSelectedProposal(proposal);
													setApprovalAction("reject");
													setApprovalDialogOpen(true);
												}}
												data-testid={`button-reject-${proposal.id}`}
											>
												<XCircle className="h-4 w-4 mr-1" />
												Reject
											</Button>
											<Button
												size="sm"
												onClick={() => {
													setSelectedProposal(proposal);
													setApprovalAction("approve");
													setApprovalDialogOpen(true);
												}}
												data-testid={`button-approve-${proposal.id}`}
											>
												<CheckCircle2 className="h-4 w-4 mr-1" />
												Approve
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<Building2 className="h-6 w-6" />
						Corporate Treasury Management
					</h1>
					<p className="text-muted-foreground">
						Manage treasury mandates, proposals, and approvals for corporate
						clients
					</p>
				</div>
				<Button
					onClick={() => setOnboardingDialogOpen(true)}
					data-testid="button-onboard-client"
				>
					<UserPlus className="h-4 w-4 mr-2" />
					Onboard Client
				</Button>
			</div>

			<div className="grid grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
								<Building2 className="h-5 w-5 text-blue-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">
									{corporateClients?.length || 0}
								</p>
								<p className="text-sm text-muted-foreground">
									Corporate Clients
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
								<DollarSign className="h-5 w-5 text-green-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">
									₹
									{(Array.isArray(corporateClients) ? corporateClients : [])
										.reduce(
											(sum, c) => sum + Number.parseFloat(c.totalCorpus || "0"),
											0,
										)
										.toLocaleString("en-IN") || "0"}
								</p>
								<p className="text-sm text-muted-foreground">Total AUM</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
								<FileText className="h-5 w-5 text-purple-600" />
							</div>
							<div>
								<p className="text-2xl font-bold">{proposals?.length || 0}</p>
								<p className="text-sm text-muted-foreground">Total Proposals</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card
					className={pendingApprovals.length > 0 ? "border-orange-500" : ""}
				>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div
								className={`h-10 w-10 rounded-lg ${pendingApprovals.length > 0 ? "bg-orange-100 dark:bg-orange-900/30" : "bg-muted"} flex items-center justify-center`}
							>
								<AlertTriangle
									className={`h-5 w-5 ${pendingApprovals.length > 0 ? "text-orange-600" : "text-muted-foreground"}`}
								/>
							</div>
							<div>
								<p className="text-2xl font-bold">{pendingApprovals.length}</p>
								<p className="text-sm text-muted-foreground">
									Pending Approvals
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs value={selectedTab} onValueChange={setSelectedTab}>
				<TabsList>
					<TabsTrigger value="clients" data-testid="tab-clients">
						<Building2 className="h-4 w-4 mr-2" />
						Corporate Clients
					</TabsTrigger>
					<TabsTrigger value="proposals" data-testid="tab-proposals">
						<FileText className="h-4 w-4 mr-2" />
						Proposals
					</TabsTrigger>
					<TabsTrigger
						value="approvals"
						data-testid="tab-approvals"
						className="relative"
					>
						<LucideShield className="h-4 w-4 mr-2" />
						Pending Approvals
						{pendingApprovals.length > 0 && (
							<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">
								{pendingApprovals.length}
							</span>
						)}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="clients" className="mt-6">
					{renderClientsList()}
				</TabsContent>

				<TabsContent value="proposals" className="mt-6">
					{renderProposalsList()}
				</TabsContent>

				<TabsContent value="approvals" className="mt-6">
					{renderPendingApprovals()}
				</TabsContent>
			</Tabs>

			<Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{getApprovalDialogTitle(selectedProposal)}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="p-4 bg-muted rounded-lg">
							<div className="flex items-center gap-2">
								<p className="font-medium">
									{selectedProposal?.proposalNumber}
								</p>
								{selectedProposal && isSingleApprovalMode(selectedProposal) && (
									<Badge variant="secondary" className="gap-1">
										<Unlock className="h-3 w-3" />
										No Maker-Checker
									</Badge>
								)}
							</div>
							<p className="text-sm text-muted-foreground">
								{selectedProposal?.entityName}
							</p>
							<div className="mt-2 grid grid-cols-2 gap-4 text-sm">
								<div>
									<p className="text-muted-foreground">Idle Cash</p>
									<p className="font-medium">
										₹
										{Number.parseFloat(
											selectedProposal?.currentIdleCash || "0",
										).toLocaleString("en-IN")}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Expected Yield</p>
									<p className="font-medium text-green-600">
										{selectedProposal?.expectedTotalYield}%
									</p>
								</div>
							</div>
						</div>

						<div className="flex gap-4">
							<Button
								variant={approvalAction === "approve" ? "default" : "outline"}
								className="flex-1"
								onClick={() => setApprovalAction("approve")}
								data-testid="button-action-approve"
							>
								<CheckCircle2 className="h-4 w-4 mr-2" />
								Approve
							</Button>
							<Button
								variant={
									approvalAction === "reject" ? "destructive" : "outline"
								}
								className="flex-1"
								onClick={() => setApprovalAction("reject")}
								data-testid="button-action-reject"
							>
								<XCircle className="h-4 w-4 mr-2" />
								Reject
							</Button>
						</div>

						{approvalAction === "reject" && (
							<div>
								<Label>Rejection Reason</Label>
								<Textarea
									placeholder="Please provide a reason for rejection..."
									value={rejectionReason}
									onChange={(e) => setRejectionReason(e.target.value)}
									data-testid="input-rejection-reason"
								/>
							</div>
						)}

						{(() => {
							const singleMode = selectedProposal
								? isSingleApprovalMode(selectedProposal)
								: false;
							return (
								<div
									className={`p-3 rounded-lg text-sm ${singleMode ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800" : "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800"}`}
								>
									<p
										className={`font-medium ${singleMode ? "text-blue-800 dark:text-blue-200" : "text-yellow-800 dark:text-yellow-200"}`}
									>
										{singleMode ? "Single Approval Mode" : "Compliance Notice"}
									</p>
									<p
										className={
											singleMode
												? "text-blue-700 dark:text-blue-300"
												: "text-yellow-700 dark:text-yellow-300"
										}
									>
										{singleMode
											? "This mandate does not require maker-checker approval. Your approval will immediately execute this treasury allocation."
											: selectedProposal?.status === "pending_maker"
												? "As the Maker, your approval will submit this proposal for Checker review before execution."
												: "As the Checker, your approval will trigger immediate execution of this treasury allocation."}
									</p>
								</div>
							);
						})()}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setApprovalDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant={approvalAction === "approve" ? "default" : "destructive"}
							onClick={handleApprovalSubmit}
							disabled={approvalAction === "reject" && !rejectionReason}
							data-testid="button-submit-action"
						>
							{approvalAction === "approve"
								? "Confirm Approval"
								: "Confirm Rejection"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={onboardingDialogOpen}
				onOpenChange={(open) => {
					setOnboardingDialogOpen(open);
					if (!open) {
						setOnboardingStep(1);
					}
				}}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<UserPlus className="h-5 w-5" />
							Onboard Corporate Treasury Client
						</DialogTitle>
					</DialogHeader>

					<div className="mb-4">
						<div className="flex items-center justify-between text-sm mb-2">
							<span
								className={
									onboardingStep >= 1
										? "text-primary font-medium"
										: "text-muted-foreground"
								}
							>
								1. Select Client
							</span>
							<span
								className={
									onboardingStep >= 2
										? "text-primary font-medium"
										: "text-muted-foreground"
								}
							>
								2. Entity Details
							</span>
							<span
								className={
									onboardingStep >= 3
										? "text-primary font-medium"
										: "text-muted-foreground"
								}
							>
								3. Risk Parameters
							</span>
						</div>
						<Progress value={(onboardingStep / 3) * 100} className="h-2" />
					</div>

					{onboardingStep === 1 && (
						<div className="space-y-4 py-4">
							<div>
								<Label>Select Client</Label>
								<Select
									value={onboardingForm.clientId}
									onValueChange={(value) =>
										setOnboardingForm({ ...onboardingForm, clientId: value })
									}
								>
									<SelectTrigger data-testid="select-client">
										<SelectValue placeholder="Choose a client to onboard" />
									</SelectTrigger>
									<SelectContent>
										{eligibleClients
											?.filter((c) => !c.hasTreasuryMandate)
											.map((client) => {
												const isEligible = ["enhanced", "accredited"].includes(
													client.kycTier?.toLowerCase() || "",
												);
												return (
													<SelectItem
														key={client.id}
														value={client.id}
														disabled={!isEligible}
													>
														<div className="flex items-center gap-2">
															<span>{client.name}</span>
															<Badge
																variant={isEligible ? "default" : "secondary"}
																className="text-xs"
															>
																{client.kycTier || "Basic"}
															</Badge>
															{!isEligible && (
																<span className="text-xs text-muted-foreground">
																	(Requires Enhanced KYC)
																</span>
															)}
														</div>
													</SelectItem>
												);
											})}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground mt-1">
									Only clients with Enhanced or Accredited KYC tier can use
									treasury services
								</p>
							</div>

							{eligibleClients?.filter((c) => !c.hasTreasuryMandate).length ===
								0 && (
								<div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
									<p className="text-sm text-yellow-800 dark:text-yellow-200">
										No eligible clients available. Clients must have Enhanced or
										Accredited KYC tier and not already have an active treasury
										mandate.
									</p>
								</div>
							)}
						</div>
					)}

					{onboardingStep === 2 && (
						<div className="space-y-4 py-4">
							<div>
								<Label>Corporate Entity Name</Label>
								<Input
									placeholder="Enter registered company name"
									value={onboardingForm.entityName}
									onChange={(e) =>
										setOnboardingForm({
											...onboardingForm,
											entityName: e.target.value,
										})
									}
									data-testid="input-entity-name"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label>CIN (Corporate Identity Number)</Label>
									<Input
										placeholder="e.g., U12345MH2020PLC123456"
										value={onboardingForm.cin}
										onChange={(e) =>
											setOnboardingForm({
												...onboardingForm,
												cin: e.target.value.toUpperCase(),
											})
										}
										data-testid="input-cin"
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Optional - 21 character format
									</p>
								</div>
								<div>
									<Label>GST Number</Label>
									<Input
										placeholder="e.g., 27AABCU9603R1ZM"
										value={onboardingForm.gstNumber}
										onChange={(e) =>
											setOnboardingForm({
												...onboardingForm,
												gstNumber: e.target.value.toUpperCase(),
											})
										}
										data-testid="input-gst"
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Optional - 15 character GSTIN
									</p>
								</div>
							</div>

							<div>
								<Label>Total Cash Available for Treasury (INR)</Label>
								<Input
									type="number"
									placeholder="Enter amount in INR"
									value={onboardingForm.totalCashAvailable}
									onChange={(e) =>
										setOnboardingForm({
											...onboardingForm,
											totalCashAvailable: e.target.value,
										})
									}
									data-testid="input-cash-available"
								/>
								<p className="text-xs text-muted-foreground mt-1">
									This is the total idle cash corpus to be managed
								</p>
							</div>

							<div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
								<p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
									Investment Objectives
								</p>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="capital-protection"
											checked={onboardingForm.capitalProtection}
											onCheckedChange={(checked) =>
												setOnboardingForm({
													...onboardingForm,
													capitalProtection: !!checked,
												})
											}
										/>
										<Label htmlFor="capital-protection" className="text-sm">
											Capital Protection
										</Label>
									</div>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="liquidity-management"
											checked={onboardingForm.liquidityManagement}
											onCheckedChange={(checked) =>
												setOnboardingForm({
													...onboardingForm,
													liquidityManagement: !!checked,
												})
											}
										/>
										<Label htmlFor="liquidity-management" className="text-sm">
											Liquidity Management
										</Label>
									</div>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="yield-enhancement"
											checked={onboardingForm.yieldEnhancement}
											onCheckedChange={(checked) =>
												setOnboardingForm({
													...onboardingForm,
													yieldEnhancement: !!checked,
												})
											}
										/>
										<Label htmlFor="yield-enhancement" className="text-sm">
											Yield Enhancement
										</Label>
									</div>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="liability-matching"
											checked={onboardingForm.liabilityMatching}
											onCheckedChange={(checked) =>
												setOnboardingForm({
													...onboardingForm,
													liabilityMatching: !!checked,
												})
											}
										/>
										<Label htmlFor="liability-matching" className="text-sm">
											Liability Matching
										</Label>
									</div>
								</div>
							</div>
						</div>
					)}

					{onboardingStep === 3 && (
						<div className="space-y-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label>Maximum Credit Risk</Label>
									<Select
										value={onboardingForm.maxCreditRisk}
										onValueChange={(value) =>
											setOnboardingForm({
												...onboardingForm,
												maxCreditRisk: value,
											})
										}
									>
										<SelectTrigger data-testid="select-credit-risk">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="AAA">AAA - Highest Safety</SelectItem>
											<SelectItem value="AA+">
												AA+ - Very High Safety
											</SelectItem>
											<SelectItem value="AA">AA - High Safety</SelectItem>
											<SelectItem value="AA-">AA- - High Safety</SelectItem>
											<SelectItem value="A+">A+ - Adequate Safety</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label>Maximum Duration (Days)</Label>
									<Select
										value={onboardingForm.maxDurationDays}
										onValueChange={(value) =>
											setOnboardingForm({
												...onboardingForm,
												maxDurationDays: value,
											})
										}
									>
										<SelectTrigger data-testid="select-duration">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="30">30 Days</SelectItem>
											<SelectItem value="90">90 Days</SelectItem>
											<SelectItem value="180">180 Days</SelectItem>
											<SelectItem value="365">365 Days (1 Year)</SelectItem>
											<SelectItem value="730">730 Days (2 Years)</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div>
								<Label>Maximum Single Counterparty Exposure (%)</Label>
								<Select
									value={onboardingForm.maxSingleCounterparty}
									onValueChange={(value) =>
										setOnboardingForm({
											...onboardingForm,
											maxSingleCounterparty: value,
										})
									}
								>
									<SelectTrigger data-testid="select-counterparty">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="5">5% - Very Conservative</SelectItem>
										<SelectItem value="10">10% - Conservative</SelectItem>
										<SelectItem value="15">15% - Moderate</SelectItem>
										<SelectItem value="20">20% - Liberal</SelectItem>
										<SelectItem value="25">25% - Aggressive</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="p-4 bg-muted rounded-lg">
								<div className="flex items-center justify-between">
									<div>
										<Label className="text-base">Maker-Checker Approval</Label>
										<p className="text-sm text-muted-foreground">
											Require dual approval for treasury allocations
										</p>
									</div>
									<Switch
										checked={onboardingForm.makerCheckerEnabled}
										onCheckedChange={(checked) =>
											setOnboardingForm({
												...onboardingForm,
												makerCheckerEnabled: checked,
											})
										}
										data-testid="switch-maker-checker"
									/>
								</div>
								{!onboardingForm.makerCheckerEnabled && (
									<div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
										<AlertTriangle className="h-4 w-4 inline mr-1" />
										Single approval mode: Proposals will be executed immediately
										upon first approval.
									</div>
								)}
							</div>

							<div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
								<p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
									Summary
								</p>
								<div className="grid grid-cols-2 gap-2 text-sm text-green-700 dark:text-green-300">
									<p>Entity: {onboardingForm.entityName || "Not set"}</p>
									<p>
										Corpus: ₹
										{onboardingForm.totalCashAvailable
											? Number.parseFloat(
													onboardingForm.totalCashAvailable,
												).toLocaleString("en-IN")
											: "0"}
									</p>
									<p>Max Risk: {onboardingForm.maxCreditRisk}</p>
									<p>Max Duration: {onboardingForm.maxDurationDays} days</p>
									<p>
										Approval:{" "}
										{onboardingForm.makerCheckerEnabled
											? "Maker-Checker"
											: "Single"}
									</p>
								</div>
							</div>
						</div>
					)}

					<DialogFooter>
						{onboardingStep > 1 && (
							<Button
								variant="outline"
								onClick={() => setOnboardingStep(onboardingStep - 1)}
							>
								Back
							</Button>
						)}
						<Button
							variant="outline"
							onClick={() => setOnboardingDialogOpen(false)}
						>
							Cancel
						</Button>
						{onboardingStep < 3 ? (
							<Button
								onClick={() => setOnboardingStep(onboardingStep + 1)}
								disabled={
									(onboardingStep === 1 && !onboardingForm.clientId) ||
									(onboardingStep === 2 &&
										(!onboardingForm.entityName ||
											!onboardingForm.totalCashAvailable))
								}
								data-testid="button-next-step"
							>
								Next
								<ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						) : (
							<Button
								onClick={() => createMandateMutation.mutate(onboardingForm)}
								disabled={createMandateMutation.isPending}
								data-testid="button-create-mandate"
							>
								{createMandateMutation.isPending
									? "Creating..."
									: "Create Mandate"}
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
