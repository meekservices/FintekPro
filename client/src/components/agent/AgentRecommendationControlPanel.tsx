import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsTrigger, TabsList } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	User,
	Shield as LucideShield,
	TrendingUp,
	AlertTriangle,
	CheckCircle2,
	Clock,
	Target,
	Wallet,
	Edit3,
	Save,
	RotateCcw,
	Send,
	FileText,
	Lock,
	Unlock,
	AlertCircle,
	Info,
} from "lucide-react";

type RecommendationMode = "conservative" | "balanced" | "growth";

interface ClientContext {
	clientId: string;
	clientName: string;
	riskProfile: string;
	timeHorizon: number;
	liquidityNeeds: string;
	kycTier: string;
	existingPortfolio: {
		equity: number;
		debt: number;
		alternatives: number;
		cash: number;
	};
	totalAum: number;
}

interface RecommendationItem {
	productId: string;
	productName: string;
	productType: string;
	category: string;
	allocation: number;
	suitabilityScore: number;
	upsideScore: number;
	finalScore: number;
	explanation: string;
	isGrowthFocused: boolean;
	isLocked: boolean;
}

interface AgentOverride {
	type: "mode_downgrade" | "asset_class_lock" | "allocation_cap";
	productId?: string;
	previousValue: string;
	newValue: string;
	reason: string;
	timestamp: string;
}

interface Props {
	clientId: string;
	onProposalCreated?: (proposalId: string) => void;
}

