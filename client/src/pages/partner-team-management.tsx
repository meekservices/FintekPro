import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Users,
	UserPlus,
	Banknote,
	Percent,
	Copy,
	Link2,
	CheckCircle,
	Clock,
	XCircle,
	Trash2,
	Edit2,
	Save,
	X,
	ShieldCheck,
	UserCheck,
	TrendingUp,
	Loader2,
	AlertCircle,
	Info,
	CheckCircle2,
	Award,
	Building2,
	Briefcase,
	Layers,
	ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";

function formatCurrency(v: number) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(v);
}

// ── My Team Tab ──────────────────────────────────────────────────────────────
function MyTeamTab() {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [editingSMRM, setEditingSMRM] = useState<string | null>(null);
	const [smrmForm, setSmrmForm] = useState({
		smName: "",
		smEmail: "",
		rmName: "",
		rmEmail: "",
	});

	const { data: team = [], isLoading } = useQuery<any[]>({
		queryKey: ["/api/partner/my-team"],
	});

	const smrmMutation = useMutation({
		mutationFn: (params: { agentUserId: string; data: any }) =>
			apiRequest(
				"PUT",
				`/api/partner/agents/${params.agentUserId}/sm-rm`,
				params.data,
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["/api/partner/my-team"] });
			setEditingSMRM(null);
			toast({ title: "SM/RM assigned successfully" });
		},
		onError: () =>
			toast({ title: "Failed to assign SM/RM", variant: "destructive" }),
	});

	const removeMutation = useMutation({
		mutationFn: (agentUserId: string) =>
			apiRequest("DELETE", `/api/partner/my-team/${agentUserId}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["/api/partner/my-team"] });
			toast({ title: "Partner removed from team" });
		},
		onError: () =>
			toast({ title: "Failed to remove partner", variant: "destructive" }),
	});

	const startEdit = (member: any) => {
		setEditingSMRM(member.agent_user_id);
		setSmrmForm({
			smName: member.sm_name || "",
			smEmail: member.sm_email || "",
			rmName: member.rm_name || "",
			rmEmail: member.rm_email || "",
		});
	};

	if (isLoading)
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);

	if (team.length === 0) {
		return (
			<div className="text-center py-16 text-muted-foreground">
				<Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
				<p className="font-medium">No partners in your team yet</p>
				<p className="text-sm mt-1">
					Invite partners using the "Invite Partner" tab — when they join, they
					appear here.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
				<Info className="h-4 w-4 flex-shrink-0" />
				<span>
					You earn <strong>partner-level override commission</strong> on every
					transaction your team partners close, in addition to your own partner
					commissions.
				</span>
			</div>

			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Partner</TableHead>
							<TableHead>Designation & Authority</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>KYC</TableHead>
							<TableHead>SM Assigned</TableHead>
							<TableHead>RM Assigned</TableHead>
							<TableHead>Joined</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{team.map((member: any) => (
							<>
								<TableRow key={member.agent_user_id}>
									<TableCell>
										<div>
											<p className="font-medium">
												{member.first_name} {member.last_name}
											</p>
											<p className="text-xs text-muted-foreground">
												{member.email}
											</p>
											{member.mobile && (
												<p className="text-xs text-muted-foreground">
													{member.mobile}
												</p>
											)}
											{member.arn_number && (
												<p className="text-xs text-green-600 font-medium">
													ARN: {member.arn_number}
												</p>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="space-y-1">
											<p className="text-sm font-semibold text-foreground">
												{member.designation_title ||
													(member.designation
														? member.designation
																.split("_")
																.map(
																	(w: string) =>
																		w.charAt(0).toUpperCase() + w.slice(1),
																)
																.join(" ")
														: "Relationship Manager")}
											</p>
											<div className="flex flex-wrap items-center gap-1">
												{member.can_execute_transactions ? (
													<Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-[10px] font-medium">
														<CheckCircle2 className="h-2.5 w-2.5 mr-1" /> MF & SIF Executing
													</Badge>
												) : (
													<Badge
														variant="outline"
														className="text-amber-700 border-amber-300 dark:text-amber-400 text-[10px]"
													>
														<Clock className="h-2.5 w-2.5 mr-1" /> Advisory Only
													</Badge>
												)}
												{member.euin_number && (
													<Badge
														variant="outline"
														className="text-blue-700 border-blue-300 dark:text-blue-400 text-[10px]"
													>
														EUIN: {member.euin_number}
													</Badge>
												)}
												{member.iris_sync_status === "synced" ? (
													<Badge
														variant="outline"
														className="text-sky-700 border-sky-300 dark:text-sky-400 text-[10px]"
													>
														IRIS Synced
													</Badge>
												) : (
													<Badge
														variant="outline"
														className="text-muted-foreground text-[10px]"
													>
														IRIS Pending
													</Badge>
												)}
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Badge
											variant={
												member.status === "active" ? "default" : "secondary"
											}
											className="capitalize"
										>
											{member.status}
										</Badge>
									</TableCell>
									<TableCell>
										{member.empanelment_status === "approved" ? (
											<Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">
												<ShieldCheck className="h-3 w-3 mr-1" /> Empanelled
											</Badge>
										) : (
											<Badge
												variant="outline"
												className="text-amber-600 border-amber-300"
											>
												<Clock className="h-3 w-3 mr-1" />{" "}
												{member.empanelment_status || "Pending"}
											</Badge>
										)}
									</TableCell>
									<TableCell>
										{member.sm_name ? (
											<div>
												<p className="text-sm font-medium">{member.sm_name}</p>
												<p className="text-xs text-muted-foreground">
													{member.sm_email}
												</p>
											</div>
										) : (
											<span className="text-muted-foreground text-sm">—</span>
										)}
									</TableCell>
									<TableCell>
										{member.rm_name ? (
											<div>
												<p className="text-sm font-medium">{member.rm_name}</p>
												<p className="text-xs text-muted-foreground">
													{member.rm_email}
												</p>
											</div>
										) : (
											<span className="text-muted-foreground text-sm">—</span>
										)}
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{member.joined_at
											? format(new Date(member.joined_at), "dd MMM yyyy")
											: "—"}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex gap-1 justify-end">
											<Button
												size="sm"
												variant="outline"
												onClick={() => startEdit(member)}
											>
												<Edit2 className="h-3.5 w-3.5 mr-1" /> SM/RM
											</Button>
											<Button
												size="sm"
												variant="ghost"
												className="text-red-500 hover:text-red-600 hover:bg-red-50"
												onClick={() =>
													removeMutation.mutate(member.agent_user_id)
												}
												disabled={removeMutation.isPending}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
								{editingSMRM === member.agent_user_id && (
									<TableRow
										key={`smrm-${member.agent_user_id}`}
										className="bg-muted/30"
									>
										<TableCell colSpan={8}>
											<div className="p-3 space-y-3">
												<p className="text-sm font-medium text-foreground">
													Assign SM / RM for {member.first_name}{" "}
													{member.last_name}
												</p>
												<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
													<div>
														<Label className="text-xs">SM Name</Label>
														<Input
															value={smrmForm.smName}
															onChange={(e) =>
																setSmrmForm((f) => ({
																	...f,
																	smName: e.target.value,
																}))
															}
															placeholder="Sales Manager name"
															className="h-8 text-sm"
														/>
													</div>
													<div>
														<Label className="text-xs">SM Email</Label>
														<Input
															value={smrmForm.smEmail}
															onChange={(e) =>
																setSmrmForm((f) => ({
																	...f,
																	smEmail: e.target.value,
																}))
															}
															placeholder="sm@company.com"
															className="h-8 text-sm"
														/>
													</div>
													<div>
														<Label className="text-xs">RM Name</Label>
														<Input
															value={smrmForm.rmName}
															onChange={(e) =>
																setSmrmForm((f) => ({
																	...f,
																	rmName: e.target.value,
																}))
															}
															placeholder="Relationship Manager"
															className="h-8 text-sm"
														/>
													</div>
													<div>
														<Label className="text-xs">RM Email</Label>
														<Input
															value={smrmForm.rmEmail}
															onChange={(e) =>
																setSmrmForm((f) => ({
																	...f,
																	rmEmail: e.target.value,
																}))
															}
															placeholder="rm@company.com"
															className="h-8 text-sm"
														/>
													</div>
												</div>
												<div className="flex gap-2">
													<Button
														size="sm"
														onClick={() =>
															smrmMutation.mutate({
																agentUserId: member.agent_user_id,
																data: smrmForm,
															})
														}
														disabled={smrmMutation.isPending}
													>
														{smrmMutation.isPending ? (
															<Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
														) : (
															<Save className="h-3.5 w-3.5 mr-1" />
														)}
														Save
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => setEditingSMRM(null)}
													>
														<X className="h-3.5 w-3.5 mr-1" /> Cancel
													</Button>
												</div>
											</div>
										</TableCell>
									</TableRow>
								)}
							</>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

// ── Invite Agent Tab ─────────────────────────────────────────────────────────
function InviteAgentTab() {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [form, setForm] = useState({
		inviteeName: "",
		inviteeEmail: "",
		inviteeMobile: "",
	});
	const [lastInvite, setLastInvite] = useState<{
		inviteCode: string;
		inviteLink: string;
	} | null>(null);

	const { data: invitations = [], isLoading } = useQuery<any[]>({
		queryKey: ["/api/partner/invitations"],
	});

	const inviteMutation = useMutation({
		mutationFn: (data: any) =>
			apiRequest("POST", "/api/partner/invite-agent", data),
		onSuccess: async (res: any) => {
			const data = await res.json();
			setLastInvite(data);
			setForm({ inviteeName: "", inviteeEmail: "", inviteeMobile: "" });
			qc.invalidateQueries({ queryKey: ["/api/partner/invitations"] });
			toast({
				title: "Invitation created",
				description: `Code: ${data.inviteCode}`,
			});
		},
		onError: () =>
			toast({ title: "Failed to create invitation", variant: "destructive" }),
	});

	const cancelMutation = useMutation({
		mutationFn: (id: string) =>
			apiRequest("DELETE", `/api/partner/invitations/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["/api/partner/invitations"] });
			toast({ title: "Invitation cancelled" });
		},
	});

	const copyLink = (link: string) => {
		navigator.clipboard.writeText(link);
		toast({ title: "Link copied to clipboard" });
	};

	const statusBadge = (status: string) => {
		const map: Record<string, { label: string; className: string }> = {
			pending: {
				label: "Pending",
				className:
					"bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
			},
			accepted: {
				label: "Accepted",
				className:
					"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			},
			expired: { label: "Expired", className: "bg-gray-100 text-gray-600" },
			cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800" },
		};
		const s = map[status] || { label: status, className: "" };
		return (
			<Badge className={`${s.className} border-0 text-xs`}>{s.label}</Badge>
		);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<UserPlus className="h-4 w-4 text-primary" /> Create Partner
						Invitation
					</CardTitle>
					<CardDescription>
						Generate a unique invite link. When a partner registers using your
						link, they automatically join your team and you get promoted to
						Master Partner.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid md:grid-cols-3 gap-4">
						<div>
							<Label>Partner Name (optional)</Label>
							<Input
								value={form.inviteeName}
								onChange={(e) =>
									setForm((f) => ({ ...f, inviteeName: e.target.value }))
								}
								placeholder="e.g. Ramesh Sharma"
							/>
						</div>
						<div>
							<Label>Email (optional)</Label>
							<Input
								type="email"
								value={form.inviteeEmail}
								onChange={(e) =>
									setForm((f) => ({ ...f, inviteeEmail: e.target.value }))
								}
								placeholder="partner@email.com"
							/>
						</div>
						<div>
							<Label>Mobile (optional)</Label>
							<Input
								value={form.inviteeMobile}
								onChange={(e) =>
									setForm((f) => ({ ...f, inviteeMobile: e.target.value }))
								}
								placeholder="9XXXXXXXXX"
							/>
						</div>
					</div>
					<Button
						onClick={() => inviteMutation.mutate(form)}
						disabled={inviteMutation.isPending}
					>
						{inviteMutation.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin mr-2" />
						) : (
							<Link2 className="h-4 w-4 mr-2" />
						)}
						Generate Invite Link
					</Button>
				</CardContent>
			</Card>

			{lastInvite && (
				<Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
					<CardContent className="pt-4">
						<div className="flex items-start gap-3">
							<CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
							<div className="flex-1 min-w-0">
								<p className="font-semibold text-green-800 dark:text-green-200">
									Invitation Created!
								</p>
								<p className="text-sm text-green-700 dark:text-green-300 mt-1">
									Code: <strong>{lastInvite.inviteCode}</strong>
								</p>
								<div className="flex items-center gap-2 mt-2">
									<code className="text-xs bg-white dark:bg-black/20 border rounded px-2 py-1 flex-1 truncate">
										{lastInvite.inviteLink}
									</code>
									<Button
										size="sm"
										variant="outline"
										onClick={() => copyLink(lastInvite.inviteLink)}
									>
										<Copy className="h-3.5 w-3.5 mr-1" /> Copy
									</Button>
								</div>
								<p className="text-xs text-green-600 dark:text-green-400 mt-2">
									Share this link with the partner. Valid for 30 days.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Clock className="h-4 w-4 text-muted-foreground" /> Invitation
						History
					</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex justify-center py-6">
							<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					) : invitations.length === 0 ? (
						<p className="text-center text-sm text-muted-foreground py-6">
							No invitations sent yet.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Invitee</TableHead>
									<TableHead>Invite Code</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Expires</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{invitations.map((inv: any) => (
									<TableRow key={inv.id}>
										<TableCell>
											<div>
												<p className="font-medium text-sm">
													{inv.invitee_name || "—"}
												</p>
												<p className="text-xs text-muted-foreground">
													{inv.invitee_email || inv.invitee_mobile || ""}
												</p>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1">
												<code className="text-xs bg-muted px-1.5 py-0.5 rounded">
													{inv.invite_code}
												</code>
											</div>
										</TableCell>
										<TableCell>{statusBadge(inv.status)}</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{inv.expires_at
												? format(new Date(inv.expires_at), "dd MMM yy")
												: "—"}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{inv.created_at
												? format(new Date(inv.created_at), "dd MMM yy")
												: "—"}
										</TableCell>
										<TableCell className="text-right">
											{inv.status === "pending" && (
												<Button
													size="sm"
													variant="ghost"
													className="text-red-500 hover:text-red-600"
													onClick={() => cancelMutation.mutate(inv.id)}
													disabled={cancelMutation.isPending}
												>
													<XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// ── Bank Account Tab ──────────────────────────────────────────────────────────
function BankAccountTab() {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [form, setForm] = useState({
		bankAccountNumber: "",
		ifscCode: "",
		bankAccountHolderName: "",
		upiId: "",
	});
	const [loaded, setLoaded] = useState(false);

	const { data: bank, isLoading } = useQuery<any>({
		queryKey: ["/api/partner/bank"],
		select: (d: any) => d,
	});

	if (bank && !loaded) {
		setForm({
			bankAccountNumber: bank.bank_account_number || "",
			ifscCode: bank.ifsc_code || "",
			bankAccountHolderName: bank.bank_account_holder_name || "",
			upiId: bank.upi_id || "",
		});
		setLoaded(true);
	}

	const saveMutation = useMutation({
		mutationFn: (data: any) => apiRequest("PUT", "/api/partner/bank", data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["/api/partner/bank"] });
			toast({ title: "Bank details saved successfully" });
		},
		onError: () =>
			toast({ title: "Failed to save bank details", variant: "destructive" }),
	});

	return (
		<div className="max-w-xl space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Banknote className="h-4 w-4 text-primary" /> Partner Bank Account
					</CardTitle>
					<CardDescription>
						Bank account for receiving commission payouts and team override
						income.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{isLoading ? (
						<div className="flex justify-center py-6">
							<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					) : (
						<>
							{bank?.cashfree_bank_verified && (
								<div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200">
									<CheckCircle className="h-4 w-4" />
									<span>Bank account verified via penny drop</span>
								</div>
							)}
							<div>
								<Label>Account Holder Name</Label>
								<Input
									value={form.bankAccountHolderName}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											bankAccountHolderName: e.target.value,
										}))
									}
									placeholder="Name as per bank records"
								/>
							</div>
							<div>
								<Label>Account Number</Label>
								<Input
									value={form.bankAccountNumber}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											bankAccountNumber: e.target.value,
										}))
									}
									placeholder="Account number"
								/>
							</div>
							<div>
								<Label>IFSC Code</Label>
								<Input
									value={form.ifscCode}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											ifscCode: e.target.value.toUpperCase(),
										}))
									}
									placeholder="e.g. HDFC0001234"
									className="uppercase"
								/>
							</div>
							<div>
								<Label>UPI ID (optional)</Label>
								<Input
									value={form.upiId}
									onChange={(e) =>
										setForm((f) => ({ ...f, upiId: e.target.value }))
									}
									placeholder="yourname@upi"
								/>
							</div>
							<Button
								onClick={() => saveMutation.mutate(form)}
								disabled={
									saveMutation.isPending ||
									!form.bankAccountNumber ||
									!form.ifscCode ||
									!form.bankAccountHolderName
								}
							>
								{saveMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
								) : (
									<Save className="h-4 w-4 mr-2" />
								)}
								Save Bank Details
							</Button>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// ── Commission Splits Tab ─────────────────────────────────────────────────────
