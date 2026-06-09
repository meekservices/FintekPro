import { AIAdvisoryDisclosure } from "@/components/regulatory/AIAdvisoryDisclosure";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import {
	Brain,
	FileText,
	AlertTriangle,
	CheckCircle,
	Clock,
	Search,
	User,
	TrendingUp,
	TrendingDown,
	ArrowRightLeft,
	Loader2,
	RefreshCw,
	Send,
	Eye,
	Edit,
	Trash2,
	PieChart,
	BarChart3,
	AlertCircle,
	Shield as LucideShield,
	Info,
	ChevronRight,
	Plus,
} from "lucide-react";

interface PortfolioDiagnostics {
	id: string;
	userId: string;
	portfolioSnapshot: {
		totalValue: number;
		assetAllocation: Record<string, { value: number; percentage: number }>;
		holdings: Array<{
			assetType: string;
			isin?: string;
			schemeName: string;
			currentValue: number;
			weightPercent: number;
			riskScore: number;
			lockIn?: boolean;
		}>;
	};
	portfolioRiskScore: string;
	clientRiskTolerance: string;
	riskMismatchPercent: string;
	idealAllocation: Record<string, { min: number; max: number; target: number }>;
	allocationDeviation: Record<
		string,
		{ current: number; target: number; deviation: number }
	>;
	concentrationIssues: Array<{
		type: string;
		name: string;
		currentPercent: number;
		limitPercent: number;
		severity: "warning" | "critical";
	}>;
	mfOverlapPercent: string;
	mfOverlapDetails: Array<{
		scheme1: string;
		scheme2: string;
		overlapPercent: number;
	}>;
	healthScore: number;
	healthSummary: string;
	issueCount: { critical: number; warning: number; info: number };
	createdAt: string;
}

interface ProposalItem {
	id: string;
	proposalId: string;
	actionType: "BUY" | "SELL" | "SWITCH" | "HOLD";
	assetClass: string;
	productId?: string;
	isin?: string;
	schemeName: string;
	amcName?: string;
	amount?: number;
	units?: number;
	currentValue?: number;
	switchFromIsin?: string;
	switchFromSchemeName?: string;
	rationale: string;
	problemIdentified?: string;
	riskInvolved?: string;
	portfolioImpactSummary?: string;
	riskImpactPercent?: string;
	productDisclaimer?: string;
	status: string;
	priority?: number;
}

interface Proposal {
	id: string;
	clientId: string;
	agentId?: string;
	diagnosticsId: string;
	title: string;
	sebiDisclaimer: string;
	status: string;
	approvedItemsCount: number;
	rejectedItemsCount: number;
	totalRecommendations: number;
	createdAt: string;
	submittedAt?: string;
	clientApprovedAt?: string;
}

const SEBI_DISCLAIMER = `This investment proposal is generated using an AI-assisted analytical system based on information provided by the client and available market data. The recommendations are not investment advice, do not assure returns, and are subject to market risks. Final investment decisions shall be taken by the client after independent evaluation.`;

const actionTypeIcons: Record<string, any> = {
	BUY: TrendingUp,
	SELL: TrendingDown,
	SWITCH: ArrowRightLeft,
	HOLD: Clock,
};

const actionTypeColors: Record<string, string> = {
	BUY: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	SELL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
	SWITCH: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	HOLD: "bg-muted text-foreground",
};

const statusColors: Record<string, string> = {
	draft: "bg-muted text-foreground",
	pending_review:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	reviewed: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
	approved:
		"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	partially_approved:
		"bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
	executed:
		"bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
};

