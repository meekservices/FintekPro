import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Target,
	Search,
	Plus,
	Phone,
	Mail,
	Calendar,
	FileText,
	RefreshCw,
	User,
	Building2,
	Clock,
	CheckCircle2,
	XCircle,
	AlertCircle,
	ChevronRight,
	Loader2,
	TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CRMLead {
	id: string;
	First_Name?: string;
	Last_Name?: string;
	Full_Name: string;
	Email: string;
	Phone: string;
	Mobile: string;
	Company: string;
	Lead_Status: string;
	Lead_Source: string;
	Created_Time: string;
	Modified_Time?: string;
	cin?: string | null;
	leadScore?: number | null;
	wealthScore?: string | null;
	activityScore?: string | null;
	compositeScore?: string | null;
	notes?: string | null;
	Owner?: { name: string; email: string };
}

const statusColors: Record<string, string> = {
	New: "bg-blue-500/20 text-blue-400 border-blue-500/30",
	Contacted: "bg-purple-500/20 text-purple-400 border-purple-500/30",
	Qualified: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
	"Proposal Sent": "bg-amber-500/20 text-amber-400 border-amber-500/30",
	"Not Qualified": "bg-red-500/20 text-red-400 border-red-500/30",
	Converted: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function AgentZohoCRM() {
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
	const [activeTab, setActiveTab] = useState("all");
	const [createDialogOpen, setCreateDialogOpen] = useState(false);

	// New lead form state
	const [newLeadForm, setNewLeadForm] = useState({
		companyName: "",
		contactName: "",
		email: "",
		phone: "",
		status: "new",
		notes: "",
	});

	// Primary query: native CRM leads
	const {
		data: leadsData,
		isLoading,
		refetch,
		isFetching,
		error: leadsError,
	} = useQuery<{
		leads: CRMLead[];
		total: number;
		connected?: boolean;
		message?: string;
	}>({
		queryKey: ["/api/crm/leads"],
	});

	const leads = leadsData?.leads || [];

	const filteredLeads = leads.filter((lead) => {
		const matchesSearch =
			!searchQuery ||
			lead.Full_Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			lead.Email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			lead.Company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			lead.Phone?.includes(searchQuery);

		const matchesTab =
			activeTab === "all" ||
			(activeTab === "new" && lead.Lead_Status === "New") ||
			(activeTab === "qualified" && lead.Lead_Status === "Qualified") ||
			(activeTab === "contacted" && lead.Lead_Status === "Contacted") ||
			(activeTab === "converted" && lead.Lead_Status === "Converted");

		return matchesSearch && matchesTab;
	});

	const syncMutation = useMutation({
		mutationFn: () => apiRequest("/api/crm/sync", "POST"),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
			queryClient.invalidateQueries({ queryKey: ["/api/agent/zoho/leads"] });
			toast({
				title: "CRM Refreshed",
				description: "Latest lead data loaded successfully.",
			});
		},
	});

	const createLeadMutation = useMutation({
		mutationFn: async (payload: typeof newLeadForm) => {
			return await apiRequest("/api/crm/leads", "POST", {
				companyName: payload.companyName,
				primaryContactName: payload.contactName,
				primaryEmail: payload.email,
				primaryMobile: payload.phone,
				status: payload.status,
				notes: payload.notes,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
			setCreateDialogOpen(false);
			setNewLeadForm({
				companyName: "",
				contactName: "",
				email: "",
				phone: "",
				status: "new",
				notes: "",
			});
			toast({
				title: "Lead Created",
				description: "New prospect lead added to your CRM pipeline.",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Failed to create lead",
				description: err.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	const handleCreateProposal = (lead: CRMLead) => {
		const params = new URLSearchParams({
			leadId: lead.id,
			name: lead.Full_Name || `${lead.First_Name || ""} ${lead.Last_Name || ""}`.trim(),
			email: lead.Email || "",
			phone: lead.Phone || lead.Mobile || "",
			company: lead.Company || "",
			source: "native_crm",
		});
		navigate(`/partner/proposal-builder?${params.toString()}`);
	};

	const formatDate = (dateStr?: string) => {
		if (!dateStr) return "-";
		try {
			return new Date(dateStr).toLocaleDateString("en-IN", {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
		} catch {
			return "-";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "Qualified":
			case "Converted":
				return <CheckCircle2 className="h-4 w-4" />;
			case "Not Qualified":
				return <XCircle className="h-4 w-4" />;
			case "New":
				return <AlertCircle className="h-4 w-4" />;
			default:
				return <Clock className="h-4 w-4" />;
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-bold text-foreground">Partner CRM</h1>
						<Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
							Native Database
						</Badge>
					</div>
					<p className="text-muted-foreground text-sm mt-1">
						Manage your client pipeline, prospect leads, and investment opportunities
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						onClick={() => syncMutation.mutate()}
						disabled={syncMutation.isPending || isFetching}
						className="border-border text-muted-foreground hover:bg-card"
					>
						<RefreshCw
							className={cn(
								"h-4 w-4 mr-2",
								(isFetching || syncMutation.isPending) && "animate-spin",
							)}
						/>
						Refresh
					</Button>

					<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
						<DialogTrigger asChild>
							<Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
								<Plus className="h-4 w-4 mr-2" />
								Add Lead
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-[450px]">
							<DialogHeader>
								<DialogTitle>Add New Lead</DialogTitle>
								<DialogDescription>
									Create a new client or corporate prospect in your CRM pipeline.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-3 py-2">
								<div className="space-y-1">
									<Label htmlFor="contactName">Contact Name *</Label>
									<Input
										id="contactName"
										placeholder="e.g. Ramesh Sharma"
										value={newLeadForm.contactName}
										onChange={(e) =>
											setNewLeadForm((prev) => ({ ...prev, contactName: e.target.value }))
										}
									/>
								</div>
								<div className="space-y-1">
									<Label htmlFor="companyName">Company / Organization</Label>
									<Input
										id="companyName"
										placeholder="e.g. Sharma Enterprises Pvt Ltd"
										value={newLeadForm.companyName}
										onChange={(e) =>
											setNewLeadForm((prev) => ({ ...prev, companyName: e.target.value }))
										}
									/>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											placeholder="client@example.com"
											value={newLeadForm.email}
											onChange={(e) =>
												setNewLeadForm((prev) => ({ ...prev, email: e.target.value }))
											}
										/>
									</div>
									<div className="space-y-1">
										<Label htmlFor="phone">Phone / Mobile</Label>
										<Input
											id="phone"
											placeholder="9876543210"
											value={newLeadForm.phone}
											onChange={(e) =>
												setNewLeadForm((prev) => ({ ...prev, phone: e.target.value }))
											}
										/>
									</div>
								</div>
								<div className="space-y-1">
									<Label htmlFor="notes">Notes / Requirements</Label>
									<Textarea
										id="notes"
										placeholder="Interested in AIF / PMS / Loan..."
										value={newLeadForm.notes}
										onChange={(e) =>
											setNewLeadForm((prev) => ({ ...prev, notes: e.target.value }))
										}
										rows={3}
									/>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setCreateDialogOpen(false)}
								>
									Cancel
								</Button>
								<Button
									className="bg-emerald-600 hover:bg-emerald-700 text-white"
									onClick={() => createLeadMutation.mutate(newLeadForm)}
									disabled={createLeadMutation.isPending || (!newLeadForm.contactName && !newLeadForm.companyName)}
								>
									{createLeadMutation.isPending && (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									)}
									Save Lead
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card className="bg-background border-border">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-muted-foreground text-sm">Total Leads</p>
								<p className="text-2xl font-bold text-foreground">
									{leads.length}
								</p>
							</div>
							<Target className="h-8 w-8 text-blue-400" />
						</div>
					</CardContent>
				</Card>
				<Card className="bg-background border-border">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-muted-foreground text-sm">New</p>
								<p className="text-2xl font-bold text-foreground">
									{leads.filter((l) => l.Lead_Status === "New").length}
								</p>
							</div>
							<AlertCircle className="h-8 w-8 text-blue-400" />
						</div>
					</CardContent>
				</Card>
				<Card className="bg-background border-border">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-muted-foreground text-sm">Qualified</p>
								<p className="text-2xl font-bold text-foreground">
									{leads.filter((l) => l.Lead_Status === "Qualified").length}
								</p>
							</div>
							<CheckCircle2 className="h-8 w-8 text-emerald-400" />
						</div>
					</CardContent>
				</Card>
				<Card className="bg-background border-border">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-muted-foreground text-sm">Contacted</p>
								<p className="text-2xl font-bold text-foreground">
									{leads.filter((l) => l.Lead_Status === "Contacted").length}
								</p>
							</div>
							<Phone className="h-8 w-8 text-purple-400" />
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2">
					<Card className="bg-background border-border">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-foreground">Pipeline Leads</CardTitle>
								<div className="relative w-64">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search leads..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-9 bg-card border-border text-foreground"
									/>
								</div>
							</div>
							<Tabs
								value={activeTab}
								onValueChange={setActiveTab}
								className="mt-3"
							>
								<TabsList className="bg-card">
									<TabsTrigger value="all">All</TabsTrigger>
									<TabsTrigger value="new">New</TabsTrigger>
									<TabsTrigger value="contacted">Contacted</TabsTrigger>
									<TabsTrigger value="qualified">Qualified</TabsTrigger>
									<TabsTrigger value="converted">Converted</TabsTrigger>
								</TabsList>
							</Tabs>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<div className="flex items-center justify-center py-12">
									<Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
								</div>
							) : filteredLeads.length === 0 ? (
								<div className="text-center py-12">
									<Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
									<p className="text-muted-foreground">No leads found</p>
									<p className="text-muted-foreground text-sm mt-1">
										{searchQuery
											? "Try adjusting your search criteria"
											: "Add a lead to begin tracking your pipeline"}
									</p>
								</div>
							) : (
								<ScrollArea className="h-[500px]">
									<div className="space-y-2">
										{filteredLeads.map((lead) => (
											// biome-ignore lint/a11y/noStaticElementInteractions: lead selection item
											// biome-ignore lint/a11y/useKeyWithClickEvents: lead selection item
											<div
												key={lead.id}
												onClick={() => setSelectedLead(lead)}
												className={cn(
													"p-3 rounded-lg border transition-colors cursor-pointer",
													selectedLead?.id === lead.id
														? "border-emerald-500/50 bg-emerald-500/5"
														: "border-border hover:bg-card/50",
												)}
											>
												<div className="flex items-start justify-between">
													<div className="space-y-1">
														<div className="flex items-center gap-2">
															<span className="font-medium text-foreground">
																{lead.Full_Name}
															</span>
															<Badge
																variant="outline"
																className={cn(
																	"text-xs",
																	statusColors[lead.Lead_Status] ||
																		"bg-muted text-muted-foreground",
																)}
															>
																{getStatusIcon(lead.Lead_Status)}
																<span className="ml-1">{lead.Lead_Status}</span>
															</Badge>
														</div>
														{lead.Company && (
															<p className="text-sm text-muted-foreground flex items-center gap-1">
																<Building2 className="h-3 w-3" />
																{lead.Company}
															</p>
														)}
														<div className="flex items-center gap-4 text-xs text-muted-foreground">
															{lead.Email && (
																<span className="flex items-center gap-1">
																	<Mail className="h-3 w-3" />
																	{lead.Email}
																</span>
															)}
															{(lead.Phone || lead.Mobile) && (
																<span className="flex items-center gap-1">
																	<Phone className="h-3 w-3" />
																	{lead.Phone || lead.Mobile}
																</span>
															)}
														</div>
													</div>
													<div className="text-right text-xs text-muted-foreground">
														<span>{formatDate(lead.Created_Time)}</span>
													</div>
												</div>
											</div>
										))}
									</div>
								</ScrollArea>
							)}
						</CardContent>
					</Card>
				</div>

				<div>
					<Card className="bg-background border-border sticky top-6">
						<CardHeader>
							<CardTitle className="text-foreground">Lead Details</CardTitle>
							<CardDescription>
								Comprehensive client profile & actions
							</CardDescription>
						</CardHeader>
						<CardContent>
							{selectedLead ? (
								<div className="space-y-4">
									<div className="pb-3 border-b border-border">
										<h3 className="font-semibold text-lg text-foreground">
											{selectedLead.Full_Name}
										</h3>
										{selectedLead.Company && (
											<p className="text-muted-foreground flex items-center gap-1 text-sm mt-0.5">
												<Building2 className="h-3.5 w-3.5" />
												{selectedLead.Company}
											</p>
										)}
										<Badge
											variant="outline"
											className={cn(
												"mt-2 text-xs",
												statusColors[selectedLead.Lead_Status] ||
													"bg-muted text-muted-foreground",
											)}
										>
											{selectedLead.Lead_Status}
										</Badge>
									</div>

									<div className="space-y-2 text-sm">
										{selectedLead.Email && (
											<div className="flex items-center justify-between py-1">
												<span className="text-muted-foreground flex items-center gap-2">
													<Mail className="h-4 w-4" /> Email
												</span>
												<span className="text-foreground font-mono text-xs">
													{selectedLead.Email}
												</span>
											</div>
										)}
										{(selectedLead.Phone || selectedLead.Mobile) && (
											<div className="flex items-center justify-between py-1">
												<span className="text-muted-foreground flex items-center gap-2">
													<Phone className="h-4 w-4" /> Phone
												</span>
												<span className="text-foreground">
													{selectedLead.Phone || selectedLead.Mobile}
												</span>
											</div>
										)}
										{selectedLead.cin && (
											<div className="flex items-center justify-between py-1">
												<span className="text-muted-foreground flex items-center gap-2">
													<Building2 className="h-4 w-4" /> CIN
												</span>
												<span className="text-foreground font-mono text-xs">
													{selectedLead.cin}
												</span>
											</div>
										)}
										{selectedLead.leadScore !== undefined && selectedLead.leadScore !== null && (
											<div className="flex items-center justify-between py-1">
												<span className="text-muted-foreground flex items-center gap-2">
													<TrendingUp className="h-4 w-4 text-emerald-400" /> Lead Score
												</span>
												<span className="text-emerald-400 font-semibold">
													{selectedLead.leadScore} / 100
												</span>
											</div>
										)}
										<div className="flex items-center justify-between py-1">
											<span className="text-muted-foreground flex items-center gap-2">
												<Calendar className="h-4 w-4" /> Created
											</span>
											<span className="text-foreground">
												{formatDate(selectedLead.Created_Time)}
											</span>
										</div>
										<div className="flex items-center justify-between py-1">
											<span className="text-muted-foreground">Source</span>
											<span className="text-foreground">
												{selectedLead.Lead_Source || "Native CRM"}
											</span>
										</div>
										{selectedLead.notes && (
											<div className="pt-2 border-t border-border">
												<p className="text-xs text-muted-foreground font-medium mb-1">Notes</p>
												<p className="text-xs text-foreground/80 bg-card p-2 rounded border border-border">
													{selectedLead.notes}
												</p>
											</div>
										)}
									</div>

									<div className="pt-4 space-y-2">
										<Button
											className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
											onClick={() => handleCreateProposal(selectedLead)}
										>
											<FileText className="h-4 w-4 mr-2" />
											Create Proposal
											<ChevronRight className="h-4 w-4 ml-auto" />
										</Button>
										{(selectedLead.Phone || selectedLead.Mobile) && (
											<Button
												variant="outline"
												className="w-full border-border text-muted-foreground hover:bg-card"
												asChild
											>
												<a
													href={`tel:${selectedLead.Phone || selectedLead.Mobile}`}
												>
													<Phone className="h-4 w-4 mr-2" />
													Call Lead
												</a>
											</Button>
										)}
										{selectedLead.Email && (
											<Button
												variant="outline"
												className="w-full border-border text-muted-foreground hover:bg-card"
												asChild
											>
												<a href={`mailto:${selectedLead.Email}`}>
													<Mail className="h-4 w-4 mr-2" />
													Send Email
												</a>
											</Button>
										)}
									</div>
								</div>
							) : (
								<div className="text-center py-8">
									<Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
									<p className="text-muted-foreground">Select a lead</p>
									<p className="text-muted-foreground text-sm mt-1">
										Click on a lead to view details and take actions
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
