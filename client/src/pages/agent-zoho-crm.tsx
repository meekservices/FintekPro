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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ZohoLead {
	id: string;
	First_Name: string;
	Last_Name: string;
	Full_Name: string;
	Email: string;
	Phone: string;
	Mobile: string;
	Company: string;
	Lead_Status: string;
	Lead_Source: string;
	Created_Time: string;
	Modified_Time: string;
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
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedLead, setSelectedLead] = useState<ZohoLead | null>(null);
	const [activeTab, setActiveTab] = useState("all");

	const {
		data: leadsData,
		isLoading,
		refetch,
		isFetching,
		error: leadsError,
	} = useQuery<{
		leads: ZohoLead[];
		total: number;
		connected?: boolean;
		message?: string;
	}>({
		queryKey: ["/api/agent/zoho/leads"],
	});

	const isConnected = leadsData?.connected === true;
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
			(activeTab === "contacted" && lead.Lead_Status === "Contacted");

		return matchesSearch && matchesTab;
	});

	const syncMutation = useMutation({
		mutationFn: () => apiRequest("/api/agent/zoho/sync", { method: "POST" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/zoho/leads"] });
		},
	});

	const handleCreateProposal = (lead: ZohoLead) => {
		const params = new URLSearchParams({
			leadId: lead.id,
			name: lead.Full_Name || `${lead.First_Name} ${lead.Last_Name}`,
			email: lead.Email || "",
			phone: lead.Phone || lead.Mobile || "",
			company: lead.Company || "",
			source: "zoho",
		});
		navigate(`/agent/proposal-builder?${params.toString()}`);
	};

	const formatDate = (dateStr: string) => {
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
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">Zoho CRM</h1>
					<p className="text-muted-foreground">
						Manage your leads from Zoho CRM
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						onClick={() => syncMutation.mutate()}
						disabled={syncMutation.isPending}
						className="border-border text-muted-foreground hover:bg-card"
					>
						<RefreshCw
							className={cn(
								"h-4 w-4 mr-2",
								(isFetching || syncMutation.isPending) && "animate-spin",
							)}
						/>
						Sync from Zoho
					</Button>
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
								<CardTitle className="text-foreground">Leads</CardTitle>
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
								</TabsList>
							</Tabs>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<div className="flex items-center justify-center py-12">
									<Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
								</div>
							) : !isConnected ? (
								<div className="text-center py-12 bg-amber-500/10 rounded-lg border border-amber-500/30">
									<AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
									<p className="text-amber-300 font-medium">
										Zoho CRM Not Connected
									</p>
									<p className="text-muted-foreground text-sm mt-1">
										Please ask your admin to configure Zoho CRM integration
									</p>
								</div>
							) : filteredLeads.length === 0 ? (
								<div className="text-center py-12">
									<Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
									<p className="text-muted-foreground">No leads found</p>
									<p className="text-muted-foreground text-sm mt-1">
										{searchQuery
											? "Try a different search"
											: "Sync your leads from Zoho CRM"}
									</p>
								</div>
							) : (
								<ScrollArea className="h-[500px]">
									<div className="space-y-2">
										{filteredLeads.map((lead) => (
											<div
												key={lead.id}
												onClick={() => setSelectedLead(lead)}
												className={cn(
													"p-4 rounded-lg border cursor-pointer transition-colors",
													selectedLead?.id === lead.id
														? "bg-card border-emerald-500/50"
														: "bg-card/50 border-border hover:bg-card",
												)}
											>
												<div className="flex items-start justify-between">
													<div className="flex items-start gap-3">
														<div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
															<User className="h-5 w-5 text-muted-foreground" />
														</div>
														<div>
															<p className="font-medium text-foreground">
																{lead.Full_Name ||
																	`${lead.First_Name || ""} ${lead.Last_Name || ""}`.trim() ||
																	"Unnamed"}
															</p>
															{lead.Company && (
																<p className="text-sm text-muted-foreground flex items-center gap-1">
																	<Building2 className="h-3 w-3" />
																	{lead.Company}
																</p>
															)}
															<div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
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
													</div>
													<div className="flex flex-col items-end gap-2">
														<Badge
															variant="outline"
															className={cn(
																"text-xs",
																statusColors[lead.Lead_Status] ||
																	"bg-muted/20 text-muted-foreground",
															)}
														>
															{getStatusIcon(lead.Lead_Status)}
															<span className="ml-1">
																{lead.Lead_Status || "Unknown"}
															</span>
														</Badge>
														<span className="text-xs text-muted-foreground">
															{formatDate(lead.Created_Time)}
														</span>
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
					<Card className="bg-background border-border sticky top-4">
						<CardHeader>
							<CardTitle className="text-foreground">Lead Details</CardTitle>
							<CardDescription>
								{selectedLead
									? "View and take action on this lead"
									: "Select a lead to view details"}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{selectedLead ? (
								<div className="space-y-4">
									<div className="flex items-center gap-3">
										<div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
											<User className="h-6 w-6 text-emerald-400" />
										</div>
										<div>
											<p className="font-semibold text-foreground text-lg">
												{selectedLead.Full_Name ||
													`${selectedLead.First_Name || ""} ${selectedLead.Last_Name || ""}`.trim()}
											</p>
											<Badge
												variant="outline"
												className={cn(
													"text-xs",
													statusColors[selectedLead.Lead_Status] ||
														"bg-muted/20 text-muted-foreground",
												)}
											>
												{selectedLead.Lead_Status}
											</Badge>
										</div>
									</div>

									<div className="space-y-3 pt-4 border-t border-border">
										{selectedLead.Company && (
											<div className="flex items-center gap-3">
												<Building2 className="h-4 w-4 text-muted-foreground" />
												<span className="text-muted-foreground">
													{selectedLead.Company}
												</span>
											</div>
										)}
										{selectedLead.Email && (
											<div className="flex items-center gap-3">
												<Mail className="h-4 w-4 text-muted-foreground" />
												<a
													href={`mailto:${selectedLead.Email}`}
													className="text-emerald-400 hover:underline"
												>
													{selectedLead.Email}
												</a>
											</div>
										)}
										{(selectedLead.Phone || selectedLead.Mobile) && (
											<div className="flex items-center gap-3">
												<Phone className="h-4 w-4 text-muted-foreground" />
												<a
													href={`tel:${selectedLead.Phone || selectedLead.Mobile}`}
													className="text-emerald-400 hover:underline"
												>
													{selectedLead.Phone || selectedLead.Mobile}
												</a>
											</div>
										)}
										{selectedLead.Lead_Source && (
											<div className="flex items-center gap-3">
												<Target className="h-4 w-4 text-muted-foreground" />
												<span className="text-muted-foreground">
													{selectedLead.Lead_Source}
												</span>
											</div>
										)}
										<div className="flex items-center gap-3">
											<Calendar className="h-4 w-4 text-muted-foreground" />
											<span className="text-muted-foreground text-sm">
												Created: {formatDate(selectedLead.Created_Time)}
											</span>
										</div>
									</div>

									<div className="pt-4 space-y-2">
										<Button
											className="w-full bg-emerald-600 hover:bg-emerald-700"
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
