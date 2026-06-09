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
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
	Plus,
	Edit,
	History,
	Copy,
	Lock,
	Check,
	AlertCircle,
	TrendingUp,
	Users,
	DollarSign,
	Settings,
	ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface CommissionPlan {
	id: number;
	productType: string;
	version: number;
	status: "draft" | "active" | "frozen" | "archived";
	isActive: boolean;
	effectiveFrom: string;
	effectiveTo: string | null;
	regulatoryCap: string | null;
	changeReason: string | null;
	createdBy: number;
	createdAt: string;
}

interface CommissionRoleMap {
	id: number;
	commissionPlanId: number;
	roleId: string;
	payoutPercentage: string;
	payoutMode: "upfront" | "trail" | "revenue_share" | "performance";
	minCap: string | null;
	maxCap: string | null;
}

interface CommissionHierarchySplit {
	id: number;
	commissionPlanId: number;
	roleId: string;
	hierarchyLevel: number;
	sharePercentage: string;
	passthroughRule: "stop" | "roll_up";
}

interface AuditLog {
	id: number;
	commissionPlanId: number;
	fieldChanged: string;
	oldValue: string | null;
	newValue: string | null;
	changedBy: number;
	changedAt: string;
	remarks: string | null;
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
	mutual_fund: "Mutual Funds (Regular)",
	mutual_fund_direct: "Mutual Funds (Direct)",
	stocks: "Stocks",
	ipos: "IPOs",
	bonds: "Bonds",
	loans: "Loans",
	insurance: "Insurance",
	unlisted: "Unlisted Shares",
	tax_services: "Tax Services",
	pms_aif: "PMS/AIF",
};

const PAYOUT_MODE_LABELS: Record<string, string> = {
	upfront: "Upfront",
	trail: "Trail",
	revenue_share: "Revenue Share",
	performance: "Performance",
};

const STATUS_COLORS: Record<string, string> = {
	draft:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
	active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	frozen: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	archived: "bg-muted text-foreground",
};

const COMMISSION_ROLES = [
	{ id: "master_agent", name: "Master Agent", level: 1 },
	{ id: "partner", name: "Partner", level: 2 },
	{ id: "agent", name: "Agent", level: 3 },
	{ id: "sub_agent", name: "Sub-Agent", level: 4 },
	{ id: "associate", name: "Associate", level: 5 },
	{ id: "district_associate", name: "District Associate", level: 6 },
	{ id: "field_associate", name: "Field Associate", level: 7 },
];

