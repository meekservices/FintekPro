import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
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
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Users,
	CheckCircle,
	XCircle,
	AlertTriangle,
	Shield as LucideShield,
	Clock,
	ChevronRight,
	GitBranch,
	IndianRupee,
	FileText,
	Search,
	RefreshCw,
	Wallet,
	Ban,
	Trash2,
	Eye,
	Settings2,
	Activity,
	BadgeCheck,
	Building2,
	Phone,
	Mail,
	Hash,
} from "lucide-react";

interface Partner {
	id: string;
	userId?: string;
	companyName: string;
	contactEmail: string;
	contactPhone?: string;
	partnerType: string;
	partnerLevel?: string;
	hierarchyPartnerType?: string;
	hierarchyStatus?: string;
	approvalStatus?: string;
	kycStatus?: string;
	isActive?: boolean;
	commissionRate?: string;
	parentPartnerId?: string;
	arnCode?: string;
	createdAt?: string;
	sourceType?: "hierarchy" | "user_account";
	roles?: string[];
}

interface CommissionRule {
	id?: string;
	ruleId?: string;
	productType: string;
	agentPct: number;
	subPartnerPct: number;
	masterPartnerPct: number;
	platformPct: number;
	isActive?: boolean;
	createdAt?: string;
}

interface AuditLog {
	id: string;
	actorId: string;
	action: string;
	entityType: string;
	entityId: string;
	metadata?: any;
	ipAddress?: string;
	createdAt: string;
}

function statusBadge(status: string | undefined | null) {
	if (!status) return <Badge variant="secondary">—</Badge>;
	const s = status.toUpperCase();
	if (s === "APPROVED" || s === "VERIFIED" || s === "ACTIVE")
		return (
			<Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
				{status}
			</Badge>
		);
	if (s === "PENDING")
		return (
			<Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
				{status}
			</Badge>
		);
	if (s === "REJECTED" || s === "SUSPENDED" || s === "TERMINATED")
		return (
			<Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
				{status}
			</Badge>
		);
	return <Badge variant="secondary">{status}</Badge>;
}

