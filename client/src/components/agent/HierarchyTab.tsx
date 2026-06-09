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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Building2,
	ChevronDown,
	ChevronUp,
	Pencil,
	Plus,
	Users,
	TrendingUp,
	Network,
	IndianRupee,
	PieChart,
	Activity,
} from "lucide-react";

// ─── Custom Helpers ───────────────────────────────────────────────────────────
async function irisGet<T>(url: string): Promise<T> {
	const res = await fetch(url, { credentials: "include" });
	const json = (await res.json()) as T;
	if (!res.ok) {
		const msg = (json as { message?: string })?.message ?? `HTTP ${res.status}`;
		throw new Error(msg);
	}
	return json;
}

function fmt(num: number | null | undefined): string {
	if (num == null) return "—";
	if (num >= 1e7) return "₹" + (num / 1e7).toFixed(2) + " Cr";
	if (num >= 1e5) return "₹" + (num / 1e5).toFixed(2) + " L";
	return "₹" + num.toLocaleString("en-IN");
}

interface IrisApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
}

export interface SubBroker {
	euinCode?: string;
	euin?: string;
	name?: string;
	subBrokerName?: string;
	mobile?: string;
	email?: string;
	status?: string;
}

export interface SubBrokerAum {
	totalAum?: number;
	sipBook?: number;
	investorCount?: number;
	amcWise?: { amcName?: string; amc?: string; aum?: number }[];
	topSchemes?: { schemeName?: string; scheme?: string; aum?: number }[];
	categoryWise?: { category?: string; categoryName?: string; aum?: number }[];
}

