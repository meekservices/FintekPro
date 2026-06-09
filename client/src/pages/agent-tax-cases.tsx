import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	FileText,
	Search,
	Filter,
	Eye,
	Edit,
	Send,
	CheckCircle2,
	Clock,
	AlertTriangle,
	User,
	Calendar,
	IndianRupee,
	ArrowRight,
	Loader2,
	FileCheck,
	Globe,
	MessageSquare,
	Upload,
} from "lucide-react";

const itrStatusConfig: Record<string, { label: string; color: string }> = {
	draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
	preview: {
		label: "Locked",
		color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	},
	paid: {
		label: "Paid",
		color:
			"bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
	},
	filed: {
		label: "Filed",
		color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	},
	pending_review: {
		label: "Pending Review",
		color:
			"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
	},
	in_progress: {
		label: "In Progress",
		color:
			"bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
	},
	completed: {
		label: "Completed",
		color:
			"bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
	},
};

const form15StatusConfig: Record<string, { label: string; color: string }> = {
	draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
	pending_documents: {
		label: "Pending Docs",
		color:
			"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
	},
	pending_ca_review: {
		label: "Pending CA",
		color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	},
	ca_reviewing: {
		label: "CA Reviewing",
		color:
			"bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
	},
	approved: {
		label: "Approved",
		color:
			"bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
	},
	"15cb_signed": {
		label: "15CB Signed",
		color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
	},
	"15ca_filed": {
		label: "15CA Filed",
		color: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
	},
	completed: {
		label: "Completed",
		color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	},
};

interface ITRCase {
	id: number;
	clientName: string;
	clientPan: string;
	assessmentYear: string;
	itrForm: string;
	status: string;
	createdAt: string;
	updatedAt: string;
}

interface Form15Case {
	id: string;
	case_number: string;
	client_name: string;
	client_pan: string;
	remittance_amount: number;
	remittance_currency: string;
	beneficiary_country: string;
	status: string;
	created_at: string;
}

interface TaxNotice {
	id: number;
	clientName: string;
	noticeType: string;
	section: string;
	responseDeadline: string;
	status: string;
	priority: string;
}