function PartnerRow({
	partner,
	onAction,
}: { partner: Partner; onAction: (action: string, partner: Partner) => void }) {
	const isUserAccount = partner.sourceType === "user_account";
	return (
		<TableRow
			className={isUserAccount ? "bg-blue-50/30 dark:bg-blue-950/20" : ""}
		>
			<TableCell>
				<div className="font-medium flex items-center gap-2">
					{partner.companyName}
					{isUserAccount && (
						<Badge
							variant="outline"
							className="text-[10px] px-1 py-0 border-blue-400 text-blue-600 dark:text-blue-400"
						>
							User Account
						</Badge>
					)}
				</div>
				<div className="text-xs text-muted-foreground flex items-center gap-1">
					<Mail className="h-3 w-3" />
					{partner.contactEmail}
				</div>
				{partner.contactPhone && (
					<div className="text-xs text-muted-foreground flex items-center gap-1">
						<Phone className="h-3 w-3" />
						{partner.contactPhone}
					</div>
				)}
				{isUserAccount && partner.roles && (
					<div className="flex gap-1 mt-1 flex-wrap">
						{partner.roles
							.filter((r) =>
								["partner", "agent", "admin", "superadmin"].includes(r),
							)
							.map((r) => (
								<span
									key={r}
									className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-1"
								>
									{r}
								</span>
							))}
					</div>
				)}
				<div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-mono">
					<Hash className="h-3 w-3" />
					<span className="select-all" title={`Reference UUID: ${partner.id}`}>
						{partner.userId || partner.id}
					</span>
				</div>
			</TableCell>
			<TableCell>
				<div className="text-sm">
					{partner.hierarchyPartnerType || partner.partnerType || "—"}
				</div>
				{partner.partnerLevel && (
					<div className="text-xs text-muted-foreground">
						{partner.partnerLevel}
					</div>
				)}
				{partner.arnCode && (
					<div className="text-xs text-muted-foreground">
						ARN: {partner.arnCode}
					</div>
				)}
			</TableCell>
			<TableCell>{statusBadge(partner.approvalStatus)}</TableCell>
			<TableCell>{statusBadge(partner.kycStatus)}</TableCell>
			<TableCell>
				{statusBadge(
					partner.hierarchyStatus || (partner.isActive ? "ACTIVE" : "INACTIVE"),
				)}
			</TableCell>
			<TableCell className="text-right">
				<div className="flex justify-end gap-1">
					<Button
						size="icon"
						variant="ghost"
						title="View downline"
						onClick={() => onAction("downline", partner)}
					>
						<GitBranch className="h-4 w-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						title="Wallet"
						onClick={() => onAction("wallet", partner)}
					>
						<Wallet className="h-4 w-4" />
					</Button>
					{partner.hierarchyStatus !== "SUSPENDED" &&
						partner.hierarchyStatus !== "TERMINATED" && (
							<Button
								size="icon"
								variant="ghost"
								title="Suspend"
								onClick={() => onAction("suspend", partner)}
							>
								<Ban className="h-4 w-4 text-orange-500" />
							</Button>
						)}
					{partner.hierarchyStatus !== "TERMINATED" && (
						<Button
							size="icon"
							variant="ghost"
							title="Terminate"
							onClick={() => onAction("terminate", partner)}
						>
							<Trash2 className="h-4 w-4 text-red-500" />
						</Button>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}

export default function AdminPartnerHierarchy() {
	const { toast } = useToast();
	const [search, setSearch] = useState("");
	const [rejectPartnerId, setRejectPartnerId] = useState<string | null>(null);
	const [rejectReason, setRejectReason] = useState("");
	const [kycDialog, setKycDialog] = useState<{
		partnerId: string;
		current: string;
	} | null>(null);
	const [downlineDialog, setDownlineDialog] = useState<Partner | null>(null);
	const [walletDialog, setWalletDialog] = useState<Partner | null>(null);
	const [ruleDialog, setRuleDialog] = useState<CommissionRule | null>(null);
	const [payoutPartner, setPayoutPartner] = useState<Partner | null>(null);
	const [payoutAmount, setPayoutAmount] = useState("");
	const [confirmAction, setConfirmAction] = useState<{
		type: string;
		partner: Partner;
	} | null>(null);
	const [auditFilter, setAuditFilter] = useState({
		entityType: "",
		entityId: "",
		action: "",
	});

	const {
		data: pending = [],
		isLoading: pendingLoading,
		refetch: refetchPending,
	} = useQuery<Partner[]>({
		queryKey: ["/api/partner-hierarchy/partners/pending"],
	});

	const { data: allPartners = [], isLoading: allLoading } = useQuery<Partner[]>(
		{
			queryKey: ["/api/partner-hierarchy/partners"],
		},
	);

	const { data: commissionRules = [], isLoading: rulesLoading } = useQuery<
		CommissionRule[]
	>({
		queryKey: ["/api/partner-hierarchy/commission-rules"],
	});

	const {
		data: auditLogs = [],
		isLoading: auditLoading,
		refetch: refetchAudit,
	} = useQuery<AuditLog[]>({
		queryKey: ["/api/partner-hierarchy/audit-logs", auditFilter],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (auditFilter.entityType)
				params.set("entityType", auditFilter.entityType);
			if (auditFilter.entityId) params.set("entityId", auditFilter.entityId);
			if (auditFilter.action) params.set("action", auditFilter.action);
			params.set("limit", "100");
			const res = await fetch(`/api/partner-hierarchy/audit-logs?${params}`);
			if (!res.ok) throw new Error("Failed");
			const data = await res.json();
			return Array.isArray(data) ? data : data.logs || [];
		},
	});

	const { data: downline = [], isLoading: downlineLoading } = useQuery<any[]>({
		queryKey: [
			"/api/partner-hierarchy/partners",
			downlineDialog?.id,
			"downline",
		],
		enabled: !!downlineDialog,
		queryFn: async () => {
			const res = await fetch(
				`/api/partner-hierarchy/partners/${downlineDialog!.id}/downline`,
			);
			if (!res.ok) throw new Error("Failed");
			return res.json();
		},
	});

	const { data: walletData, isLoading: walletLoading } = useQuery<any>({
		queryKey: ["/api/partner-hierarchy/wallet", walletDialog?.id],
		enabled: !!walletDialog,
		queryFn: async () => {
			const res = await fetch(
				`/api/partner-hierarchy/wallet/${walletDialog!.id}`,
			);
			if (!res.ok) throw new Error("Failed");
			return res.json();
		},
	});

	const approveMutation = useMutation({
		mutationFn: (partnerId: string) =>
			apiRequest("POST", "/api/partner-hierarchy/partners/approve", {
				partnerId,
			}),
		onSuccess: () => {
			toast({ title: "Partner approved" });
			queryClient.invalidateQueries({
				queryKey: ["/api/partner-hierarchy/partners/pending"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/partner-hierarchy/partners"],
			});
		},
		onError: (e: any) =>
			toast({
				title: "Failed to approve",
				description: e.message,
				variant: "destructive",
			}),
	});

	const rejectMutation = useMutation({
		mutationFn: ({
			partnerId,
			reason,
		}: { partnerId: string; reason?: string }) =>
			apiRequest("POST", "/api/partner-hierarchy/partners/reject", {
				partnerId,
				reason,
			}),
		onSuccess: () => {
			toast({ title: "Partner rejected" });
			setRejectPartnerId(null);
			setRejectReason("");
			queryClient.invalidateQueries({
				queryKey: ["/api/partner-hierarchy/partners/pending"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/partner-hierarchy/partners"],
			});
		},
		onError: (e: any) =>
			toast({
				title: "Failed to reject",
				description: e.message,
				variant: "destructive",
			}),
	});

	const kycMutation = useMutation({
		mutationFn: ({
			partnerId,
			status,
		}: { partnerId: string; status: string }) =>
			apiRequest("POST", "/api/partner-hierarchy/partners/kyc", {
				partnerId,
				status,
			}),
		onSuccess: () => {
			toast({ title: "KYC status updated" });
			setKycDialog(null);
			queryClient.invalidateQueries({
				queryKey: ["/api/partner-hierarchy/partners"],
			});
		},
		onError: (e: any) =>
			toast({
				title: "KYC update failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const suspendMutation = useMutation({
		mutationFn: (partnerId: string) =>
			apiRequest(
				"POST",
				`/api/partner-hierarchy/partners/${partnerId}/suspend`,
				{},
			),
		onSuccess: () => {
			toast({ title: "Partner suspended" });
			setConfirmAction(null);
			queryClient.invalidateQueries({
				queryKey: ["/api/partner-hierarchy/partners"],
			});
		},
		onError: (e: any) =>
			toast({
				title: "Failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const terminateMutation = useMutation({
		mutationFn: (partnerId: string) =>
			apiRequest(
				"POST",
				`/api/partner-hierarchy/partners/${partnerId}/terminate`,
				{},
			),
		onSuccess: () => {
			toast({ title: "Partner terminated" });
			setConfirmAction(null);
			queryClient.invalidateQueries({
				queryKey: ["/api/partner-hierarchy/partners"],
			});
		},
		onError: (e: any) =>
			toast({
				title: "Failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const payoutMutation = useMutation({
		mutationFn: ({
			partnerId,
			amount,
		}: { partnerId: string; amount: number }) =>
			apiRequest("POST", `/api/partner-hierarchy/wallet/${partnerId}/payout`, {
				amount,
			}),
		onSuccess: () => {
			toast({ title: "Payout processed" });
			setPayoutPartner(null);
			setPayoutAmount("");
			queryClient.invalidateQueries({
				queryKey: ["/api/partner-hierarchy/wallet", walletDialog?.id],
			});
		},
		onError: (e: any) =>
			toast({
				title: "Payout failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const integrityMutation = useMutation({
		mutationFn: () =>
			apiRequest("POST", "/api/partner-hierarchy/integrity-check", {}),
		onSuccess: (data: any) => {
			toast({
				title:
					data.totalIssues === 0
						? "Hierarchy Healthy"
						: `${data.totalIssues} Issues Found`,
				description: `Cycles: ${data.cycles}, Orphans: ${data.orphans}, Depth violations: ${data.depthViolations}`,
				variant: data.totalIssues > 0 ? "destructive" : "default",
			});
		},
		onError: (e: any) =>
			toast({
				title: "Integrity check failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const ruleCreateMutation = useMutation({
		mutationFn: (
			rule: Omit<CommissionRule, "id" | "ruleId" | "isActive" | "createdAt">,
		) => apiRequest("POST", "/api/partner-hierarchy/commission-rules", rule),
		onSuccess: () => {
			toast({ title: "Commission rule saved" });
			setRuleDialog(null);
			queryClient.invalidateQueries({
				queryKey: ["/api/partner-hierarchy/commission-rules"],
			});
		},
		onError: (e: any) =>
			toast({
				title: "Failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const filteredPartners = allPartners.filter((p) => {
		if (!search) return true;
		const q = search.toLowerCase();
		return (
			(p.companyName || "").toLowerCase().includes(q) ||
			(p.contactEmail || "").toLowerCase().includes(q) ||
			(p.arnCode || "").toLowerCase().includes(q) ||
			(p.roles || []).some((r) => r.toLowerCase().includes(q))
		);
	});

	function handlePartnerAction(action: string, partner: Partner) {
		if (action === "downline") setDownlineDialog(partner);
		else if (action === "wallet") setWalletDialog(partner);
		else if (action === "suspend")
			setConfirmAction({ type: "suspend", partner });
		else if (action === "terminate")
			setConfirmAction({ type: "terminate", partner });
	}

	const newRule: Partial<CommissionRule> = {
		productType: "",
		agentPct: 0,
		subPartnerPct: 0,
		masterPartnerPct: 0,
		platformPct: 0,
	};

	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Partner Hierarchy</h1>
					<p className="text-muted-foreground text-sm">
						Approve partners, manage hierarchy, configure commissions and
						payouts
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => integrityMutation.mutate()}
					disabled={integrityMutation.isPending}
				>
					<LucideShield className="h-4 w-4 mr-2" />
					{integrityMutation.isPending ? "Checking..." : "Integrity Check"}
				</Button>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="pt-4 pb-3">
						<div className="text-xs text-muted-foreground">Total Partners</div>
						<div className="text-2xl font-bold">{allPartners.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 pb-3">
						<div className="text-xs text-muted-foreground">
							Pending Approvals
						</div>
						<div className="text-2xl font-bold text-yellow-600">
							{pending.length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 pb-3">
						<div className="text-xs text-muted-foreground">Active</div>
						<div className="text-2xl font-bold text-green-600">
							{
								allPartners.filter(
									(p) =>
										p.isActive &&
										p.hierarchyStatus !== "SUSPENDED" &&
										p.hierarchyStatus !== "TERMINATED",
								).length
							}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 pb-3">
						<div className="text-xs text-muted-foreground">
							Commission Rules
						</div>
						<div className="text-2xl font-bold">{commissionRules.length}</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="pending">
				<ScrollableTabsList>
					<TabsTrigger value="pending">
						<Clock className="h-4 w-4 mr-1" />
						Pending Approvals
						{pending.length > 0 && (
							<Badge className="ml-2 h-5 px-1.5 text-xs">
								{pending.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="directory">
						<Users className="h-4 w-4 mr-1" />
						Partner Directory
					</TabsTrigger>
					<TabsTrigger value="commission">
						<IndianRupee className="h-4 w-4 mr-1" />
						Commission Rules
					</TabsTrigger>
					<TabsTrigger value="audit">
						<Activity className="h-4 w-4 mr-1" />
						Audit Log
					</TabsTrigger>
				</ScrollableTabsList>

				{/* ─── PENDING APPROVALS ─────────────────────────────────── */}
				<TabsContent value="pending" className="space-y-4 mt-4">
					{pendingLoading ? (
						<div className="space-y-3">
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-28 w-full" />
							))}
						</div>
					) : pending.length === 0 ? (
						<Card>
							<CardContent className="py-12 text-center text-muted-foreground">
								<CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500" />
								<p className="font-medium">No pending approvals</p>
							</CardContent>
						</Card>
					) : (
						pending.map((partner) => (
							<Card key={partner.id}>
								<CardContent className="py-4">
									<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
										<div className="space-y-1">
											<div className="font-semibold text-base">
												{partner.companyName}
											</div>
											<div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
												<span className="flex items-center gap-1">
													<Mail className="h-3 w-3" />
													{partner.contactEmail}
												</span>
												{partner.contactPhone && (
													<span className="flex items-center gap-1">
														<Phone className="h-3 w-3" />
														{partner.contactPhone}
													</span>
												)}
											</div>
											<div className="flex flex-wrap gap-2 mt-2">
												<Badge variant="outline">
													{partner.hierarchyPartnerType || partner.partnerType}
												</Badge>
												{partner.partnerLevel && (
													<Badge variant="outline">
														{partner.partnerLevel}
													</Badge>
												)}
												{statusBadge(partner.kycStatus)}
												{partner.arnCode && (
													<span className="text-xs text-muted-foreground flex items-center gap-1">
														<Hash className="h-3 w-3" />
														ARN: {partner.arnCode}
													</span>
												)}
											</div>
										</div>
										<div className="flex flex-wrap gap-2">
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													setKycDialog({
														partnerId: partner.id,
														current: partner.kycStatus || "PENDING",
													})
												}
											>
												<BadgeCheck className="h-4 w-4 mr-1" /> KYC
											</Button>
											<Button
												size="sm"
												onClick={() => approveMutation.mutate(partner.id)}
												disabled={approveMutation.isPending}
											>
												<CheckCircle className="h-4 w-4 mr-1" /> Approve
											</Button>
											<Button
												size="sm"
												variant="destructive"
												onClick={() => setRejectPartnerId(partner.id)}
												disabled={rejectMutation.isPending}
											>
												<XCircle className="h-4 w-4 mr-1" /> Reject
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						))
					)}
				</TabsContent>

				{/* ─── PARTNER DIRECTORY ─────────────────────────────────── */}
				<TabsContent value="directory" className="space-y-4 mt-4">
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search by name, email, ARN..."
								className="pl-9"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
					</div>
					<Card>
						<CardContent className="p-0">
							{allLoading ? (
								<div className="p-4 space-y-3">
									{[1, 2, 3, 4].map((i) => (
										<Skeleton key={i} className="h-12 w-full" />
									))}
								</div>
							) : filteredPartners.length === 0 ? (
								<div className="py-12 text-center text-muted-foreground">
									<Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
									<p>No partners found</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Partner</TableHead>
											<TableHead>Type / Level</TableHead>
											<TableHead>Approval</TableHead>
											<TableHead>KYC</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredPartners.map((partner) => (
											<PartnerRow
												key={partner.id}
												partner={partner}
												onAction={handlePartnerAction}
											/>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* ─── COMMISSION RULES ──────────────────────────────────── */}
				<TabsContent value="commission" className="space-y-4 mt-4">
					<div className="flex justify-end">
						<Button
							size="sm"
							onClick={() =>
								setRuleDialog({
									productType: "",
									agentPct: 0,
									subPartnerPct: 0,
									masterPartnerPct: 0,
									platformPct: 0,
								})
							}
						>
							+ New Rule
						</Button>
					</div>
					<Card>
						<CardContent className="p-0">
							{rulesLoading ? (
								<div className="p-4 space-y-2">
									{[1, 2, 3].map((i) => (
										<Skeleton key={i} className="h-12 w-full" />
									))}
								</div>
							) : commissionRules.length === 0 ? (
								<div className="py-12 text-center text-muted-foreground">
									<Settings2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
									<p>No commission rules configured</p>
									<p className="text-sm mt-1">
										Create product-specific commission splits for agents,
										sub-partners, master partners and platform
									</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Product Type</TableHead>
											<TableHead className="text-right">Agent %</TableHead>
											<TableHead className="text-right">
												Sub-Partner %
											</TableHead>
											<TableHead className="text-right">Master %</TableHead>
											<TableHead className="text-right">Platform %</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{commissionRules.map((rule, i) => (
											<TableRow key={rule.id || rule.ruleId || i}>
												<TableCell className="font-medium">
													{rule.productType}
												</TableCell>
												<TableCell className="text-right">
													{rule.agentPct}%
												</TableCell>
												<TableCell className="text-right">
													{rule.subPartnerPct}%
												</TableCell>
												<TableCell className="text-right">
													{rule.masterPartnerPct}%
												</TableCell>
												<TableCell className="text-right">
													{rule.platformPct}%
												</TableCell>
												<TableCell>
													{rule.isActive !== false ? (
														<Badge className="bg-green-100 text-green-800">
															Active
														</Badge>
													) : (
														<Badge variant="secondary">Inactive</Badge>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* ─── AUDIT LOG ─────────────────────────────────────────── */}
				<TabsContent value="audit" className="space-y-4 mt-4">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Filter Audit Events</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<div>
									<Label className="text-xs">Entity Type</Label>
									<Input
										placeholder="e.g. partner, client"
										value={auditFilter.entityType}
										onChange={(e) =>
											setAuditFilter((f) => ({
												...f,
												entityType: e.target.value,
											}))
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Entity ID</Label>
									<Input
										placeholder="Partner ID..."
										value={auditFilter.entityId}
										onChange={(e) =>
											setAuditFilter((f) => ({
												...f,
												entityId: e.target.value,
											}))
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Action</Label>
									<Input
										placeholder="e.g. APPROVED, REJECTED"
										value={auditFilter.action}
										onChange={(e) =>
											setAuditFilter((f) => ({ ...f, action: e.target.value }))
										}
									/>
								</div>
							</div>
							<Button
								size="sm"
								className="mt-3"
								variant="outline"
								onClick={() => refetchAudit()}
							>
								<RefreshCw className="h-4 w-4 mr-1" /> Refresh
							</Button>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-0">
							{auditLoading ? (
								<div className="p-4 space-y-2">
									{[1, 2, 3, 4, 5].map((i) => (
										<Skeleton key={i} className="h-10 w-full" />
									))}
								</div>
							) : (Array.isArray(auditLogs) ? auditLogs : []).length === 0 ? (
								<div className="py-12 text-center text-muted-foreground">
									<FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
									<p>No audit events found</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Action</TableHead>
											<TableHead>Entity</TableHead>
											<TableHead>Actor</TableHead>
											<TableHead>IP</TableHead>
											<TableHead>Time</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{(Array.isArray(auditLogs) ? auditLogs : []).map(
											(log: AuditLog) => (
												<TableRow key={log.id}>
													<TableCell>
														<Badge
															variant="outline"
															className="font-mono text-xs"
														>
															{log.action}
														</Badge>
													</TableCell>
													<TableCell>
														<div className="text-sm">{log.entityType}</div>
														<div className="text-xs text-muted-foreground font-mono truncate max-w-32">
															{log.entityId}
														</div>
													</TableCell>
													<TableCell className="font-mono text-xs truncate max-w-28">
														{log.actorId}
													</TableCell>
													<TableCell className="text-xs text-muted-foreground">
														{log.ipAddress || "—"}
													</TableCell>
													<TableCell className="text-xs text-muted-foreground whitespace-nowrap">
														{log.createdAt
															? new Date(log.createdAt).toLocaleString(
																	"en-IN",
																	{ timeZone: "Asia/Kolkata" },
																)
															: "—"}
													</TableCell>
												</TableRow>
											),
										)}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* ─── REJECT DIALOG ─────────────────────────────────────────── */}
			<Dialog
				open={!!rejectPartnerId}
				onOpenChange={(open) => {
					if (!open) {
						setRejectPartnerId(null);
						setRejectReason("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject Partner Application</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<Label>Reason (optional)</Label>
						<Textarea
							placeholder="Provide a reason for rejection..."
							value={rejectReason}
							onChange={(e) => setRejectReason(e.target.value)}
							rows={3}
						/>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setRejectPartnerId(null);
								setRejectReason("");
							}}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={rejectMutation.isPending}
							onClick={() =>
								rejectPartnerId &&
								rejectMutation.mutate({
									partnerId: rejectPartnerId,
									reason: rejectReason || undefined,
								})
							}
						>
							Reject Partner
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ─── KYC STATUS DIALOG ─────────────────────────────────────── */}
			<Dialog
				open={!!kycDialog}
				onOpenChange={(open) => {
					if (!open) setKycDialog(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Update KYC Status</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<Label>New KYC Status</Label>
						<Select
							onValueChange={(value) =>
								kycDialog &&
								kycMutation.mutate({
									partnerId: kycDialog.partnerId,
									status: value,
								})
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select status..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="PENDING">Pending</SelectItem>
								<SelectItem value="VERIFIED">Verified</SelectItem>
								<SelectItem value="REJECTED">Rejected</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Current: <strong>{kycDialog?.current}</strong>
						</p>
					</div>
				</DialogContent>
			</Dialog>

			{/* ─── DOWNLINE DIALOG ───────────────────────────────────────── */}
			<Dialog
				open={!!downlineDialog}
				onOpenChange={(open) => {
					if (!open) setDownlineDialog(null);
				}}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Downline — {downlineDialog?.companyName}</DialogTitle>
					</DialogHeader>
					{downlineLoading ? (
						<div className="space-y-2 py-4">
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-10 w-full" />
							))}
						</div>
					) : (Array.isArray(downline) ? downline : []).length === 0 ? (
						<div className="py-8 text-center text-muted-foreground">
							No sub-partners in downline
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Level</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{(Array.isArray(downline) ? downline : []).map(
									(p: any, i: number) => (
										<TableRow key={p.id || i}>
											<TableCell className="font-medium">
												{p.companyName || p.company_name}
											</TableCell>
											<TableCell>
												{p.partnerLevel || p.partner_level || "—"}
											</TableCell>
											<TableCell>
												{statusBadge(p.hierarchyStatus || p.hierarchy_status)}
											</TableCell>
										</TableRow>
									),
								)}
							</TableBody>
						</Table>
					)}
				</DialogContent>
			</Dialog>

			{/* ─── WALLET DIALOG ─────────────────────────────────────────── */}
			<Dialog
				open={!!walletDialog}
				onOpenChange={(open) => {
					if (!open) {
						setWalletDialog(null);
						setPayoutPartner(null);
						setPayoutAmount("");
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Wallet — {walletDialog?.companyName}</DialogTitle>
					</DialogHeader>
					{walletLoading ? (
						<Skeleton className="h-24 w-full" />
					) : (
						<div className="space-y-4 py-2">
							<div className="flex items-center justify-between p-4 rounded-lg bg-muted">
								<span className="text-muted-foreground">Available Balance</span>
								<span className="text-xl font-bold">
									₹
									{Number(walletData?.balance || 0).toLocaleString("en-IN", {
										minimumFractionDigits: 2,
									})}
								</span>
							</div>
							<div className="space-y-2">
								<Label>Manual Payout (₹)</Label>
								<div className="flex gap-2">
									<Input
										type="number"
										placeholder="Amount..."
										value={payoutAmount}
										onChange={(e) => setPayoutAmount(e.target.value)}
										min={1}
									/>
									<Button
										disabled={payoutMutation.isPending || !payoutAmount}
										onClick={() =>
											walletDialog &&
											payoutMutation.mutate({
												partnerId: walletDialog.id,
												amount: Number.parseFloat(payoutAmount),
											})
										}
									>
										Pay Out
									</Button>
								</div>
								<p className="text-xs text-muted-foreground">
									KYC must be VERIFIED before payout can be processed.
								</p>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* ─── CONFIRM SUSPEND / TERMINATE ───────────────────────────── */}
			<Dialog
				open={!!confirmAction}
				onOpenChange={(open) => {
					if (!open) setConfirmAction(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{confirmAction?.type === "suspend"
								? "Suspend Partner"
								: "Terminate Partner"}
						</DialogTitle>
					</DialogHeader>
					<div className="py-2">
						<p className="text-sm">
							{confirmAction?.type === "suspend"
								? `Suspend ${confirmAction?.partner.companyName}? They will lose access but data is preserved.`
								: `Permanently terminate ${confirmAction?.partner.companyName}? This cannot be undone.`}
						</p>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmAction(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={
								suspendMutation.isPending || terminateMutation.isPending
							}
							onClick={() => {
								if (!confirmAction) return;
								if (confirmAction.type === "suspend")
									suspendMutation.mutate(confirmAction.partner.id);
								else terminateMutation.mutate(confirmAction.partner.id);
							}}
						>
							{confirmAction?.type === "suspend" ? "Suspend" : "Terminate"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ─── NEW COMMISSION RULE DIALOG ────────────────────────────── */}
			<Dialog
				open={!!ruleDialog}
				onOpenChange={(open) => {
					if (!open) setRuleDialog(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Commission Rule</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div>
							<Label>Product Type</Label>
							<Input
								placeholder="e.g. mutual_funds, loans, insurance..."
								value={ruleDialog?.productType || ""}
								onChange={(e) =>
									setRuleDialog((r) =>
										r ? { ...r, productType: e.target.value } : r,
									)
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							{(
								[
									"agentPct",
									"subPartnerPct",
									"masterPartnerPct",
									"platformPct",
								] as const
							).map((field) => (
								<div key={field}>
									<Label className="text-xs">
										{field === "agentPct"
											? "Agent %"
											: field === "subPartnerPct"
												? "Sub-Partner %"
												: field === "masterPartnerPct"
													? "Master %"
													: "Platform %"}
									</Label>
									<Input
										type="number"
										min={0}
										max={100}
										step={0.01}
										value={ruleDialog?.[field] ?? 0}
										onChange={(e) =>
											setRuleDialog((r) =>
												r
													? {
															...r,
															[field]: Number.parseFloat(e.target.value) || 0,
														}
													: r,
											)
										}
									/>
								</div>
							))}
						</div>
						{ruleDialog && (
							<p className="text-xs text-muted-foreground">
								Total:{" "}
								{(
									(ruleDialog.agentPct || 0) +
									(ruleDialog.subPartnerPct || 0) +
									(ruleDialog.masterPartnerPct || 0) +
									(ruleDialog.platformPct || 0)
								).toFixed(2)}
								%
								{(ruleDialog.agentPct || 0) +
									(ruleDialog.subPartnerPct || 0) +
									(ruleDialog.masterPartnerPct || 0) +
									(ruleDialog.platformPct || 0) >
									100 && (
									<span className="text-red-500 ml-1">— exceeds 100%</span>
								)}
							</p>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRuleDialog(null)}>
							Cancel
						</Button>
						<Button
							disabled={
								ruleCreateMutation.isPending || !ruleDialog?.productType
							}
							onClick={() =>
								ruleDialog &&
								ruleCreateMutation.mutate({
									productType: ruleDialog.productType,
									agentPct: ruleDialog.agentPct || 0,
									subPartnerPct: ruleDialog.subPartnerPct || 0,
									masterPartnerPct: ruleDialog.masterPartnerPct || 0,
									platformPct: ruleDialog.platformPct || 0,
								})
							}
						>
							Save Rule
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