export function AgentRecommendationControlPanel({
	clientId,
	onProposalCreated,
}: Props) {
	const { toast } = useToast();
	const [selectedMode, setSelectedMode] =
		useState<RecommendationMode>("balanced");
	const [overrides, setOverrides] = useState<AgentOverride[]>([]);
	const [editingItem, setEditingItem] = useState<string | null>(null);
	const [overrideReason, setOverrideReason] = useState("");
	const [showOverrideDialog, setShowOverrideDialog] = useState(false);
	const [pendingOverride, setPendingOverride] =
		useState<Partial<AgentOverride> | null>(null);

	const { data: clientContext, isLoading: clientLoading } =
		useQuery<ClientContext>({
			queryKey: ["/api/agent/client-context", clientId],
			enabled: !!clientId,
		});

	const {
		data: recommendations,
		isLoading: recsLoading,
		refetch: refetchRecs,
	} = useQuery<{
		items: RecommendationItem[];
		mode: RecommendationMode;
		disclosureBanner?: string;
	}>({
		queryKey: ["/api/recommendations/scored-basket", clientId, selectedMode],
		enabled: !!clientId,
	});

	const { data: certificationStatus } = useQuery<{
		isCertified: boolean;
		certificationType: string;
		expiresAt?: string;
	}>({
		queryKey: ["/api/agent/certification/growth_optimized"],
	});

	const saveDraftMutation = useMutation({
		mutationFn: (data: {
			clientId: string;
			mode: RecommendationMode;
			items: RecommendationItem[];
			overrides: AgentOverride[];
		}) =>
			apiRequest("/api/agent/recommendation-drafts", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			toast({
				title: "Draft saved",
				description: "Your recommendation draft has been saved.",
			});
		},
	});

	const shareWithClientMutation = useMutation({
		mutationFn: (data: {
			clientId: string;
			mode: RecommendationMode;
			items: RecommendationItem[];
		}) =>
			apiRequest("/api/agent/share-recommendation", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			toast({
				title: "Shared with client",
				description:
					"The recommendation has been sent to the client for review.",
			});
		},
	});

	const createProposalMutation = useMutation({
		mutationFn: (data: {
			clientId: string;
			mode: RecommendationMode;
			items: RecommendationItem[];
			overrides: AgentOverride[];
		}) =>
			apiRequest("/api/agent/create-proposal", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: (result: any) => {
			toast({
				title: "Proposal created",
				description: "Investment proposal has been created.",
			});
			if (onProposalCreated && result?.proposalId) {
				onProposalCreated(result.proposalId);
			}
		},
	});

	const handleModeChange = (mode: RecommendationMode) => {
		if (mode === "growth" && !certificationStatus?.isCertified) {
			toast({
				title: "Certification required",
				description:
					"You must complete Growth-Optimized training to use this mode.",
				variant: "destructive",
			});
			return;
		}

		if (selectedMode !== mode) {
			const override: AgentOverride = {
				type: "mode_downgrade",
				previousValue: selectedMode,
				newValue: mode,
				reason:
					mode === "balanced" ? "Reverting to balanced mode" : "Mode change",
				timestamp: new Date().toISOString(),
			};

			if (mode !== "balanced") {
				setPendingOverride(override);
				setShowOverrideDialog(true);
			} else {
				setSelectedMode(mode);
				refetchRecs();
			}
		}
	};

	const confirmOverride = () => {
		if (pendingOverride && overrideReason.trim()) {
			const fullOverride: AgentOverride = {
				...pendingOverride,
				reason: overrideReason,
				timestamp: new Date().toISOString(),
			} as AgentOverride;

			setOverrides([...overrides, fullOverride]);

			if (
				pendingOverride.type === "mode_downgrade" &&
				pendingOverride.newValue
			) {
				setSelectedMode(pendingOverride.newValue as RecommendationMode);
				refetchRecs();
			}

			setShowOverrideDialog(false);
			setPendingOverride(null);
			setOverrideReason("");
		}
	};

	const handleAllocationChange = (productId: string, newAllocation: number) => {
		if (recommendations?.items) {
			const item = recommendations.items.find((i) => i.productId === productId);
			if (item && Math.abs(item.allocation - newAllocation) > 5) {
				setPendingOverride({
					type: "allocation_cap",
					productId,
					previousValue: `${item.allocation}%`,
					newValue: `${newAllocation}%`,
				});
				setShowOverrideDialog(true);
			}
		}
	};

	const toggleAssetLock = (productId: string, locked: boolean) => {
		const item = recommendations?.items?.find((i) => i.productId === productId);
		if (item) {
			setPendingOverride({
				type: "asset_class_lock",
				productId,
				previousValue: locked ? "unlocked" : "locked",
				newValue: locked ? "locked" : "unlocked",
			});
			setShowOverrideDialog(true);
		}
	};

	const getComplianceIndicator = (item: RecommendationItem) => {
		const hasOverride = overrides.some((o) => o.productId === item.productId);

		if (hasOverride) {
			return {
				color: "text-red-500",
				icon: AlertCircle,
				label: "Manual Override",
			};
		}
		if (selectedMode === "growth" && item.isGrowthFocused) {
			return {
				color: "text-yellow-500",
				icon: AlertTriangle,
				label: "Growth-Optimized",
			};
		}
		return {
			color: "text-green-500",
			icon: CheckCircle2,
			label: "Within Suitability",
		};
	};

	const handleResetToBalanced = () => {
		setSelectedMode("balanced");
		setOverrides([]);
		refetchRecs();
		toast({
			title: "Reset complete",
			description: "Recommendations reset to balanced mode.",
		});
	};

	if (clientLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{selectedMode === "growth" && recommendations?.disclosureBanner && (
				<Alert
					variant="destructive"
					className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
				>
					<AlertTriangle className="h-4 w-4 text-yellow-600" />
					<AlertTitle className="text-yellow-800 dark:text-yellow-200">
						Growth-Optimized Mode Active
					</AlertTitle>
					<AlertDescription className="text-yellow-700 dark:text-yellow-300">
						{recommendations.disclosureBanner}
					</AlertDescription>
				</Alert>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<Card className="lg:col-span-1">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<User className="h-5 w-5" />
							Client Context
						</CardTitle>
						<CardDescription>Read-only client profile</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{clientContext ? (
							<>
								<div>
									<Label className="text-muted-foreground text-xs">
										Client Name
									</Label>
									<p className="font-medium">{clientContext.clientName}</p>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label className="text-muted-foreground text-xs">
											Risk Profile
										</Label>
										<Badge variant="outline" className="mt-1">
											<LucideShield className="h-3 w-3 mr-1" />
											{clientContext.riskProfile}
										</Badge>
									</div>
									<div>
										<Label className="text-muted-foreground text-xs">
											Time Horizon
										</Label>
										<p className="font-medium">
											{clientContext.timeHorizon} years
										</p>
									</div>
								</div>
								<div>
									<Label className="text-muted-foreground text-xs">
										Liquidity Needs
									</Label>
									<Badge variant="secondary" className="mt-1">
										{clientContext.liquidityNeeds}
									</Badge>
								</div>
								<div>
									<Label className="text-muted-foreground text-xs">
										KYC Tier
									</Label>
									<Badge variant="outline" className="mt-1">
										{clientContext.kycTier}
									</Badge>
								</div>
								<Separator />
								<div>
									<Label className="text-muted-foreground text-xs">
										Existing Portfolio Snapshot
									</Label>
									<div className="mt-2 space-y-2">
										<div className="flex justify-between text-sm">
											<span>Equity</span>
											<span className="font-medium">
												{clientContext.existingPortfolio.equity}%
											</span>
										</div>
										<Progress
											value={clientContext.existingPortfolio.equity}
											className="h-2"
										/>
										<div className="flex justify-between text-sm">
											<span>Debt</span>
											<span className="font-medium">
												{clientContext.existingPortfolio.debt}%
											</span>
										</div>
										<Progress
											value={clientContext.existingPortfolio.debt}
											className="h-2"
										/>
										<div className="flex justify-between text-sm">
											<span>Alternatives</span>
											<span className="font-medium">
												{clientContext.existingPortfolio.alternatives}%
											</span>
										</div>
										<Progress
											value={clientContext.existingPortfolio.alternatives}
											className="h-2"
										/>
									</div>
								</div>
								<div>
									<Label className="text-muted-foreground text-xs">
										Total AUM
									</Label>
									<p className="font-bold text-lg">
										₹{(clientContext.totalAum / 100000).toFixed(2)} L
									</p>
								</div>
							</>
						) : (
							<p className="text-muted-foreground">No client selected</p>
						)}
					</CardContent>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<Target className="h-5 w-5" />
									Recommendation Mode
								</CardTitle>
								<CardDescription>
									Select recommendation optimization strategy
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={handleResetToBalanced}
							>
								<RotateCcw className="h-4 w-4 mr-2" />
								Reset to Balanced
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-3 gap-4">
							<Button
								variant={
									selectedMode === "conservative" ? "default" : "outline"
								}
								className="h-auto py-4 flex-col"
								onClick={() => handleModeChange("conservative")}
								data-testid="mode-conservative"
							>
								<LucideShield className="h-6 w-6 mb-2" />
								<span className="font-medium">Conservative</span>
								<span className="text-xs text-muted-foreground mt-1">
									85% Suitability / 15% Upside
								</span>
							</Button>
							<Button
								variant={selectedMode === "balanced" ? "default" : "outline"}
								className="h-auto py-4 flex-col"
								onClick={() => handleModeChange("balanced")}
								data-testid="mode-balanced"
							>
								<TrendingUp className="h-6 w-6 mb-2" />
								<span className="font-medium">Balanced</span>
								<span className="text-xs text-muted-foreground mt-1">
									70% Suitability / 30% Upside
								</span>
							</Button>
							<Button
								variant={selectedMode === "growth" ? "default" : "outline"}
								className={`h-auto py-4 flex-col ${!certificationStatus?.isCertified ? "opacity-50" : ""}`}
								onClick={() => handleModeChange("growth")}
								disabled={!certificationStatus?.isCertified}
								data-testid="mode-growth"
							>
								<Wallet className="h-6 w-6 mb-2" />
								<span className="font-medium">Growth-Optimized</span>
								<span className="text-xs text-muted-foreground mt-1">
									55% Suitability / 45% Upside
								</span>
								{!certificationStatus?.isCertified && (
									<Badge variant="destructive" className="mt-2 text-xs">
										<Lock className="h-3 w-3 mr-1" />
										Certification Required
									</Badge>
								)}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Recommendation Basket
					</CardTitle>
					<CardDescription>
						AI-generated recommendations based on client profile and selected
						mode
					</CardDescription>
				</CardHeader>
				<CardContent>
					{recsLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
						</div>
					) : recommendations?.items && recommendations.items.length > 0 ? (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product</TableHead>
									<TableHead>Category</TableHead>
									<TableHead className="text-center">Allocation %</TableHead>
									<TableHead className="text-center">Score</TableHead>
									<TableHead className="text-center">
										Growth vs Stability
									</TableHead>
									<TableHead className="text-center">Compliance</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{recommendations.items.map((item) => {
									const compliance = getComplianceIndicator(item);
									return (
										<TableRow
											key={item.productId}
											data-testid={`recommendation-row-${item.productId}`}
										>
											<TableCell>
												<div>
													<p className="font-medium">{item.productName}</p>
													<p className="text-xs text-muted-foreground">
														{item.productType}
													</p>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant="outline">{item.category}</Badge>
											</TableCell>
											<TableCell className="text-center">
												{editingItem === item.productId ? (
													<Input
														type="number"
														min={0}
														max={100}
														defaultValue={item.allocation}
														className="w-20 mx-auto"
														onBlur={(e) => {
															handleAllocationChange(
																item.productId,
																Number.parseInt(e.target.value),
															);
															setEditingItem(null);
														}}
													/>
												) : (
													<span className="font-medium">
														{item.allocation}%
													</span>
												)}
											</TableCell>
											<TableCell className="text-center">
												<div className="flex flex-col items-center">
													<span className="font-bold text-lg">
														{item.finalScore}
													</span>
													<span className="text-xs text-muted-foreground">
														S:{item.suitabilityScore} / U:{item.upsideScore}
													</span>
												</div>
											</TableCell>
											<TableCell className="text-center">
												<div className="flex items-center justify-center gap-2">
													<div className="w-16 bg-muted rounded-full h-2">
														<div
															className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
															style={{ width: `${item.upsideScore}%` }}
														/>
													</div>
													<span className="text-xs">
														{item.isGrowthFocused ? "Growth" : "Stable"}
													</span>
												</div>
											</TableCell>
											<TableCell className="text-center">
												<Badge variant="outline" className={compliance.color}>
													<compliance.icon className="h-3 w-3 mr-1" />
													{compliance.label}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-1">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setEditingItem(item.productId)}
														data-testid={`edit-allocation-${item.productId}`}
													>
														<Edit3 className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															toggleAssetLock(item.productId, !item.isLocked)
														}
														data-testid={`toggle-lock-${item.productId}`}
													>
														{item.isLocked ? (
															<Lock className="h-4 w-4" />
														) : (
															<Unlock className="h-4 w-4" />
														)}
													</Button>
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					) : (
						<div className="text-center py-8 text-muted-foreground">
							<Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>
								No recommendations available. Select a client and mode to
								generate recommendations.
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardContent className="pt-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							{overrides.length > 0 && (
								<Badge variant="outline" className="text-yellow-600">
									<AlertTriangle className="h-3 w-3 mr-1" />
									{overrides.length} Override(s) Applied
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								onClick={() =>
									saveDraftMutation.mutate({
										clientId,
										mode: selectedMode,
										items: recommendations?.items || [],
										overrides,
									})
								}
								disabled={saveDraftMutation.isPending}
								data-testid="save-draft-btn"
							>
								<Save className="h-4 w-4 mr-2" />
								Save Draft
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									shareWithClientMutation.mutate({
										clientId,
										mode: selectedMode,
										items: recommendations?.items || [],
									})
								}
								disabled={shareWithClientMutation.isPending}
								data-testid="share-client-btn"
							>
								<Send className="h-4 w-4 mr-2" />
								Share with Client
							</Button>
							<Button
								onClick={() =>
									createProposalMutation.mutate({
										clientId,
										mode: selectedMode,
										items: recommendations?.items || [],
										overrides,
									})
								}
								disabled={createProposalMutation.isPending}
								data-testid="create-proposal-btn"
							>
								<FileText className="h-4 w-4 mr-2" />
								Add to Proposal
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-yellow-500" />
							Override Reason Required
						</DialogTitle>
						<DialogDescription>
							You are making a manual override. Please provide a reason for this
							change. This will be logged for compliance purposes.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<Label>Override Type</Label>
							<p className="text-sm text-muted-foreground mt-1">
								{pendingOverride?.type === "mode_downgrade" && "Mode Change"}
								{pendingOverride?.type === "allocation_cap" &&
									"Allocation Adjustment"}
								{pendingOverride?.type === "asset_class_lock" &&
									"Asset Lock/Unlock"}
							</p>
						</div>
						<div>
							<Label>Change Details</Label>
							<p className="text-sm mt-1">
								<span className="text-muted-foreground">
									{pendingOverride?.previousValue}
								</span>
								{" → "}
								<span className="font-medium">{pendingOverride?.newValue}</span>
							</p>
						</div>
						<div>
							<Label htmlFor="override-reason">Reason (Required)</Label>
							<Textarea
								id="override-reason"
								placeholder="Enter the reason for this override..."
								value={overrideReason}
								onChange={(e) => setOverrideReason(e.target.value)}
								className="mt-1"
								data-testid="override-reason-input"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowOverrideDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={confirmOverride}
							disabled={!overrideReason.trim()}
							data-testid="confirm-override-btn"
						>
							Confirm Override
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
				<Info className="h-4 w-4 text-blue-600" />
				<AlertTitle className="text-blue-800 dark:text-blue-200">
					SEBI Compliance Notice
				</AlertTitle>
				<AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
					Mutual Fund investments are subject to market risks. Read all scheme
					related documents carefully before investing. Past performance is not
					indicative of future returns. The recommendations are based on the
					client's risk profile and investment horizon. Investment decisions
					should be made after careful evaluation.
				</AlertDescription>
			</Alert>
		</div>
	);
}