export default function AIProposalsPage() {
	const [selectedClientId, setSelectedClientId] = useState<string>("");
	const [activeTab, setActiveTab] = useState("generate");
	const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
		null,
	);
	const [proposalItems, setProposalItems] = useState<ProposalItem[]>([]);
	const [diagnostics, setDiagnostics] = useState<PortfolioDiagnostics | null>(
		null,
	);
	const [editingItem, setEditingItem] = useState<ProposalItem | null>(null);
	const [editAmount, setEditAmount] = useState<string>("");
	const [editReason, setEditReason] = useState<string>("");
	const [proposalTitle, setProposalTitle] = useState<string>("");
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const {
		data: proposals = [],
		isLoading: loadingProposals,
		refetch: refetchProposals,
	} = useQuery({
		queryKey: ["/api/ai-proposals/proposals", { role: "agent" }],
		queryFn: async () => {
			const res = await fetch("/api/ai-proposals/proposals?role=agent", {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to fetch proposals");
			return res.json() as Promise<Proposal[]>;
		},
	});

	const runDiagnosticsMutation = useMutation({
		mutationFn: async (clientId: string) => {
			return await apiRequest("/api/ai-proposals/diagnostics", {
				method: "POST",
				body: JSON.stringify({ userId: clientId }),
			});
		},
		onSuccess: (data) => {
			setDiagnostics(data);
			toast({
				title: "Diagnostics Complete",
				description: `Portfolio health score: ${data.healthScore}/100`,
			});
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Diagnostics Failed",
				description: error.message || "Could not run portfolio diagnostics",
			});
		},
	});

	const generateProposalMutation = useMutation({
		mutationFn: async ({
			clientId,
			diagnosticsId,
			title,
		}: { clientId: string; diagnosticsId?: string; title?: string }) => {
			return await apiRequest("/api/ai-proposals/generate", {
				method: "POST",
				body: JSON.stringify({ clientId, diagnosticsId, title }),
			});
		},
		onSuccess: (data) => {
			if (data.proposal) {
				setSelectedProposal(data.proposal);
				setProposalItems(data.items || []);
				setActiveTab("builder");
				toast({
					title: "Proposal Generated",
					description: `Created ${data.items?.length || 0} AI recommendations`,
				});
				refetchProposals();
			} else {
				toast({
					title: "No Recommendations Needed",
					description: data.message || "Portfolio is well balanced",
				});
			}
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Generation Failed",
				description: error.message || "Could not generate proposal",
			});
		},
	});

	const submitProposalMutation = useMutation({
		mutationFn: async (proposalId: string) => {
			return await apiRequest(
				`/api/ai-proposals/proposals/${proposalId}/submit`,
				{
					method: "POST",
					body: JSON.stringify({}),
				},
			);
		},
		onSuccess: () => {
			toast({
				title: "Proposal Submitted",
				description: "The proposal has been sent to the client for review",
			});
			refetchProposals();
			setActiveTab("proposals");
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Submission Failed",
				description: error.message || "Could not submit proposal",
			});
		},
	});

	const updateItemMutation = useMutation({
		mutationFn: async ({
			itemId,
			updates,
		}: { itemId: string; updates: any }) => {
			return await apiRequest(`/api/ai-proposals/items/${itemId}`, {
				method: "PUT",
				body: JSON.stringify(updates),
			});
		},
		onSuccess: (data) => {
			setProposalItems((items) =>
				items.map((item) => (item.id === data.id ? data : item)),
			);
			setEditingItem(null);
			toast({
				title: "Item Updated",
				description: "Recommendation has been modified",
			});
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Update Failed",
				description: error.message || "Could not update item",
			});
		},
	});

	const loadProposalDetails = async (proposal: Proposal) => {
		try {
			const res = await fetch(`/api/ai-proposals/proposals/${proposal.id}`, {
				credentials: "include",
			});
			const data = await res.json();
			setSelectedProposal(data.proposal);
			setProposalItems(data.items || []);

			if (data.proposal.diagnosticsId) {
				const diagRes = await fetch(
					`/api/ai-proposals/diagnostics/${data.proposal.diagnosticsId}`,
					{ credentials: "include" },
				);
				const diagData = await diagRes.json();
				setDiagnostics(diagData);
			}
			setActiveTab("builder");
		} catch (error: any) {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Could not load proposal details",
			});
		}
	};

	const handleRunDiagnostics = () => {
		if (!selectedClientId) {
			toast({
				variant: "destructive",
				title: "Client Required",
				description: "Please enter a client ID to run diagnostics",
			});
			return;
		}
		runDiagnosticsMutation.mutate(selectedClientId);
	};

	const handleGenerateProposal = () => {
		if (!selectedClientId) {
			toast({
				variant: "destructive",
				title: "Client Required",
				description: "Please enter a client ID first",
			});
			return;
		}
		generateProposalMutation.mutate({
			clientId: selectedClientId,
			diagnosticsId: diagnostics?.id,
			title:
				proposalTitle ||
				`AI Investment Proposal - ${new Date().toLocaleDateString()}`,
		});
	};

	const handleEditItem = (item: ProposalItem) => {
		setEditingItem(item);
		setEditAmount(item.amount?.toString() || "");
		setEditReason("");
	};

	const handleSaveItemEdit = () => {
		if (!editingItem) return;
		updateItemMutation.mutate({
			itemId: editingItem.id,
			updates: {
				amount: editAmount ? Number.parseFloat(editAmount) : undefined,
				agentModificationReason: editReason,
				actorRole: "agent",
			},
		});
	};

	const handleSubmitToClient = () => {
		if (!selectedProposal) return;
		submitProposalMutation.mutate(selectedProposal.id);
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const getHealthColor = (score: number) => {
		if (score >= 80) return "text-green-600";
		if (score >= 60) return "text-yellow-600";
		return "text-red-600";
	};

	const getHealthBg = (score: number) => {
		if (score >= 80) return "bg-green-500";
		if (score >= 60) return "bg-yellow-500";
		return "bg-red-500";
	};

	return (
		<div className="container mx-auto py-6 px-4 max-w-7xl">
			<div className="mb-6">
				<div className="flex items-center gap-3 mb-2">
					<Brain className="h-8 w-8 text-primary" />
					<h1 className="text-3xl font-bold" data-testid="text-page-title">
						AI Proposal Engine
					</h1>
				</div>
				<p className="text-muted-foreground">
					Generate intelligent, SEBI-compliant investment recommendations for
					your clients
				</p>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
					<TabsTrigger value="generate" data-testid="tab-generate">
						<Plus className="h-4 w-4 mr-2" />
						Generate
					</TabsTrigger>
					<TabsTrigger value="builder" data-testid="tab-builder">
						<Edit className="h-4 w-4 mr-2" />
						Builder
					</TabsTrigger>
					<TabsTrigger value="proposals" data-testid="tab-proposals">
						<FileText className="h-4 w-4 mr-2" />
						Proposals
					</TabsTrigger>
				</TabsList>

				<TabsContent value="generate" className="mt-6 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<User className="h-5 w-5" />
								Client Selection
							</CardTitle>
							<CardDescription>
								Enter the client ID to analyze their portfolio and generate
								recommendations
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex gap-4">
								<div className="flex-1">
									<Label htmlFor="clientId">Client ID</Label>
									<Input
										id="clientId"
										placeholder="Enter client ID..."
										value={selectedClientId}
										onChange={(e) => setSelectedClientId(e.target.value)}
										data-testid="input-client-id"
									/>
								</div>
								<div className="flex-1">
									<Label htmlFor="proposalTitle">
										Proposal Title (Optional)
									</Label>
									<Input
										id="proposalTitle"
										placeholder="e.g., Q4 2024 Rebalancing"
										value={proposalTitle}
										onChange={(e) => setProposalTitle(e.target.value)}
										data-testid="input-proposal-title"
									/>
								</div>
							</div>
							<div className="flex gap-3">
								<Button
									onClick={handleRunDiagnostics}
									disabled={
										runDiagnosticsMutation.isPending || !selectedClientId
									}
									variant="outline"
									data-testid="button-run-diagnostics"
								>
									{runDiagnosticsMutation.isPending ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<BarChart3 className="h-4 w-4 mr-2" />
									)}
									Run Diagnostics
								</Button>
								<Button
									onClick={handleGenerateProposal}
									disabled={
										generateProposalMutation.isPending || !selectedClientId
									}
									data-testid="button-generate-proposal"
								>
									{generateProposalMutation.isPending ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Brain className="h-4 w-4 mr-2" />
									)}
									Generate AI Proposal
								</Button>
							</div>
						</CardContent>
					</Card>

					{diagnostics && (
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										<span className="flex items-center gap-2">
											<PieChart className="h-5 w-5" />
											Portfolio Health
										</span>
										<span
											className={`text-3xl font-bold ${getHealthColor(diagnostics.healthScore)}`}
										>
											{diagnostics.healthScore}/100
										</span>
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<Progress
										value={diagnostics.healthScore}
										className={getHealthBg(diagnostics.healthScore)}
									/>
									<p className="text-sm text-muted-foreground">
										{diagnostics.healthSummary}
									</p>

									<div className="grid grid-cols-3 gap-4 pt-4">
										<div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
											<p className="text-2xl font-bold text-red-600">
												{diagnostics.issueCount.critical}
											</p>
											<p className="text-xs text-muted-foreground">Critical</p>
										</div>
										<div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
											<p className="text-2xl font-bold text-yellow-600">
												{diagnostics.issueCount.warning}
											</p>
											<p className="text-xs text-muted-foreground">Warnings</p>
										</div>
										<div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
											<p className="text-2xl font-bold text-blue-600">
												{diagnostics.issueCount.info}
											</p>
											<p className="text-xs text-muted-foreground">Info</p>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<BarChart3 className="h-5 w-5" />
										Asset Allocation
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										{Object.entries(diagnostics.allocationDeviation).map(
											([asset, data]) => (
												<div key={asset} className="space-y-1">
													<div className="flex justify-between text-sm">
														<span className="capitalize">{asset}</span>
														<span
															className={
																data.deviation > 5
																	? "text-orange-600 font-medium"
																	: data.deviation < -5
																		? "text-red-600 font-medium"
																		: "text-green-600"
															}
														>
															{data.current.toFixed(1)}% (Target: {data.target}
															%)
														</span>
													</div>
													<div className="flex gap-2 items-center">
														<Progress value={data.current} className="flex-1" />
														<span className="text-xs w-16 text-right">
															{data.deviation > 0 ? "+" : ""}
															{data.deviation.toFixed(1)}%
														</span>
													</div>
												</div>
											),
										)}
									</div>
								</CardContent>
							</Card>

							{diagnostics.concentrationIssues.length > 0 && (
								<Card className="lg:col-span-2">
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<AlertTriangle className="h-5 w-5 text-yellow-500" />
											Concentration Issues
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											{diagnostics.concentrationIssues.map((issue, idx) => (
												<Alert
													key={idx}
													variant={
														issue.severity === "critical"
															? "destructive"
															: "default"
													}
												>
													<AlertCircle className="h-4 w-4" />
													<AlertTitle className="capitalize">
														{issue.type.replace("_", " ")}
													</AlertTitle>
													<AlertDescription>
														{issue.name}: {issue.currentPercent.toFixed(1)}%
														(Limit: {issue.limitPercent}%)
													</AlertDescription>
												</Alert>
											))}
										</div>
									</CardContent>
								</Card>
							)}
						</div>
					)}
				</TabsContent>

				<TabsContent value="builder" className="mt-6 space-y-6">
					{selectedProposal ? (
						<>
							<Card>
								<CardHeader>
									<div className="flex items-start justify-between">
										<div>
											<CardTitle>{selectedProposal.title}</CardTitle>
											<CardDescription>
												Created:{" "}
												{new Date(selectedProposal.createdAt).toLocaleString()}
											</CardDescription>
										</div>
										<Badge className={statusColors[selectedProposal.status]}>
											{selectedProposal.status.replace("_", " ")}
										</Badge>
									</div>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-3 gap-4 mb-4">
										<div className="text-center p-3 bg-muted rounded-lg">
											<p className="text-2xl font-bold">
												{proposalItems.length}
											</p>
											<p className="text-xs text-muted-foreground">
												Recommendations
											</p>
										</div>
										<div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
											<p className="text-2xl font-bold text-green-600">
												{selectedProposal.approvedItemsCount}
											</p>
											<p className="text-xs text-muted-foreground">Approved</p>
										</div>
										<div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
											<p className="text-2xl font-bold text-red-600">
												{selectedProposal.rejectedItemsCount}
											</p>
											<p className="text-xs text-muted-foreground">Rejected</p>
										</div>
									</div>
								</CardContent>
							</Card>

							<Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200">
								<LucideShield className="h-4 w-4" />
								<AlertTitle>SEBI Compliance Disclaimer</AlertTitle>
								<AlertDescription className="text-xs mt-2">
									{SEBI_DISCLAIMER}
								</AlertDescription>
							</Alert>

							<Card>
								<CardHeader>
									<CardTitle>AI Recommendations</CardTitle>
									<CardDescription>
										Review and optionally modify the AI-generated
										recommendations before sending to client
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ScrollArea className="h-[500px]">
										<div className="space-y-4">
											{proposalItems.map((item, idx) => {
												const ActionIcon =
													actionTypeIcons[item.actionType] || Clock;
												return (
													<Card
														key={item.id}
														className="border-l-4"
														style={{
															borderLeftColor:
																item.actionType === "BUY"
																	? "#22c55e"
																	: item.actionType === "SELL"
																		? "#ef4444"
																		: item.actionType === "SWITCH"
																			? "#3b82f6"
																			: "#6b7280",
														}}
													>
														<CardContent className="p-4">
															<div className="flex items-start justify-between mb-3">
																<div className="flex items-center gap-3">
																	<Badge
																		className={
																			actionTypeColors[item.actionType]
																		}
																	>
																		<ActionIcon className="h-3 w-3 mr-1" />
																		{item.actionType}
																	</Badge>
																	<span className="text-xs text-muted-foreground">
																		Priority: {item.priority || idx + 1}
																	</span>
																</div>
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() => handleEditItem(item)}
																	data-testid={`button-edit-item-${item.id}`}
																>
																	<Edit className="h-4 w-4" />
																</Button>
															</div>

															<h4 className="font-semibold mb-1">
																{item.schemeName}
															</h4>
															{item.amcName && (
																<p className="text-sm text-muted-foreground mb-2">
																	{item.amcName}
																</p>
															)}

															{item.switchFromSchemeName && (
																<div className="flex items-center gap-2 text-sm mb-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
																	<span className="text-muted-foreground">
																		Switch from:
																	</span>
																	<span>{item.switchFromSchemeName}</span>
																</div>
															)}

															<div className="grid grid-cols-2 gap-4 text-sm mb-3">
																{item.currentValue && (
																	<div>
																		<span className="text-muted-foreground">
																			Current Value:{" "}
																		</span>
																		<span className="font-medium">
																			{formatCurrency(item.currentValue)}
																		</span>
																	</div>
																)}
																{item.amount && (
																	<div>
																		<span className="text-muted-foreground">
																			Amount:{" "}
																		</span>
																		<span className="font-medium">
																			{formatCurrency(item.amount)}
																		</span>
																	</div>
																)}
															</div>

															<Separator className="my-3" />

															<div className="space-y-2 text-sm">
																<div>
																	<span className="font-medium text-primary">
																		Rationale:
																	</span>
																	<p className="text-muted-foreground mt-1">
																		{item.rationale}
																	</p>
																</div>
																{item.problemIdentified && (
																	<div>
																		<span className="font-medium text-orange-600">
																			Issue Identified:
																		</span>
																		<p className="text-muted-foreground mt-1">
																			{item.problemIdentified}
																		</p>
																	</div>
																)}
																{item.riskInvolved && (
																	<div>
																		<span className="font-medium text-red-600">
																			Risk:
																		</span>
																		<p className="text-muted-foreground mt-1">
																			{item.riskInvolved}
																		</p>
																	</div>
																)}
																{item.portfolioImpactSummary && (
																	<div>
																		<span className="font-medium text-green-600">
																			Portfolio Impact:
																		</span>
																		<p className="text-muted-foreground mt-1">
																			{item.portfolioImpactSummary}
																		</p>
																	</div>
																)}
															</div>
														</CardContent>
													</Card>
												);
											})}
										</div>
									</ScrollArea>
								</CardContent>
								<CardFooter className="flex justify-end gap-3">
									<Button
										variant="outline"
										onClick={() => setActiveTab("generate")}
										data-testid="button-back-to-generate"
									>
										Back
									</Button>
									<Button
										onClick={handleSubmitToClient}
										disabled={
											submitProposalMutation.isPending ||
											selectedProposal.status !== "draft"
										}
										data-testid="button-submit-to-client"
									>
										{submitProposalMutation.isPending ? (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										) : (
											<Send className="h-4 w-4 mr-2" />
										)}
										Submit to Client
									</Button>
								</CardFooter>
							</Card>
						</>
					) : (
						<Card>
							<CardContent className="py-12">
								<div className="text-center">
									<Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<h3 className="text-lg font-semibold mb-2">
										No Proposal Selected
									</h3>
									<p className="text-muted-foreground mb-4">
										Generate a new proposal or select one from the Proposals tab
									</p>
									<Button
										onClick={() => setActiveTab("generate")}
										data-testid="button-go-to-generate"
									>
										<Plus className="h-4 w-4 mr-2" />
										Generate New Proposal
									</Button>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="proposals" className="mt-6">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>My Proposals</CardTitle>
									<CardDescription>
										View and manage AI-generated proposals for your clients
									</CardDescription>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => refetchProposals()}
									data-testid="button-refresh-proposals"
								>
									<RefreshCw className="h-4 w-4 mr-2" />
									Refresh
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							{loadingProposals ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : proposals.length === 0 ? (
								<div className="text-center py-8">
									<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<h3 className="text-lg font-semibold mb-2">
										No Proposals Yet
									</h3>
									<p className="text-muted-foreground">
										Generate your first AI proposal to get started
									</p>
								</div>
							) : (
								<div className="rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Title</TableHead>
												<TableHead>Client</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Recommendations</TableHead>
												<TableHead>Created</TableHead>
												<TableHead>Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{proposals.map((proposal) => (
												<TableRow
													key={proposal.id}
													data-testid={`row-proposal-${proposal.id}`}
												>
													<TableCell className="font-medium">
														{proposal.title}
													</TableCell>
													<TableCell className="text-sm text-muted-foreground">
														{proposal.clientId.slice(0, 8)}...
													</TableCell>
													<TableCell>
														<Badge className={statusColors[proposal.status]}>
															{proposal.status.replace("_", " ")}
														</Badge>
													</TableCell>
													<TableCell>
														<span className="text-green-600">
															{proposal.approvedItemsCount}
														</span>
														{" / "}
														<span>{proposal.totalRecommendations}</span>
													</TableCell>
													<TableCell className="text-sm text-muted-foreground">
														{new Date(proposal.createdAt).toLocaleDateString()}
													</TableCell>
													<TableCell>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => loadProposalDetails(proposal)}
															data-testid={`button-view-proposal-${proposal.id}`}
														>
															<Eye className="h-4 w-4 mr-1" />
															View
														</Button>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Dialog
				open={!!editingItem}
				onOpenChange={(open) => !open && setEditingItem(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Recommendation</DialogTitle>
						<DialogDescription>
							Modify the AI recommendation. All changes are logged for SEBI
							compliance.
						</DialogDescription>
					</DialogHeader>
					{editingItem && (
						<div className="space-y-4 py-4">
							<div>
								<Label>Scheme</Label>
								<p className="text-sm text-muted-foreground">
									{editingItem.schemeName}
								</p>
							</div>
							<div>
								<Label>Action</Label>
								<Badge className={actionTypeColors[editingItem.actionType]}>
									{editingItem.actionType}
								</Badge>
							</div>
							<div>
								<Label htmlFor="edit-amount">Amount (₹)</Label>
								<Input
									id="edit-amount"
									type="number"
									value={editAmount}
									onChange={(e) => setEditAmount(e.target.value)}
									placeholder="Enter modified amount"
									data-testid="input-edit-amount"
								/>
							</div>
							<div>
								<Label htmlFor="edit-reason">Reason for Modification *</Label>
								<Textarea
									id="edit-reason"
									value={editReason}
									onChange={(e) => setEditReason(e.target.value)}
									placeholder="Explain why you are modifying this recommendation..."
									rows={3}
									data-testid="input-edit-reason"
								/>
								<p className="text-xs text-muted-foreground mt-1">
									This will be recorded in the audit log for compliance purposes
								</p>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingItem(null)}>
							Cancel
						</Button>
						<Button
							onClick={handleSaveItemEdit}
							disabled={!editReason.trim() || updateItemMutation.isPending}
							data-testid="button-save-edit"
						>
							{updateItemMutation.isPending && (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							)}
							Save Changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