export default function CommissionMaster() {
	const { toast } = useToast();
	const [selectedProductType, setSelectedProductType] = useState<string>("all");
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [showAuditDialog, setShowAuditDialog] = useState(false);
	const [selectedPlan, setSelectedPlan] = useState<CommissionPlan | null>(null);
	const [planDetails, setPlanDetails] = useState<{
		plan: CommissionPlan;
		roleMaps: CommissionRoleMap[];
		hierarchySplits: CommissionHierarchySplit[];
	} | null>(null);

	const [newPlan, setNewPlan] = useState({
		product_type: "mutual_fund",
		effective_from: new Date().toISOString().split("T")[0],
		effective_to: "",
		reason: "",
		roles: COMMISSION_ROLES.map((r) => ({
			role_id: r.id,
			percentage: 0,
			payout_mode: "trail" as const,
		})),
		hierarchy_splits: COMMISSION_ROLES.map((r) => ({
			role_id: r.id,
			hierarchy_level: r.level,
			share_percentage: 0,
			passthrough_rule: "stop" as const,
		})),
	});

	const { data: plans = [], isLoading } = useQuery<CommissionPlan[]>({
		queryKey: [
			selectedProductType === "all"
				? "/api/admin/commission-plans"
				: `/api/admin/commission-plans?product_type=${selectedProductType}`,
		],
		enabled: true,
	});

	const { data: productTypes } = useQuery<{
		productTypes: string[];
		regulatoryCaps: Record<string, number>;
	}>({
		queryKey: ["/api/admin/commission-product-types"],
	});

	const { data: auditLogs = [] } = useQuery<AuditLog[]>({
		queryKey: ["/api/admin/commission-plan", selectedPlan?.id, "audit-log"],
		enabled: !!selectedPlan && showAuditDialog,
	});

	const invalidateCommissionPlans = () => {
		queryClient.invalidateQueries({
			predicate: (query) => {
				const key = query.queryKey[0];
				return (
					typeof key === "string" && key.includes("/api/admin/commission-plans")
				);
			},
		});
	};

	const createPlanMutation = useMutation({
		mutationFn: async (data: typeof newPlan) => {
			return apiRequest("/api/admin/commission-plan", {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			invalidateCommissionPlans();
			setShowCreateDialog(false);
			toast({
				title: "Success",
				description: "Commission plan created successfully",
			});
			resetNewPlan();
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to create plan",
				variant: "destructive",
			});
		},
	});

	const activatePlanMutation = useMutation({
		mutationFn: async (planId: number) => {
			return apiRequest(`/api/admin/commission-plan/${planId}/activate`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			invalidateCommissionPlans();
			toast({ title: "Success", description: "Plan activated successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to activate plan",
				variant: "destructive",
			});
		},
	});

	const freezePlanMutation = useMutation({
		mutationFn: async (planId: number) => {
			return apiRequest(`/api/admin/commission-plan/${planId}/freeze`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			invalidateCommissionPlans();
			toast({ title: "Success", description: "Plan frozen successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to freeze plan",
				variant: "destructive",
			});
		},
	});

	const clonePlanMutation = useMutation({
		mutationFn: async (planId: number) => {
			return apiRequest(`/api/admin/commission-plan/${planId}/clone`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			invalidateCommissionPlans();
			toast({ title: "Success", description: "Plan cloned successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to clone plan",
				variant: "destructive",
			});
		},
	});

	const resetNewPlan = () => {
		setNewPlan({
			product_type: "mutual_fund",
			effective_from: new Date().toISOString().split("T")[0],
			effective_to: "",
			reason: "",
			roles: COMMISSION_ROLES.map((r) => ({
				role_id: r.id,
				percentage: 0,
				payout_mode: "trail" as const,
			})),
			hierarchy_splits: COMMISSION_ROLES.map((r) => ({
				role_id: r.id,
				hierarchy_level: r.level,
				share_percentage: 0,
				passthrough_rule: "stop" as const,
			})),
		});
	};

	const handleCreatePlan = () => {
		const totalPercentage = newPlan.roles.reduce(
			(sum, r) => sum + r.percentage,
			0,
		);
		if (totalPercentage > 100) {
			toast({
				title: "Validation Error",
				description: "Total payout percentage cannot exceed 100%",
				variant: "destructive",
			});
			return;
		}
		createPlanMutation.mutate(newPlan);
	};

	const openAuditLog = (plan: CommissionPlan) => {
		setSelectedPlan(plan);
		setShowAuditDialog(true);
	};

	const filteredPlans =
		selectedProductType === "all"
			? plans
			: plans.filter((p) => p.productType === selectedProductType);

	const activePlansCount = plans.filter((p) => p.isActive).length;
	const draftPlansCount = plans.filter((p) => p.status === "draft").length;

	return (
		<div className="p-6 space-y-6" data-testid="commission-master-page">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Commission Master
					</h1>
					<p className="text-muted-foreground">
						Configure role-based commission plans by product type
					</p>
				</div>
				<Button
					className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md"
					onClick={() => setShowCreateDialog(true)}
					data-testid="btn-create-plan"
				>
					<Plus className="w-4 h-4 mr-2" />
					Create Plan
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total Plans</p>
								<p className="text-2xl font-bold">{plans.length}</p>
							</div>
							<Settings className="w-8 h-8 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Active Plans</p>
								<p className="text-2xl font-bold text-green-600">
									{activePlansCount}
								</p>
							</div>
							<Check className="w-8 h-8 text-green-500" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Draft Plans</p>
								<p className="text-2xl font-bold text-yellow-600">
									{draftPlansCount}
								</p>
							</div>
							<Edit className="w-8 h-8 text-yellow-500" />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Product Types</p>
								<p className="text-2xl font-bold">
									{productTypes?.productTypes.length || 0}
								</p>
							</div>
							<TrendingUp className="w-8 h-8 text-blue-500" />
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Commission Plans</CardTitle>
						<Select
							value={selectedProductType}
							onValueChange={setSelectedProductType}
						>
							<SelectTrigger
								className="w-48"
								data-testid="select-product-filter"
							>
								<SelectValue placeholder="Filter by product" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Products</SelectItem>
								{Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
									<SelectItem key={key} value={key}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="text-center py-8">Loading plans...</div>
					) : filteredPlans.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No commission plans found. Create your first plan to get started.
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Product Type</TableHead>
									<TableHead>Version</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Effective From</TableHead>
									<TableHead>Regulatory Cap</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredPlans.map((plan) => (
									<TableRow key={plan.id} data-testid={`plan-row-${plan.id}`}>
										<TableCell className="font-medium">
											{PRODUCT_TYPE_LABELS[plan.productType] ||
												plan.productType}
										</TableCell>
										<TableCell>v{plan.version}</TableCell>
										<TableCell>
											<Badge className={STATUS_COLORS[plan.status]}>
												{plan.status.charAt(0).toUpperCase() +
													plan.status.slice(1)}
											</Badge>
										</TableCell>
										<TableCell>
											{format(new Date(plan.effectiveFrom), "dd MMM yyyy")}
										</TableCell>
										<TableCell>
											{plan.regulatoryCap ? `${plan.regulatoryCap}%` : "-"}
										</TableCell>
										<TableCell>
											{format(new Date(plan.createdAt), "dd MMM yyyy")}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												{plan.status === "draft" && (
													<Button
														size="sm"
														variant="outline"
														className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
														onClick={() => activatePlanMutation.mutate(plan.id)}
														disabled={activatePlanMutation.isPending}
														data-testid={`btn-activate-${plan.id}`}
													>
														<Check className="w-3 h-3 mr-1" />
														Activate
													</Button>
												)}
												{plan.status !== "frozen" && (
													<Button
														size="sm"
														variant="outline"
														className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
														onClick={() => freezePlanMutation.mutate(plan.id)}
														disabled={freezePlanMutation.isPending}
														data-testid={`btn-freeze-${plan.id}`}
													>
														<Lock className="w-3 h-3 mr-1" />
														Freeze
													</Button>
												)}
												<Button
													size="sm"
													variant="outline"
													className="border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950"
													onClick={() => clonePlanMutation.mutate(plan.id)}
													disabled={clonePlanMutation.isPending}
													data-testid={`btn-clone-${plan.id}`}
												>
													<Copy className="w-3 h-3 mr-1" />
													Clone
												</Button>
												<Button
													size="sm"
													variant="ghost"
													className="text-muted-foreground hover:text-foreground hover:bg-muted"
													onClick={() => openAuditLog(plan)}
													data-testid={`btn-audit-${plan.id}`}
												>
													<History className="w-3 h-3" />
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

			<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Create Commission Plan</DialogTitle>
						<DialogDescription>
							Configure commission rates for each role in the distribution
							hierarchy
						</DialogDescription>
					</DialogHeader>

					<Tabs defaultValue="basic" className="w-full">
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="basic">Basic Info</TabsTrigger>
							<TabsTrigger value="roles">Role Percentages</TabsTrigger>
							<TabsTrigger value="hierarchy">Hierarchy Splits</TabsTrigger>
						</TabsList>

						<TabsContent value="basic" className="space-y-4 mt-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Product Type</Label>
									<Select
										value={newPlan.product_type}
										onValueChange={(v) =>
											setNewPlan({ ...newPlan, product_type: v })
										}
									>
										<SelectTrigger data-testid="select-product-type">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{Object.entries(PRODUCT_TYPE_LABELS).map(
												([key, label]) => (
													<SelectItem key={key} value={key}>
														{label}
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Regulatory Cap</Label>
									<Input
										value={
											productTypes?.regulatoryCaps[
												newPlan.product_type as keyof typeof productTypes.regulatoryCaps
											] || ""
										}
										disabled
										className="bg-muted"
									/>
									<p className="text-xs text-muted-foreground">
										Set by SEBI/AMFI regulations
									</p>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Effective From</Label>
									<Input
										type="date"
										value={newPlan.effective_from}
										onChange={(e) =>
											setNewPlan({ ...newPlan, effective_from: e.target.value })
										}
										data-testid="input-effective-from"
									/>
								</div>
								<div className="space-y-2">
									<Label>Effective To (Optional)</Label>
									<Input
										type="date"
										value={newPlan.effective_to}
										onChange={(e) =>
											setNewPlan({ ...newPlan, effective_to: e.target.value })
										}
										data-testid="input-effective-to"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Change Reason</Label>
								<Textarea
									value={newPlan.reason}
									onChange={(e) =>
										setNewPlan({ ...newPlan, reason: e.target.value })
									}
									placeholder="Describe the reason for this commission plan..."
									data-testid="input-reason"
								/>
							</div>
						</TabsContent>

						<TabsContent value="roles" className="mt-4">
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<p className="text-sm text-muted-foreground">
										Configure payout percentage for each role
									</p>
									<Badge
										variant={
											newPlan.roles.reduce((sum, r) => sum + r.percentage, 0) >
											100
												? "destructive"
												: "secondary"
										}
									>
										Total:{" "}
										{newPlan.roles.reduce((sum, r) => sum + r.percentage, 0)}%
									</Badge>
								</div>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Role</TableHead>
											<TableHead>Percentage (%)</TableHead>
											<TableHead>Payout Mode</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{COMMISSION_ROLES.map((role, idx) => (
											<TableRow key={role.id}>
												<TableCell className="font-medium">
													{role.name}
												</TableCell>
												<TableCell>
													<Input
														type="number"
														min="0"
														max="100"
														step="0.5"
														value={newPlan.roles[idx]?.percentage || 0}
														onChange={(e) => {
															const updated = [...newPlan.roles];
															updated[idx] = {
																...updated[idx],
																percentage:
																	Number.parseFloat(e.target.value) || 0,
															};
															setNewPlan({ ...newPlan, roles: updated });
														}}
														className="w-24"
														data-testid={`input-percentage-${role.id}`}
													/>
												</TableCell>
												<TableCell>
													<Select
														value={newPlan.roles[idx]?.payout_mode || "trail"}
														onValueChange={(v) => {
															const updated = [...newPlan.roles];
															updated[idx] = {
																...updated[idx],
																payout_mode: v as any,
															};
															setNewPlan({ ...newPlan, roles: updated });
														}}
													>
														<SelectTrigger className="w-32">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{Object.entries(PAYOUT_MODE_LABELS).map(
																([key, label]) => (
																	<SelectItem key={key} value={key}>
																		{label}
																	</SelectItem>
																),
															)}
														</SelectContent>
													</Select>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</TabsContent>

						<TabsContent value="hierarchy" className="mt-4">
							<div className="space-y-4">
								<p className="text-sm text-muted-foreground">
									Configure hierarchy split percentages for commission
									distribution
								</p>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Role</TableHead>
											<TableHead>Hierarchy Level</TableHead>
											<TableHead>Share (%)</TableHead>
											<TableHead>Passthrough Rule</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{COMMISSION_ROLES.map((role, idx) => (
											<TableRow key={role.id}>
												<TableCell className="font-medium">
													{role.name}
												</TableCell>
												<TableCell>{role.level}</TableCell>
												<TableCell>
													<Input
														type="number"
														min="0"
														max="100"
														step="0.5"
														value={
															newPlan.hierarchy_splits[idx]?.share_percentage ||
															0
														}
														onChange={(e) => {
															const updated = [...newPlan.hierarchy_splits];
															updated[idx] = {
																...updated[idx],
																share_percentage:
																	Number.parseFloat(e.target.value) || 0,
															};
															setNewPlan({
																...newPlan,
																hierarchy_splits: updated,
															});
														}}
														className="w-24"
														data-testid={`input-share-${role.id}`}
													/>
												</TableCell>
												<TableCell>
													<Select
														value={
															newPlan.hierarchy_splits[idx]?.passthrough_rule ||
															"stop"
														}
														onValueChange={(v) => {
															const updated = [...newPlan.hierarchy_splits];
															updated[idx] = {
																...updated[idx],
																passthrough_rule: v as any,
															};
															setNewPlan({
																...newPlan,
																hierarchy_splits: updated,
															});
														}}
													>
														<SelectTrigger className="w-28">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="stop">Stop</SelectItem>
															<SelectItem value="roll_up">Roll Up</SelectItem>
														</SelectContent>
													</Select>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</TabsContent>
					</Tabs>

					<DialogFooter>
						<Button
							variant="outline"
							className="border-border text-muted-foreground hover:bg-muted"
							onClick={() => setShowCreateDialog(false)}
						>
							Cancel
						</Button>
						<Button
							className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground"
							onClick={handleCreatePlan}
							disabled={createPlanMutation.isPending}
							data-testid="btn-submit-plan"
						>
							{createPlanMutation.isPending ? "Creating..." : "Create Plan"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
				<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Audit Log</DialogTitle>
						<DialogDescription>
							Complete modification history for{" "}
							{selectedPlan && PRODUCT_TYPE_LABELS[selectedPlan.productType]} v
							{selectedPlan?.version}
						</DialogDescription>
					</DialogHeader>

					{auditLogs.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No audit entries found
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Timestamp</TableHead>
									<TableHead>Field Changed</TableHead>
									<TableHead>Old Value</TableHead>
									<TableHead>New Value</TableHead>
									<TableHead>Remarks</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{auditLogs.map((log) => (
									<TableRow key={log.id}>
										<TableCell className="text-sm">
											{format(new Date(log.changedAt), "dd MMM yyyy HH:mm")}
										</TableCell>
										<TableCell className="font-medium">
											{log.fieldChanged}
										</TableCell>
										<TableCell
											className="text-sm max-w-32 truncate"
											title={log.oldValue || ""}
										>
											{log.oldValue || "-"}
										</TableCell>
										<TableCell
											className="text-sm max-w-32 truncate"
											title={log.newValue || ""}
										>
											{log.newValue || "-"}
										</TableCell>
										<TableCell className="text-sm">
											{log.remarks || "-"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							className="border-border text-muted-foreground hover:bg-muted"
							onClick={() => setShowAuditDialog(false)}
						>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