export function HierarchyTab({ isAdmin }: { isAdmin: boolean }) {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [expandedEuin, setExpandedEuin] = useState<string | null>(null);
	const [empDialogOpen, setEmpDialogOpen] = useState(false);
	const [editingEuin, setEditingEuin] = useState<string | null>(null);
	const [empForm, setEmpForm] = useState({
		name: "",
		mobile: "",
		email: "",
		euinCode: "",
	});

	const { data: subBrokers, isLoading: sbL } = useQuery<
		IrisApiResponse<{ subBrokers?: SubBroker[] } | SubBroker[]>
	>({
		queryKey: ["/api/iris/hierarchy/sub-brokers"],
		retry: false,
	});

	const { data: aumData, isLoading: aumL } = useQuery<
		IrisApiResponse<SubBrokerAum>
	>({
		queryKey: ["/api/iris/hierarchy/sub-brokers", expandedEuin, "aum"],
		queryFn: () =>
			irisGet(`/api/iris/hierarchy/sub-brokers/${expandedEuin}/aum`),
		enabled: !!expandedEuin,
		retry: false,
	});

	const addEmp = useMutation({
		mutationFn: (body: Record<string, unknown>) =>
			apiRequest("/api/iris/hierarchy/employees", "POST", { body }),
		onSuccess: () => {
			toast({
				title: "Employee added",
				description:
					"The sub-broker has been successfully added to your hierarchy.",
			});
			setEmpDialogOpen(false);
			qc.invalidateQueries({ queryKey: ["/api/iris/hierarchy/sub-brokers"] });
		},
		onError: (e: Error) =>
			toast({
				title: "Failed to add employee",
				description: e.message,
				variant: "destructive",
			}),
	});

	const updateEmp = useMutation({
		mutationFn: ({
			euinCode,
			body,
		}: { euinCode: string; body: Record<string, unknown> }) =>
			apiRequest(`/api/iris/hierarchy/employees/${euinCode}`, "PUT", { body }),
		onSuccess: () => {
			toast({
				title: "Employee updated",
				description: "Sub-broker details improved.",
			});
			setEmpDialogOpen(false);
			qc.invalidateQueries({ queryKey: ["/api/iris/hierarchy/sub-brokers"] });
		},
		onError: (e: Error) =>
			toast({
				title: "Failed to update",
				description: e.message,
				variant: "destructive",
			}),
	});

	function resolveSB(): SubBroker[] {
		if (!subBrokers?.data) return [];
		if (Array.isArray(subBrokers.data)) return subBrokers.data;
		return (subBrokers.data as { subBrokers?: SubBroker[] }).subBrokers ?? [];
	}

	const brokers = resolveSB();
	const aum = aumData?.data;

	// Active sub-brokers count
	const activeCount = brokers.filter((b) => b.status === "ACTIVE").length;

	function openAdd() {
		setEditingEuin(null);
		setEmpForm({ name: "", mobile: "", email: "", euinCode: "" });
		setEmpDialogOpen(true);
	}
	function openEdit(b: SubBroker) {
		setEditingEuin(b.euinCode ?? "");
		setEmpForm({
			name: b.name ?? "",
			mobile: b.mobile ?? "",
			email: b.email ?? "",
			euinCode: b.euinCode ?? "",
		});
		setEmpDialogOpen(true);
	}

	return (
		<div className="space-y-6">
			{/* Header & Stats Banner */}
			<div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 rounded-xl border p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
				<div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
					<Network className="w-48 h-48" />
				</div>

				<div className="relative z-10">
					<h3 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
						<Network className="h-6 w-6 text-primary" />
						Distributor Network
					</h3>
					<p className="text-sm text-muted-foreground mt-1 max-w-md">
						Manage your downline sub-brokers, view their performance metrics,
						and track your organizational hierarchy.
					</p>
				</div>

				<div className="flex items-center gap-4 relative z-10">
					<div className="bg-background/80 backdrop-blur-sm border rounded-lg p-3 text-center min-w-[120px] shadow-sm">
						<h4 className="text-2xl font-bold text-primary">
							{sbL ? "-" : brokers.length}
						</h4>
						<p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mt-0.5">
							Total Partners
						</p>
					</div>
					<div className="bg-background/80 backdrop-blur-sm border rounded-lg p-3 text-center min-w-[120px] shadow-sm">
						<h4 className="text-2xl font-bold text-emerald-600">
							{sbL ? "-" : activeCount}
						</h4>
						<p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mt-0.5">
							Active
						</p>
					</div>
				</div>
			</div>

			<div className="flex items-center justify-between">
				<h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
					Hierarchy Tree
				</h4>
				{isAdmin && (
					<Button
						onClick={openAdd}
						className="shadow-md hover:shadow-lg transition-all rounded-full px-5"
					>
						<Plus className="h-4 w-4 mr-2" /> Add Partner
					</Button>
				)}
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
				<div className="xl:col-span-12 space-y-4">
					{sbL ? (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{[1, 2, 3, 4].map((i) => (
								<Skeleton key={i} className="h-24 w-full rounded-xl" />
							))}
						</div>
					) : brokers.length > 0 ? (
						<div className="grid grid-cols-1 gap-4">
							{brokers.map((b, i) => {
								const euin = b.euinCode ?? b.euin ?? "";
								const isExpanded = expandedEuin === euin;

								return (
									<div
										key={i}
										className={`rounded-xl border transition-all duration-300 ease-in-out ${isExpanded ? "border-primary/50 shadow-lg bg-card/50 backdrop-blur-sm" : "border-border/60 hover:border-primary/30 hover:shadow-md bg-card/30"}`}
									>
										{/* Main Card Header (Clickable) */}
										<button
											className={`w-full flex flex-col sm:flex-row sm:items-center justify-between p-5 text-left transition-colors rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary ${isExpanded ? "" : "rounded-b-none"}`}
											onClick={() => setExpandedEuin(isExpanded ? null : euin)}
										>
											<div className="flex items-center gap-4">
												<div
													className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${isExpanded ? "bg-primary text-primary-foreground shadow-md" : "bg-primary/10 text-primary"}`}
												>
													<Building2 className="h-6 w-6" />
												</div>
												<div>
													<div className="flex items-center gap-2">
														<h4 className="text-lg font-semibold tracking-tight">
															{b.name ?? b.subBrokerName ?? "—"}
														</h4>
														{b.status && (
															<Badge
																variant={
																	b.status === "ACTIVE"
																		? "default"
																		: "secondary"
																}
																className={`text-[10px] uppercase font-bold tracking-wider rounded-sm ${b.status === "ACTIVE" ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
															>
																{b.status}
															</Badge>
														)}
													</div>
													<div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
														<span className="flex items-center bg-muted/50 rounded text-xs px-1.5 py-0.5 border border-border/50 font-mono">
															EUIN: {euin}
														</span>
														{b.mobile && (
															<span className="flex items-center gap-1">
																• {b.mobile}
															</span>
														)}
													</div>
												</div>
											</div>

											<div className="flex items-center gap-2 mt-4 sm:mt-0">
												{isAdmin && (
													<Button
														size="sm"
														variant="ghost"
														className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
														onClick={(e) => {
															e.stopPropagation();
															openEdit(b);
														}}
													>
														<Pencil className="h-4 w-4" />
													</Button>
												)}
												<div
													className={`h-8 w-8 rounded-full flex items-center justify-center border transition-all ${isExpanded ? "bg-background shadow-inner" : "bg-background hover:bg-muted"}`}
												>
													{isExpanded ? (
														<ChevronUp className="h-4 w-4" />
													) : (
														<ChevronDown className="h-4 w-4" />
													)}
												</div>
											</div>
										</button>

										{/* Drilldown Content */}
										<div
											className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
										>
											<div className="p-5 pt-0 border-t bg-gradient-to-b from-transparent to-muted/20 rounded-b-xl">
												<div className="mt-5">
													{aumL ? (
														<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
															{[1, 2, 3].map((j) => (
																<Skeleton key={j} className="h-24 rounded-lg" />
															))}
														</div>
													) : aum ? (
														<div className="space-y-6">
															{/* Top Level KPIs */}
															<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
																<div className="bg-background rounded-lg p-4 border shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
																	<div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
																		<IndianRupee className="h-5 w-5 text-emerald-600" />
																	</div>
																	<div>
																		<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																			Total AUM
																		</p>
																		<p className="text-xl font-bold mt-1 text-foreground">
																			{fmt(aum.totalAum)}
																		</p>
																	</div>
																</div>

																<div className="bg-background rounded-lg p-4 border shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
																	<div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
																		<TrendingUp className="h-5 w-5 text-blue-600" />
																	</div>
																	<div>
																		<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																			SIP Book
																		</p>
																		<p className="text-xl font-bold mt-1 text-foreground">
																			{fmt(aum.sipBook)}
																		</p>
																	</div>
																</div>

																<div className="bg-background rounded-lg p-4 border shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
																	<div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
																		<Users className="h-5 w-5 text-indigo-600" />
																	</div>
																	<div>
																		<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																			Investors
																		</p>
																		<p className="text-xl font-bold mt-1 text-foreground">
																			{aum.investorCount ?? "—"}
																		</p>
																	</div>
																</div>

																<div className="bg-background rounded-lg p-4 border shadow-sm flex items-center gap-4 hover:border-primary/30 transition-colors">
																	<div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
																		<Activity className="h-5 w-5 text-orange-600" />
																	</div>
																	<div>
																		<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
																			Schemes
																		</p>
																		<p className="text-xl font-bold mt-1 text-foreground">
																			{aum.topSchemes?.length ?? 0}
																		</p>
																	</div>
																</div>
															</div>

															{/* Analytics Grid */}
															<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
																{/* AMC Breakdown */}
																{aum.amcWise && aum.amcWise.length > 0 && (
																	<div className="bg-background/50 rounded-xl border p-5">
																		<h5 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
																			<Building2 className="h-4 w-4 text-primary" />{" "}
																			AMC Distribution
																		</h5>
																		<div className="space-y-3">
																			{aum.amcWise.slice(0, 5).map((a, j) => {
																				const pct = aum.totalAum
																					? ((a.aum ?? 0) / aum.totalAum) * 100
																					: 0;
																				return (
																					<div key={j} className="group">
																						<div className="flex justify-between text-sm mb-1">
																							<span className="font-medium text-foreground">
																								{a.amcName ?? a.amc ?? "—"}
																							</span>
																							<span className="font-bold text-foreground">
																								{fmt(a.aum)}
																							</span>
																						</div>
																						<div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
																							<div
																								className="h-full bg-primary transition-all duration-1000 ease-out group-hover:brightness-110"
																								style={{ width: `${pct}%` }}
																							/>
																						</div>
																					</div>
																				);
																			})}
																		</div>
																	</div>
																)}

																{/* Top Schemes */}
																{aum.topSchemes &&
																	aum.topSchemes.length > 0 && (
																		<div className="bg-background/50 rounded-xl border p-5">
																			<h5 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
																				<PieChart className="h-4 w-4 text-primary" />{" "}
																				Top Schemes
																			</h5>
																			<div className="space-y-3">
																				{aum.topSchemes
																					.slice(0, 5)
																					.map((s, j) => {
																						return (
																							<div
																								key={j}
																								className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0"
																							>
																								<div className="max-w-[70%]">
																									<p
																										className="text-sm font-medium text-foreground truncate"
																										title={
																											s.schemeName ??
																											s.scheme ??
																											"—"
																										}
																									>
																										{s.schemeName ??
																											s.scheme ??
																											"—"}
																									</p>
																								</div>
																								<p className="text-sm font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
																									{fmt(s.aum)}
																								</p>
																							</div>
																						);
																					})}
																			</div>
																		</div>
																	)}
															</div>
														</div>
													) : (
														<div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg bg-background/50">
															<Network className="h-10 w-10 text-muted-foreground/30 mb-3" />
															<p className="font-medium">No performance data</p>
															<p className="text-sm">
																AUM analytics will appear once this partner
																registers investments.
															</p>
														</div>
													)}
												</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed bg-muted/10">
							<div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
								<Network className="h-10 w-10 text-primary" />
							</div>
							<h3 className="text-xl font-semibold mb-2">
								No Sub-Brokers Found
							</h3>
							<p className="text-muted-foreground max-w-sm">
								Your organizational hierarchy is currently empty. Click the
								button below to add your first partner.
							</p>
							{isAdmin && (
								<Button onClick={openAdd} className="mt-6 rounded-full">
									<Plus className="h-4 w-4 mr-2" /> Add Partner
								</Button>
							)}
						</div>
					)}
				</div>
			</div>

			{isAdmin && (
				<Dialog open={empDialogOpen} onOpenChange={setEmpDialogOpen}>
					<DialogContent className="sm:max-w-md p-0 overflow-hidden">
						<div className="bg-gradient-to-r from-primary/10 to-transparent p-6 pb-4 border-b">
							<DialogTitle className="text-xl flex items-center gap-2">
								{editingEuin ? (
									<Pencil className="h-5 w-5 text-primary" />
								) : (
									<Plus className="h-5 w-5 text-primary" />
								)}
								{editingEuin ? "Update Partner Details" : "Add New Partner"}
							</DialogTitle>
							<DialogDescription className="mt-1">
								{editingEuin
									? `Editing EUIN mapping: ${editingEuin}`
									: "Register a new sub-broker downline in your hierarchy."}
							</DialogDescription>
						</div>

						<div className="p-6 space-y-5 bg-background">
							{!editingEuin && (
								<div className="space-y-1.5">
									<Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
										EUIN Code <span className="text-destructive">*</span>
									</Label>
									<Input
										className="focus-visible:ring-primary/50"
										value={empForm.euinCode}
										onChange={(e) =>
											setEmpForm((f) => ({
												...f,
												euinCode: e.target.value.toUpperCase(),
											}))
										}
										placeholder="e.g. E123456"
									/>
								</div>
							)}

							<div className="space-y-1.5">
								<Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
									Full Name <span className="text-destructive">*</span>
								</Label>
								<Input
									className="focus-visible:ring-primary/50"
									value={empForm.name}
									onChange={(e) =>
										setEmpForm((f) => ({ ...f, name: e.target.value }))
									}
									placeholder="John Doe"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
										Mobile
									</Label>
									<Input
										className="focus-visible:ring-primary/50"
										value={empForm.mobile}
										onChange={(e) =>
											setEmpForm((f) => ({ ...f, mobile: e.target.value }))
										}
										placeholder="+91 XXXXXXXXXX"
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
										Email
									</Label>
									<Input
										className="focus-visible:ring-primary/50"
										type="email"
										value={empForm.email}
										onChange={(e) =>
											setEmpForm((f) => ({ ...f, email: e.target.value }))
										}
										placeholder="john@example.com"
									/>
								</div>
							</div>
						</div>

						<div className="p-4 bg-muted/50 border-t flex items-center justify-end gap-3">
							<Button
								variant="ghost"
								className="hover:bg-background"
								onClick={() => setEmpDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								className="min-w-[120px] shadow-md"
								onClick={() => {
									if (editingEuin) {
										updateEmp.mutate({
											euinCode: editingEuin,
											body: {
												name: empForm.name,
												mobile: empForm.mobile,
												email: empForm.email,
											},
										});
									} else {
										addEmp.mutate({
											euinCode: empForm.euinCode,
											name: empForm.name,
											mobile: empForm.mobile,
											email: empForm.email,
										});
									}
								}}
								disabled={
									addEmp.isPending ||
									updateEmp.isPending ||
									(!editingEuin && !empForm.euinCode) ||
									!empForm.name
								}
							>
								{addEmp.isPending || updateEmp.isPending ? (
									<span className="flex items-center gap-2">
										<Activity className="h-4 w-4 animate-pulse" /> Saving...
									</span>
								) : editingEuin ? (
									"Save Changes"
								) : (
									"Create Partner"
								)}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