function CommissionSplitsTab() {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [editing, setEditing] = useState<string | null>(null);
	const [pct, setPct] = useState<string>("");

	const { data: splits = [], isLoading } = useQuery<any[]>({
		queryKey: ["/api/partner/commission-splits"],
	});

	const saveMutation = useMutation({
		mutationFn: (params: { agentUserId: string; pct: number }) =>
			apiRequest(
				"PUT",
				`/api/partner/commission-splits/${params.agentUserId}`,
				{ commissionSplitPct: params.pct },
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["/api/partner/commission-splits"] });
			setEditing(null);
			toast({ title: "Commission split updated" });
		},
		onError: () =>
			toast({ title: "Failed to update split", variant: "destructive" }),
	});

	return (
		<div className="space-y-4">
			<Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
				<CardContent className="pt-4">
					<div className="flex items-start gap-3">
						<AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
						<div className="text-sm text-amber-800 dark:text-amber-200">
							<p className="font-semibold">How commission splits work</p>
							<p className="mt-1">
								You receive the full partner override commission from the
								platform. The split % you configure here is the portion you pass
								on to each partner from <em>your</em> share. Example: if platform
								pays you ₹1,000 override and you set 60% for a partner, they get
								₹600 and you keep ₹400.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{isLoading ? (
				<div className="flex justify-center py-8">
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
				</div>
			) : splits.length === 0 ? (
				<div className="text-center py-12 text-muted-foreground">
					<Percent className="h-10 w-10 mx-auto mb-3 opacity-40" />
					<p className="font-medium">No active team members yet</p>
					<p className="text-sm mt-1">
						Add partners via Invite Partner — they will appear here once they join.
					</p>
				</div>
			) : (
				<Card>
					<CardContent className="pt-4">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Partner</TableHead>
									<TableHead>Current Split</TableHead>
									<TableHead>Partner Gets</TableHead>
									<TableHead>You Keep</TableHead>
									<TableHead className="text-right">Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{splits.map((s: any) => (
									<TableRow key={s.agent_user_id}>
										<TableCell>
											<p className="font-medium">
												{s.first_name} {s.last_name}
											</p>
											<p className="text-xs text-muted-foreground">{s.email}</p>
										</TableCell>
										<TableCell>
											{editing === s.agent_user_id ? (
												<div className="flex items-center gap-1">
													<Input
														type="number"
														min={0}
														max={100}
														className="h-7 w-20 text-sm"
														value={pct}
														onChange={(e) => setPct(e.target.value)}
													/>
													<span className="text-sm">%</span>
												</div>
											) : (
												<Badge variant="outline" className="font-mono">
													{Number(s.commission_split_pct || 0).toFixed(0)}%
												</Badge>
											)}
										</TableCell>
										<TableCell className="text-green-600 font-medium text-sm">
											{Number(s.commission_split_pct || 0).toFixed(0)}% of
											override
										</TableCell>
										<TableCell className="text-blue-600 font-medium text-sm">
											{(100 - Number(s.commission_split_pct || 0)).toFixed(0)}%
											of override
										</TableCell>
										<TableCell className="text-right">
											{editing === s.agent_user_id ? (
												<div className="flex gap-1 justify-end">
													<Button
														size="sm"
														onClick={() =>
															saveMutation.mutate({
																agentUserId: s.agent_user_id,
																pct: Number(pct),
															})
														}
														disabled={saveMutation.isPending}
													>
														{saveMutation.isPending ? (
															<Loader2 className="h-3.5 w-3.5 animate-spin" />
														) : (
															<Save className="h-3.5 w-3.5" />
														)}
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => setEditing(null)}
													>
														<X className="h-3.5 w-3.5" />
													</Button>
												</div>
											) : (
												<Button
													size="sm"
													variant="outline"
													onClick={() => {
														setEditing(s.agent_user_id);
														setPct(String(Number(s.commission_split_pct || 0)));
													}}
												>
													<Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// ── Product Governance Tab ───────────────────────────────────────────────────
function ProductGovernanceTab() {
	const { toast } = useToast();
	const [activeSubView, setActiveSubView] = useState<"matrix" | "tester">("matrix");

	// Simulator Form State
	const [candidateName, setCandidateName] = useState("Aakash Sharma");
	const [designation, setDesignation] = useState("relationship_manager");
	const [experienceYears, setExperienceYears] = useState("3");
	const [hasEuin, setHasEuin] = useState(true);
	const [euinNumber, setEuinNumber] = useState("E382910");
	const [hasPosp, setHasPosp] = useState(false);
	const [pospNumber, setPospNumber] = useState("");
	const [hasDsa, setHasDsa] = useState(false);
	const [dsaCode, setDsaCode] = useState("");
	const [certNismVa, setCertNismVa] = useState(true);
	const [certNismViii, setCertNismViii] = useState(false);
	const [certNismXa, setCertNismXa] = useState(false);
	const [certNismXxia, setCertNismXxia] = useState(false);
	const [isKycDone, setIsKycDone] = useState(true);
	const [evaluationResult, setEvaluationResult] = useState<any>(null);

	// Query product matrix
	const { data: matrixResponse, isLoading: isMatrixLoading } = useQuery<{
		success: boolean;
		data: any[];
		meta?: any;
	}>({
		queryKey: ["/api/staff-product-governance/matrix"],
	});

	const products: any[] = matrixResponse?.data || [];

	// Evaluate Candidate Mutation
	const evaluateMutation = useMutation({
		mutationFn: async () => {
			const certs: string[] = [];
			if (certNismVa) certs.push("NISM_SERIES_VA");
			if (certNismViii) certs.push("NISM_SERIES_VIII");
			if (certNismXa) certs.push("NISM_SERIES_XA");
			if (certNismXxia) certs.push("NISM_SERIES_XXIA");

			const payload = {
				candidateId: `cand-${Date.now()}`,
				candidateName,
				designation,
				experienceYears: Number(experienceYears) || 0,
				hasEuin,
				euinNumber: hasEuin ? euinNumber : undefined,
				hasPosp,
				pospCertificateNumber: hasPosp ? pospNumber : undefined,
				hasDsa,
				dsaRegistrationCode: hasDsa ? dsaCode : undefined,
				certifications: certs,
				empanelmentStatus: isKycDone ? "approved" : "pending",
			};

			return await apiRequest(
				"POST",
				"/api/staff-product-governance/evaluate",
				payload,
			);
		},
		onSuccess: (res: any) => {
			setEvaluationResult(res.data);
			toast({
				title: "Eligibility Evaluated",
				description: `Candidate scored ${res.data?.candidateScore}/100 across 11 product lines.`,
			});
		},
		onError: (err: any) => {
			toast({
				title: "Evaluation Failed",
				description: err?.message || "Failed to evaluate candidate eligibility",
				variant: "destructive",
			});
		},
	});

	const getAccessBadge = (level: string) => {
		switch (level) {
			case "FULL_MANAGEMENT":
				return (
					<Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 font-medium text-xs">
						<CheckCircle2 className="h-3 w-3 mr-1" /> Full Management & Execution
					</Badge>
				);
			case "READ_ONLY":
				return (
					<Badge
						variant="outline"
						className="text-amber-700 border-amber-300 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 text-xs font-medium"
					>
						<Clock className="h-3 w-3 mr-1" /> Advisory & Factsheets Only
					</Badge>
				);
			default:
				return (
					<Badge
						variant="outline"
						className="text-red-700 border-red-300 dark:text-red-400 bg-red-50 dark:bg-red-950/40 text-xs font-medium"
					>
						<XCircle className="h-3 w-3 mr-1" /> Blocked (Regulatory Gate)
					</Badge>
				);
		}
	};

	const getRegulatorBadge = (regulator: string) => {
		switch (regulator) {
			case "SEBI":
				return (
					<Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-0 text-[10px] font-bold">
						SEBI
					</Badge>
				);
			case "IRDAI":
				return (
					<Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-0 text-[10px] font-bold">
						IRDAI
					</Badge>
				);
			case "RBI":
				return (
					<Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-[10px] font-bold">
						RBI
					</Badge>
				);
			case "PFRDA":
				return (
					<Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-0 text-[10px] font-bold">
						PFRDA
					</Badge>
				);
			default:
				return <Badge variant="outline">{regulator}</Badge>;
		}
	};

	return (
		<div className="space-y-6">
			{/* Top Overview Banner */}
			<div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-5 shadow-sm space-y-3">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
							<h3 className="text-base font-bold text-foreground">
								Multi-Vendor Regulatory Product Governance
							</h3>
							<Badge className="bg-blue-600 text-white text-[10px]">
								GCR v1.0 Statutory
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
							FintekPro strictly enforces regulatory parameters across four primary statutory bodies (<strong>SEBI</strong>, <strong>RBI</strong>, <strong>IRDAI</strong>, <strong>PFRDA</strong>). Staff authorization determines execution and advisory capabilities across connected multi-vendor portals including <strong>KFintech IRIS</strong>, <strong>CAMS</strong>, <strong>BSE StAR MF</strong>, and Direct AMC portals.
						</p>
					</div>
					<div className="flex items-center gap-2 flex-shrink-0">
						<Button
							size="sm"
							variant={activeSubView === "matrix" ? "default" : "outline"}
							onClick={() => setActiveSubView("matrix")}
							className="text-xs h-8"
						>
							<Layers className="h-3.5 w-3.5 mr-1" /> Product Matrix ({products.length || 11})
						</Button>
						<Button
							size="sm"
							variant={activeSubView === "tester" ? "default" : "outline"}
							onClick={() => setActiveSubView("tester")}
							className="text-xs h-8"
						>
							<UserCheck className="h-3.5 w-3.5 mr-1" /> Candidate Validator
						</Button>
					</div>
				</div>

				{/* SIF Highlight Card */}
				<div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
					<div className="flex items-start gap-2.5">
						<Award className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
						<div>
							<div className="flex items-center gap-2">
								<span className="font-semibold text-xs text-amber-900 dark:text-amber-200">
									Specialised Investment Funds (SIF) — SEBI New Asset Class 2024
								</span>
								<Badge className="bg-amber-600 text-white text-[10px] py-0 px-1.5">
									₹10,00,000 Floor
								</Badge>
							</div>
							<p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 mt-0.5">
								Statutory minimum ticket floor ₹10 Lakh. Full execution requires verified AMFI EUIN, minimum 2 years wealth distribution experience, Enhanced KYC (C-KYC + Video KYC), and NISM Series V-A, X-A, or XXI-A certifications.
							</p>
						</div>
					</div>
					<Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-300 text-[10px] self-start md:self-center shrink-0">
						SEBI MF Amendment 2024
					</Badge>
				</div>
			</div>

			{/* Sub-view: Product Matrix */}
			{activeSubView === "matrix" && (
				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-base flex items-center gap-2">
									<Building2 className="h-4 w-4 text-primary" /> Statutory Multi-Vendor Product Catalog
								</CardTitle>
								<CardDescription className="text-xs">
									Regulatory parameters, ticket sizes, mandatory certifications, and vendor integrations for FintekPro staff.
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{isMatrixLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : (
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Product Line</TableHead>
											<TableHead>Regulator & Framework</TableHead>
											<TableHead>Ticket Floor</TableHead>
											<TableHead>KYC Protocol</TableHead>
											<TableHead>Mandatory Clearance</TableHead>
											<TableHead>Supported Vendors</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{products.map((p: any) => (
											<TableRow key={p.category}>
												<TableCell>
													<div>
														<p className="font-semibold text-sm text-foreground">
															{p.name}
														</p>
														<p className="text-[11px] text-muted-foreground line-clamp-1">
															{p.description}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-1">
														<div className="flex items-center gap-1.5">
															{getRegulatorBadge(p.primaryRegulator)}
														</div>
														<p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]" title={p.regulatoryFramework}>
															{p.regulatoryFramework}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<span className="font-semibold text-xs text-foreground">
														{p.statutoryMinTicketInr > 0
															? formatCurrency(p.statutoryMinTicketInr)
															: "None (₹0)"}
													</span>
													{p.category === "sif" && (
														<p className="text-[10px] text-amber-600 font-medium">Statutory Floor</p>
													)}
												</TableCell>
												<TableCell>
													<p className="text-xs text-foreground font-medium">
														{p.kycRequirement}
													</p>
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap gap-1 max-w-[220px]">
														{p.requiresEuin && (
															<Badge variant="outline" className="text-[10px] py-0 px-1 border-blue-300 text-blue-700">
																EUIN
															</Badge>
														)}
														{p.requiresPosp && (
															<Badge variant="outline" className="text-[10px] py-0 px-1 border-purple-300 text-purple-700">
																IRDAI POSP
															</Badge>
														)}
														{p.requiresDsa && (
															<Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-300 text-emerald-700">
																Bank DSA
															</Badge>
														)}
														{p.mandatoryCertifications?.map((c: string) => (
															<Badge key={c} variant="secondary" className="text-[10px] py-0 px-1">
																{c.replace("NISM_SERIES_", "NISM ")}
															</Badge>
														))}
														{p.minExperienceYears > 0 && (
															<Badge variant="outline" className="text-[10px] py-0 px-1 border-gray-300">
																≥{p.minExperienceYears}y Exp
															</Badge>
														)}
													</div>
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap gap-1 max-w-[180px]">
														{p.supportedVendors?.map((v: string) => (
															<span
																key={v}
																className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
															>
																{v}
															</span>
														))}
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Sub-view: Candidate Validator */}
			{activeSubView === "tester" && (
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
					{/* Left: Input Form */}
					<Card className="lg:col-span-5">
						<CardHeader className="pb-3">
							<CardTitle className="text-base flex items-center gap-2">
								<Briefcase className="h-4 w-4 text-primary" /> Candidate / Staff Credentials
							</CardTitle>
							<CardDescription className="text-xs">
								Configure candidate credentials to simulate access governance across all 11 multi-vendor products.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-1">
								<Label className="text-xs">Candidate / Staff Name</Label>
								<Input
									value={candidateName}
									onChange={(e) => setCandidateName(e.target.value)}
									placeholder="e.g. Aakash Sharma"
									className="h-8 text-sm"
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<Label className="text-xs">Designation / Role</Label>
									<Select value={designation} onValueChange={setDesignation}>
										<SelectTrigger className="h-8 text-xs">
											<SelectValue placeholder="Select role" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="relationship_manager">Relationship Manager</SelectItem>
											<SelectItem value="senior_rm">Senior RM</SelectItem>
											<SelectItem value="branch_manager">Branch Manager</SelectItem>
											<SelectItem value="sub_broker">Sub-Broker</SelectItem>
											<SelectItem value="investment_advisor">Investment Advisor</SelectItem>
											<SelectItem value="lead_associate">Lead Associate</SelectItem>
											<SelectItem value="field_executive">Field Executive</SelectItem>
											<SelectItem value="compliance_officer">Compliance Officer</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1">
									<Label className="text-xs">Experience (Years)</Label>
									<Input
										type="number"
										value={experienceYears}
										onChange={(e) => setExperienceYears(e.target.value)}
										min="0"
										max="40"
										className="h-8 text-sm"
									/>
								</div>
							</div>

							<div className="pt-2 border-t space-y-3">
								<Label className="text-xs font-semibold text-foreground">
									Statutory Credentials & Licenses
								</Label>

								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-2">
											<Checkbox
												id="euinCheck"
												checked={hasEuin}
												onCheckedChange={(c) => setHasEuin(!!c)}
											/>
											<Label htmlFor="euinCheck" className="text-xs cursor-pointer">
												AMFI EUIN (Mutual Funds & SIF)
											</Label>
										</div>
										{hasEuin && (
											<Input
												value={euinNumber}
												onChange={(e) => setEuinNumber(e.target.value)}
												placeholder="EUIN (e.g. E382910)"
												className="h-7 w-32 text-xs"
											/>
										)}
									</div>

									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-2">
											<Checkbox
												id="pospCheck"
												checked={hasPosp}
												onCheckedChange={(c) => setHasPosp(!!c)}
											/>
											<Label htmlFor="pospCheck" className="text-xs cursor-pointer">
												IRDAI POSP License (Insurance)
											</Label>
										</div>
										{hasPosp && (
											<Input
												value={pospNumber}
												onChange={(e) => setPospNumber(e.target.value)}
												placeholder="POSP Reg No."
												className="h-7 w-32 text-xs"
											/>
										)}
									</div>

									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-2">
											<Checkbox
												id="dsaCheck"
												checked={hasDsa}
												onCheckedChange={(c) => setHasDsa(!!c)}
											/>
											<Label htmlFor="dsaCheck" className="text-xs cursor-pointer">
												Lending DSA Registration (Loans)
											</Label>
										</div>
										{hasDsa && (
											<Input
												value={dsaCode}
												onChange={(e) => setDsaCode(e.target.value)}
												placeholder="DSA Code"
												className="h-7 w-32 text-xs"
											/>
										)}
									</div>
								</div>
							</div>

							<div className="pt-2 border-t space-y-2">
								<Label className="text-xs font-semibold text-foreground">
									NISM Certifications
								</Label>
								<div className="grid grid-cols-2 gap-2">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="nismVa"
											checked={certNismVa}
											onCheckedChange={(c) => setCertNismVa(!!c)}
										/>
										<Label htmlFor="nismVa" className="text-xs cursor-pointer">
											NISM Series V-A (MF)
										</Label>
									</div>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="nismViii"
											checked={certNismViii}
											onCheckedChange={(c) => setCertNismViii(!!c)}
										/>
										<Label htmlFor="nismViii" className="text-xs cursor-pointer">
											NISM Series VIII (F&O)
										</Label>
									</div>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="nismXa"
											checked={certNismXa}
											onCheckedChange={(c) => setCertNismXa(!!c)}
										/>
										<Label htmlFor="nismXa" className="text-xs cursor-pointer">
											NISM Series X-A (RIA 1)
										</Label>
									</div>
									<div className="flex items-center space-x-2">
										<Checkbox
											id="nismXxia"
											checked={certNismXxia}
											onCheckedChange={(c) => setCertNismXxia(!!c)}
										/>
										<Label htmlFor="nismXxia" className="text-xs cursor-pointer">
											NISM XXI-A (PMS/SIF)
										</Label>
									</div>
								</div>
							</div>

							<div className="pt-2 border-t flex items-center space-x-2">
								<Checkbox
									id="kycCheck"
									checked={isKycDone}
									onCheckedChange={(c) => setIsKycDone(!!c)}
								/>
								<Label htmlFor="kycCheck" className="text-xs cursor-pointer">
									C-KYC & Empanelment Background Verified
								</Label>
							</div>

							<Button
								className="w-full text-xs h-9"
								onClick={() => evaluateMutation.mutate()}
								disabled={evaluateMutation.isPending}
							>
								{evaluateMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<ShieldCheck className="h-4 w-4 mr-2" />
								)}
								Evaluate Regulatory Clearance
							</Button>
						</CardContent>
					</Card>

					{/* Right: Evaluation Output */}
					<Card className="lg:col-span-7">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-base flex items-center gap-2">
										<UserCheck className="h-4 w-4 text-primary" /> Evaluation Audit & Product Clearance
									</CardTitle>
									<CardDescription className="text-xs">
										Statutory authorization matrix for candidate across all 11 product lines.
									</CardDescription>
								</div>
								{evaluationResult && (
									<div className="text-right">
										<span className="text-xs font-semibold text-muted-foreground">Score: </span>
										<Badge className="bg-primary text-white font-bold text-xs">
											{evaluationResult.candidateScore}/100
										</Badge>
									</div>
								)}
							</div>
						</CardHeader>
						<CardContent>
							{!evaluationResult ? (
								<div className="text-center py-16 text-muted-foreground space-y-2">
									<ShieldAlert className="h-10 w-10 mx-auto opacity-30 text-primary" />
									<p className="font-medium text-sm">No evaluation performed yet</p>
									<p className="text-xs max-w-sm mx-auto">
										Adjust candidate credentials on the left and click "Evaluate Regulatory Clearance" to verify multi-vendor product authorization.
									</p>
								</div>
							) : (
								<div className="space-y-4">
									{/* Candidate Summary */}
									<div className="p-3 bg-muted/40 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 border">
										<div>
											<p className="font-semibold text-foreground">{candidateName}</p>
											<p className="text-muted-foreground capitalize">
												Role: {designation.replace(/_/g, " ")} • Exp: {experienceYears} yrs
											</p>
										</div>
										<div className="flex gap-1.5 flex-wrap">
											{evaluationResult.candidateScore >= 70 ? (
												<Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-xs">
													Eligible for Core Products
												</Badge>
											) : (
												<Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
													Advisory & Provisional
												</Badge>
											)}
										</div>
									</div>

									{/* Product Authorizations Table */}
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Product</TableHead>
													<TableHead>Regulator</TableHead>
													<TableHead>Access Clearance</TableHead>
													<TableHead>Regulatory Notes & Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{evaluationResult.authorizations?.map((auth: any) => (
													<TableRow key={auth.category}>
														<TableCell>
															<div className="space-y-0.5">
																<p className="font-semibold text-xs text-foreground">
																	{auth.productName}
																</p>
																{auth.category === "sif" && (
																	<Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-0 text-[9px] py-0 px-1">
																		₹10L Floor
																	</Badge>
																)}
															</div>
														</TableCell>
														<TableCell>
															{getRegulatorBadge(auth.primaryRegulator)}
														</TableCell>
														<TableCell>
															{getAccessBadge(auth.accessLevel)}
														</TableCell>
														<TableCell>
															<div className="space-y-0.5 max-w-[240px]">
																<p className="text-[11px] text-muted-foreground leading-snug">
																	{auth.reason}
																</p>
																{auth.missingRequirements?.length > 0 && (
																	<p className="text-[10px] text-amber-600 font-medium">
																		Missing: {auth.missingRequirements.join(", ")}
																	</p>
																)}
															</div>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PartnerTeamManagement() {
	const [location] = useLocation();
	const tabFromUrl =
		new URLSearchParams(
			typeof window !== "undefined" ? window.location.search : "",
		).get("tab") || "team";
	const [activeTab, setActiveTab] = useState(tabFromUrl);

	useEffect(() => {
		const tab =
			new URLSearchParams(window.location.search).get("tab") || "team";
		setActiveTab(tab);
	}, [location]);

	const { data: team = [] } = useQuery<any[]>({
		queryKey: ["/api/partner/my-team"],
	});
	const { data: invitations = [] } = useQuery<any[]>({
		queryKey: ["/api/partner/invitations"],
	});
	const pending = (invitations as any[]).filter(
		(i: any) => i.status === "pending",
	).length;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold flex items-center gap-2">
					<Users className="h-6 w-6 text-primary" /> My Partner Team
				</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Manage your field team, invite new partners, configure
					commissions, and assign SM/RM. As a partner, you earn{" "}
					<strong>both partner commissions</strong> and{" "}
					<strong>team override income</strong>.
				</p>
			</div>

			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardContent className="pt-4 text-center">
						<p className="text-3xl font-bold text-primary">
							{(team as any[]).length}
						</p>
						<p className="text-sm text-muted-foreground mt-1">Active Partners</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 text-center">
						<p className="text-3xl font-bold text-amber-600">{pending}</p>
						<p className="text-sm text-muted-foreground mt-1">
							Pending Invites
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4 text-center">
						<div className="flex items-center justify-center gap-1.5">
							<UserCheck className="h-5 w-5 text-green-600" />
							<TrendingUp className="h-5 w-5 text-blue-600" />
						</div>
						<p className="text-sm text-muted-foreground mt-1">
							Network Role
						</p>
						<p className="text-xs text-green-600 font-medium">
							Partner Network
						</p>
					</CardContent>
				</Card>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid grid-cols-5 w-full max-w-3xl">
					<TabsTrigger value="team" className="flex items-center gap-1.5">
						<Users className="h-3.5 w-3.5" /> My Team
						{(team as any[]).length > 0 && (
							<Badge className="h-4 min-w-4 px-1 text-[10px]">
								{(team as any[]).length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="invite" className="flex items-center gap-1.5">
						<UserPlus className="h-3.5 w-3.5" /> Invite Partner
						{pending > 0 && (
							<Badge
								variant="secondary"
								className="h-4 min-w-4 px-1 text-[10px]"
							>
								{pending}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="bank" className="flex items-center gap-1.5">
						<Banknote className="h-3.5 w-3.5" /> Bank Account
					</TabsTrigger>
					<TabsTrigger value="splits" className="flex items-center gap-1.5">
						<Percent className="h-3.5 w-3.5" /> Commission Splits
					</TabsTrigger>
					<TabsTrigger value="governance" className="flex items-center gap-1.5">
						<ShieldCheck className="h-3.5 w-3.5" /> Product Governance
					</TabsTrigger>
				</TabsList>

				<TabsContent value="team" className="mt-4">
					<MyTeamTab />
				</TabsContent>
				<TabsContent value="invite" className="mt-4">
					<InviteAgentTab />
				</TabsContent>
				<TabsContent value="bank" className="mt-4">
					<BankAccountTab />
				</TabsContent>
				<TabsContent value="splits" className="mt-4">
					<CommissionSplitsTab />
				</TabsContent>
				<TabsContent value="governance" className="mt-4">
					<ProductGovernanceTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}