export default function AgentTaxCasesPage() {
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("itr");
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [selectedCase, setSelectedCase] = useState<any>(null);
	const [showCaseDialog, setShowCaseDialog] = useState(false);
	const [caseNotes, setCaseNotes] = useState("");

	const { data: itrCases = [], isLoading: itrLoading } = useQuery<ITRCase[]>({
		queryKey: ["/api/tax/agent/itr-cases"],
		queryFn: async () => {
			try {
				return await apiRequest("/api/tax/agent/itr-cases");
			} catch {
				return [];
			}
		},
	});

	const { data: form15Cases = [], isLoading: form15Loading } = useQuery<
		Form15Case[]
	>({
		queryKey: ["/api/tax-compliance/form15/cases"],
		queryFn: async () => {
			try {
				return await apiRequest("/api/tax-compliance/form15/cases");
			} catch {
				return [];
			}
		},
	});

	const { data: notices = [], isLoading: noticesLoading } = useQuery<
		TaxNotice[]
	>({
		queryKey: ["/api/tax/agent/notices"],
		queryFn: async () => {
			try {
				return await apiRequest("/api/tax/agent/notices");
			} catch {
				return [];
			}
		},
	});

	const updateCaseMutation = useMutation({
		mutationFn: async ({
			caseId,
			action,
			notes,
			caseType,
		}: {
			caseId: number | string;
			action: string;
			notes?: string;
			caseType: "itr" | "form15";
		}) => {
			if (caseType === "form15") {
				return await apiRequest(
					`/api/tax-compliance/form15/cases/${caseId}/submit-for-review`,
					{
						method: "POST",
						body: JSON.stringify({ notes }),
					},
				);
			}
			return await apiRequest(`/api/tax/agent/cases/${caseId}/action`, {
				method: "POST",
				body: JSON.stringify({ action, notes }),
			});
		},
		onSuccess: () => {
			toast({
				title: "Case Updated",
				description: "The case has been updated successfully.",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/tax/agent/itr-cases"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/tax-compliance/form15/cases"],
			});
			setShowCaseDialog(false);
			setCaseNotes("");
		},
		onError: () => {
			toast({
				title: "Update Failed",
				description: "Failed to update the case. Please try again.",
				variant: "destructive",
			});
		},
	});

	const getStatusBadge = (status: string, type: "itr" | "form15") => {
		const config =
			type === "itr" ? itrStatusConfig[status] : form15StatusConfig[status];
		const displayConfig = config || {
			label: status,
			color: "bg-muted text-muted-foreground",
		};
		return <Badge className={displayConfig.color}>{displayConfig.label}</Badge>;
	};

	const filteredItrCases = itrCases.filter((c) => {
		const matchesSearch =
			searchQuery === "" ||
			c.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			c.clientPan?.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus = statusFilter === "all" || c.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const filteredForm15Cases = form15Cases.filter((c) => {
		const matchesSearch =
			searchQuery === "" ||
			c.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			c.client_pan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			c.case_number?.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus = statusFilter === "all" || c.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const handleViewCase = (caseData: any, type: "itr" | "form15" | "notice") => {
		setSelectedCase({ ...caseData, type });
		setShowCaseDialog(true);
	};

	const handleSubmitForReview = (
		caseId: number | string,
		caseType: "itr" | "form15",
	) => {
		updateCaseMutation.mutate({
			caseId,
			action: "submit_for_review",
			notes: caseNotes,
			caseType,
		});
	};

	const stats = {
		totalItrCases: itrCases.length,
		pendingItrCases: itrCases.filter((c) =>
			["draft", "in_progress"].includes(c.status),
		).length,
		totalForm15Cases: form15Cases.length,
		pendingForm15Cases: form15Cases.filter((c) =>
			["draft", "pending_documents"].includes(c.status),
		).length,
		totalNotices: notices.length,
		urgentNotices: notices.filter((n) => n.priority === "high").length,
	};

	return (
		<div
			className="container mx-auto p-6 space-y-6"
			data-testid="page-agent-tax-cases"
		>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Tax Cases Management
					</h1>
					<p className="text-muted-foreground">
						Manage ITR filings, 15CA/CB cases, and tax notices for your clients
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
								<FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
							</div>
							<div>
								<p className="text-2xl font-bold text-foreground">
									{stats.totalItrCases}
								</p>
								<p className="text-sm text-muted-foreground">ITR Cases</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
								<Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
							</div>
							<div>
								<p className="text-2xl font-bold text-foreground">
									{stats.pendingItrCases}
								</p>
								<p className="text-sm text-muted-foreground">Pending ITRs</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
								<Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
							</div>
							<div>
								<p className="text-2xl font-bold text-foreground">
									{stats.totalForm15Cases}
								</p>
								<p className="text-sm text-muted-foreground">15CA/CB Cases</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
								<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
							</div>
							<div>
								<p className="text-2xl font-bold text-foreground">
									{stats.urgentNotices}
								</p>
								<p className="text-sm text-muted-foreground">Urgent Notices</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="flex flex-col md:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
					<Input
						placeholder="Search by client name, PAN, or case number..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
						data-testid="input-search"
					/>
				</div>
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger
						className="w-[180px]"
						data-testid="select-status-filter"
					>
						<Filter className="w-4 h-4 mr-2" />
						<SelectValue placeholder="Filter by status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="draft">Draft</SelectItem>
						<SelectItem value="in_progress">In Progress</SelectItem>
						<SelectItem value="pending_review">Pending Review</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="itr" data-testid="tab-itr">
						<FileText className="w-4 h-4 mr-2" />
						ITR Cases ({filteredItrCases.length})
					</TabsTrigger>
					<TabsTrigger value="form15" data-testid="tab-form15">
						<Globe className="w-4 h-4 mr-2" />
						15CA/CB ({filteredForm15Cases.length})
					</TabsTrigger>
					<TabsTrigger value="notices" data-testid="tab-notices">
						<AlertTriangle className="w-4 h-4 mr-2" />
						Notices ({notices.length})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="itr" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>ITR Filing Cases</CardTitle>
							<CardDescription>
								Manage income tax return filings for your clients
							</CardDescription>
						</CardHeader>
						<CardContent>
							{itrLoading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="w-6 h-6 animate-spin text-primary" />
								</div>
							) : filteredItrCases.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
									<p>No ITR cases found</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Client</TableHead>
											<TableHead>PAN</TableHead>
											<TableHead>AY</TableHead>
											<TableHead>Form</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Updated</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredItrCases.map((itrCase) => (
											<TableRow key={itrCase.id}>
												<TableCell className="font-medium">
													{itrCase.clientName || "N/A"}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{itrCase.clientPan || "N/A"}
												</TableCell>
												<TableCell>
													{itrCase.assessmentYear || "2024-25"}
												</TableCell>
												<TableCell>{itrCase.itrForm || "ITR-1"}</TableCell>
												<TableCell>
													{getStatusBadge(itrCase.status, "itr")}
												</TableCell>
												<TableCell className="text-sm text-muted-foreground">
													{itrCase.updatedAt
														? new Date(itrCase.updatedAt).toLocaleDateString(
																"en-IN",
															)
														: "-"}
												</TableCell>
												<TableCell>
													<div className="flex gap-2">
														<Button
															size="sm"
															variant="ghost"
															onClick={() => handleViewCase(itrCase, "itr")}
															data-testid={`button-view-itr-${itrCase.id}`}
														>
															<Eye className="w-4 h-4" />
														</Button>
														<Button
															size="sm"
															variant="ghost"
															onClick={() =>
																navigate(`/tax/itr/preview/${itrCase.id}`)
															}
															data-testid={`button-edit-itr-${itrCase.id}`}
														>
															<Edit className="w-4 h-4" />
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
				</TabsContent>

				<TabsContent value="form15" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Form 15CA/15CB Cases</CardTitle>
							<CardDescription>
								Manage international remittance tax compliance cases
							</CardDescription>
						</CardHeader>
						<CardContent>
							{form15Loading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="w-6 h-6 animate-spin text-primary" />
								</div>
							) : filteredForm15Cases.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
									<p>No 15CA/CB cases found</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Case #</TableHead>
											<TableHead>Client</TableHead>
											<TableHead>Amount</TableHead>
											<TableHead>Country</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Created</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredForm15Cases.map((form15Case) => (
											<TableRow key={form15Case.id}>
												<TableCell className="font-mono text-sm">
													{form15Case.case_number}
												</TableCell>
												<TableCell className="font-medium">
													{form15Case.client_name}
												</TableCell>
												<TableCell>
													{form15Case.remittance_currency}{" "}
													{form15Case.remittance_amount?.toLocaleString()}
												</TableCell>
												<TableCell>{form15Case.beneficiary_country}</TableCell>
												<TableCell>
													{getStatusBadge(form15Case.status, "form15")}
												</TableCell>
												<TableCell className="text-sm text-muted-foreground">
													{new Date(form15Case.created_at).toLocaleDateString(
														"en-IN",
													)}
												</TableCell>
												<TableCell>
													<div className="flex gap-2">
														<Button
															size="sm"
															variant="ghost"
															onClick={() =>
																handleViewCase(form15Case, "form15")
															}
															data-testid={`button-view-form15-${form15Case.id}`}
														>
															<Eye className="w-4 h-4" />
														</Button>
														<Button
															size="sm"
															variant="ghost"
															onClick={() => navigate("/tax/15ca-cb")}
															data-testid={`button-edit-form15-${form15Case.id}`}
														>
															<Edit className="w-4 h-4" />
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
				</TabsContent>

				<TabsContent value="notices" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Tax Notices</CardTitle>
							<CardDescription>
								Handle tax notices assigned to you for response
							</CardDescription>
						</CardHeader>
						<CardContent>
							{noticesLoading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="w-6 h-6 animate-spin text-primary" />
								</div>
							) : notices.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
									<p>No tax notices assigned</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Client</TableHead>
											<TableHead>Notice Type</TableHead>
											<TableHead>Section</TableHead>
											<TableHead>Deadline</TableHead>
											<TableHead>Priority</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{notices.map((notice) => (
											<TableRow key={notice.id}>
												<TableCell className="font-medium">
													{notice.clientName}
												</TableCell>
												<TableCell>{notice.noticeType}</TableCell>
												<TableCell>{notice.section}</TableCell>
												<TableCell>
													{new Date(notice.responseDeadline).toLocaleDateString(
														"en-IN",
													)}
												</TableCell>
												<TableCell>
													<Badge
														className={
															notice.priority === "high"
																? "bg-red-500"
																: "bg-yellow-500"
														}
													>
														{notice.priority}
													</Badge>
												</TableCell>
												<TableCell>
													<Badge variant="outline">{notice.status}</Badge>
												</TableCell>
												<TableCell>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => navigate("/tax/notices")}
														data-testid={`button-view-notice-${notice.id}`}
													>
														<Eye className="w-4 h-4" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Dialog open={showCaseDialog} onOpenChange={setShowCaseDialog}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{selectedCase?.type === "itr"
								? "ITR Case Details"
								: selectedCase?.type === "form15"
									? "15CA/CB Case Details"
									: "Notice Details"}
						</DialogTitle>
						<DialogDescription>
							Review and update case information
						</DialogDescription>
					</DialogHeader>
					{selectedCase && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">Client Name</p>
									<p className="font-medium text-foreground">
										{selectedCase.clientName ||
											selectedCase.client_name ||
											"N/A"}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">PAN</p>
									<p className="font-mono text-foreground">
										{selectedCase.clientPan || selectedCase.client_pan || "N/A"}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Status</p>
									{getStatusBadge(
										selectedCase.status,
										selectedCase.type === "itr" ? "itr" : "form15",
									)}
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										{selectedCase.type === "itr" ? "ITR Form" : "Amount"}
									</p>
									<p className="font-medium text-foreground">
										{selectedCase.type === "itr"
											? selectedCase.itrForm
											: `${selectedCase.remittance_currency} ${selectedCase.remittance_amount?.toLocaleString()}`}
									</p>
								</div>
							</div>

							<Separator />

							<div className="space-y-2">
								<p className="text-sm font-medium text-foreground">Add Notes</p>
								<Textarea
									placeholder="Add notes or comments about this case..."
									value={caseNotes}
									onChange={(e) => setCaseNotes(e.target.value)}
									rows={3}
									data-testid="input-case-notes"
								/>
							</div>
						</div>
					)}
					<DialogFooter className="gap-2">
						<Button variant="outline" onClick={() => setShowCaseDialog(false)}>
							Close
						</Button>
						{selectedCase &&
							["draft", "in_progress", "pending_documents"].includes(
								selectedCase.status,
							) && (
								<Button
									onClick={() =>
										handleSubmitForReview(
											selectedCase.id,
											selectedCase.type === "form15" ? "form15" : "itr",
										)
									}
									disabled={updateCaseMutation.isPending}
									data-testid="button-submit-for-review"
								>
									{updateCaseMutation.isPending ? (
										<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									) : (
										<Send className="w-4 h-4 mr-2" />
									)}
									Submit for CA Review
								</Button>
							)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
