import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import {
	FileText,
	Users,
	Clock,
	CheckCircle,
	AlertCircle,
	ChevronRight,
	MessageSquare,
	Clipboard,
	ListChecks,
	Play,
	Pause,
	RotateCcw,
	Plus,
	Send,
	Filter,
	Search,
	TrendingUp,
	Calendar,
	User,
	Phone,
	Mail,
	Building,
	ArrowRight,
	LayoutTemplate,
} from "lucide-react";

interface SupportTemplate {
	id: string;
	name: string;
	description: string;
	category: string;
	estimatedTime: string;
	requiredDocuments: string[];
	isActive: boolean;
}

interface SupportStep {
	id: string;
	templateId?: string;
	ticketId?: string;
	title: string;
	description: string;
	order: number;
	status: string;
	notes?: string;
	isRequired: boolean;
	completedAt?: string;
	completedBy?: string;
	assignedTo?: string;
}

interface SupportTicket {
	id: string;
	ticketNumber: string;
	subject: string;
	description: string;
	status: string;
	priority: string;
	category: string;
	clientName: string;
	clientEmail: string;
	clientMobile?: string;
	createdAt: string;
	stepProgress?: {
		total: number;
		completed: number;
		percentage: number;
	};
	nextStep?: SupportStep | null;
}

export default function CASupportDashboard() {
	const { toast } = useToast();
	const [, setLocation] = useLocation();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState("tickets");
	const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
		null,
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [showTemplateDialog, setShowTemplateDialog] = useState(false);
	const [selectedTemplate, setSelectedTemplate] =
		useState<SupportTemplate | null>(null);

	const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: any }>(
		{
			queryKey: ["/api/partner/support/stats"],
		},
	);

	const { data: ticketsData, isLoading: ticketsLoading } = useQuery<{
		tickets: SupportTicket[];
	}>({
		queryKey: ["/api/partner/support/tickets"],
	});

	const { data: templatesData, isLoading: templatesLoading } = useQuery<{
		templates: SupportTemplate[];
	}>({
		queryKey: ["/api/support/templates"],
	});

	const tickets = ticketsData?.tickets || [];
	const templates = templatesData?.templates || [];
	const stats = statsData?.stats || {
		total: 0,
		open: 0,
		inProgress: 0,
		resolved: 0,
		pending: 0,
	};

	const applyTemplateMutation = useMutation({
		mutationFn: async ({
			ticketId,
			templateId,
		}: { ticketId: string; templateId: string }) => {
			return apiRequest(`/api/support/tickets/${ticketId}/apply-template`, {
				method: "POST",
				body: JSON.stringify({ templateId }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/partner/support/tickets"],
			});
			queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
			toast({
				title: "Template applied",
				description: "Workflow steps have been added to the ticket",
			});
			setShowTemplateDialog(false);
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to apply template",
				variant: "destructive",
			});
		},
	});

	const updateStepMutation = useMutation({
		mutationFn: async ({
			stepId,
			status,
			notes,
		}: { stepId: string; status: string; notes?: string }) => {
			return apiRequest(`/api/support/steps/${stepId}`, {
				method: "PATCH",
				body: JSON.stringify({ status, notes }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/partner/support/tickets"],
			});
			queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
			toast({ title: "Step updated", description: "Progress has been saved" });
		},
	});

	const filteredTickets = tickets.filter((ticket) => {
		const matchesSearch =
			ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
			ticket.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
			ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus =
			statusFilter === "all" || ticket.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const getStatusColor = (status: string) => {
		switch (status) {
			case "open":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
			case "in_progress":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
			case "resolved":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
			case "pending":
				return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
			case "closed":
				return "bg-muted text-foreground";
			default:
				return "bg-muted text-foreground";
		}
	};

	const getStepStatusIcon = (status: string) => {
		switch (status) {
			case "completed":
				return <CheckCircle className="h-5 w-5 text-green-500" />;
			case "in_progress":
				return <Play className="h-5 w-5 text-yellow-500" />;
			case "pending":
				return <Clock className="h-5 w-5 text-muted-foreground" />;
			case "skipped":
				return <RotateCcw className="h-5 w-5 text-muted-foreground" />;
			default:
				return <Clock className="h-5 w-5 text-muted-foreground" />;
		}
	};

	const getCategoryIcon = (category: string) => {
		switch (category) {
			case "tax_filing":
				return <FileText className="h-5 w-5" />;
			case "kyc":
				return <User className="h-5 w-5" />;
			case "tax_planning":
				return <TrendingUp className="h-5 w-5" />;
			case "gst":
				return <Building className="h-5 w-5" />;
			default:
				return <Clipboard className="h-5 w-5" />;
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div>
						<h1 className="text-2xl md:text-3xl font-bold text-foreground">
							CA Support Dashboard
						</h1>
						<p className="text-muted-foreground mt-1">
							Manage client support requests with step-by-step workflows
						</p>
					</div>
					<Button
						className="gap-2"
						onClick={() => setShowTemplateDialog(true)}
						data-testid="button-view-templates"
					>
						<LayoutTemplate className="h-4 w-4" />
						View Templates
					</Button>
				</div>

				<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
					<Card className="bg-card" data-testid="stat-total">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
									<Clipboard className="h-5 w-5 text-blue-600 dark:text-blue-300" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Total</p>
									<p className="text-2xl font-bold text-foreground">
										{stats.total}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card" data-testid="stat-open">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
									<AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-300" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Open</p>
									<p className="text-2xl font-bold text-blue-600">
										{stats.open}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card" data-testid="stat-in-progress">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
									<Play className="h-5 w-5 text-yellow-600 dark:text-yellow-300" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">In Progress</p>
									<p className="text-2xl font-bold text-yellow-600">
										{stats.inProgress}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card" data-testid="stat-pending">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
									<Clock className="h-5 w-5 text-orange-600 dark:text-orange-300" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Pending</p>
									<p className="text-2xl font-bold text-orange-600">
										{stats.pending}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card" data-testid="stat-resolved">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
									<CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Resolved</p>
									<p className="text-2xl font-bold text-green-600">
										{stats.resolved}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="flex flex-col md:flex-row gap-4">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search tickets by subject, client name, or ticket number..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
							data-testid="input-search-tickets"
						/>
					</div>
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger
							className="w-full md:w-48"
							data-testid="select-status-filter"
						>
							<Filter className="h-4 w-4 mr-2" />
							<SelectValue placeholder="Filter by status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="open">Open</SelectItem>
							<SelectItem value="in_progress">In Progress</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
							<SelectItem value="resolved">Resolved</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<ScrollableTabsList>
						<TabsTrigger value="tickets" data-testid="tab-tickets">
							<ListChecks className="h-4 w-4 mr-2" />
							Active Tickets
						</TabsTrigger>
						<TabsTrigger value="templates" data-testid="tab-templates">
							<LayoutTemplate className="h-4 w-4 mr-2" />
							Service Templates
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent value="tickets" className="space-y-4 mt-4">
						{ticketsLoading ? (
							<div className="flex items-center justify-center py-12">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
							</div>
						) : filteredTickets.length === 0 ? (
							<Card className="bg-card">
								<CardContent className="flex flex-col items-center justify-center py-12">
									<Clipboard className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium text-foreground mb-2">
										No tickets found
									</h3>
									<p className="text-muted-foreground text-center">
										{searchQuery || statusFilter !== "all"
											? "Try adjusting your search or filter criteria"
											: "No support tickets assigned to you yet"}
									</p>
								</CardContent>
							</Card>
						) : (
							<div className="grid gap-4">
								{filteredTickets.map((ticket) => (
									<Card
										key={ticket.id}
										className="bg-card hover:shadow-lg transition-shadow cursor-pointer"
										onClick={() => setSelectedTicket(ticket)}
										data-testid={`ticket-card-${ticket.id}`}
									>
										<CardContent className="p-4">
											<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
												<div className="flex-1">
													<div className="flex items-center gap-2 mb-2">
														<span className="text-sm font-medium text-primary">
															{ticket.ticketNumber}
														</span>
														<Badge className={getStatusColor(ticket.status)}>
															{ticket.status.replace("_", " ")}
														</Badge>
														<Badge variant="outline">{ticket.category}</Badge>
													</div>
													<h3 className="text-lg font-semibold text-foreground mb-1">
														{ticket.subject}
													</h3>
													<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
														<span className="flex items-center gap-1">
															<User className="h-4 w-4" />
															{ticket.clientName}
														</span>
														<span className="flex items-center gap-1">
															<Mail className="h-4 w-4" />
															{ticket.clientEmail}
														</span>
														<span className="flex items-center gap-1">
															<Calendar className="h-4 w-4" />
															{new Date(ticket.createdAt).toLocaleDateString()}
														</span>
													</div>
												</div>
												<div className="flex flex-col items-end gap-2">
													{ticket.stepProgress &&
														ticket.stepProgress.total > 0 && (
															<div className="w-full md:w-48">
																<div className="flex items-center justify-between text-sm mb-1">
																	<span className="text-muted-foreground">
																		Progress
																	</span>
																	<span className="font-medium">
																		{ticket.stepProgress.percentage}%
																	</span>
																</div>
																<Progress
																	value={ticket.stepProgress.percentage}
																	className="h-2"
																/>
																<p className="text-xs text-muted-foreground mt-1">
																	{ticket.stepProgress.completed}/
																	{ticket.stepProgress.total} steps
																</p>
															</div>
														)}
													{ticket.nextStep && (
														<div className="flex items-center gap-2 text-sm text-primary">
															<span>Next: {ticket.nextStep.title}</span>
															<ArrowRight className="h-4 w-4" />
														</div>
													)}
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</TabsContent>

					<TabsContent value="templates" className="space-y-4 mt-4">
						{templatesLoading ? (
							<div className="flex items-center justify-center py-12">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
							</div>
						) : templates.length === 0 ? (
							<Card className="bg-card">
								<CardContent className="flex flex-col items-center justify-center py-12">
									<LayoutTemplate className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium text-foreground mb-2">
										No templates available
									</h3>
									<p className="text-muted-foreground text-center mb-4">
										Service templates help you manage client requests
										efficiently
									</p>
									<Button
										onClick={async () => {
											try {
												await apiRequest("/api/admin/support/seed-templates", {
													method: "POST",
												});
												queryClient.invalidateQueries({
													queryKey: ["/api/support/templates"],
												});
												toast({
													title: "Templates created",
													description:
														"Default CA service templates have been added",
												});
											} catch (error) {
												toast({
													title: "Error",
													description: "Failed to create templates",
													variant: "destructive",
												});
											}
										}}
										data-testid="button-seed-templates"
									>
										<Plus className="h-4 w-4 mr-2" />
										Create Default Templates
									</Button>
								</CardContent>
							</Card>
						) : (
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
								{templates.map((template) => (
									<Card
										key={template.id}
										className="bg-card hover:shadow-lg transition-shadow"
										data-testid={`template-card-${template.id}`}
									>
										<CardHeader className="pb-2">
											<div className="flex items-start gap-3">
												<div className="p-2 rounded-lg bg-primary/10">
													{getCategoryIcon(template.category)}
												</div>
												<div className="flex-1">
													<CardTitle className="text-lg">
														{template.name}
													</CardTitle>
													<CardDescription className="line-clamp-2 mt-1">
														{template.description}
													</CardDescription>
												</div>
											</div>
										</CardHeader>
										<CardContent>
											<div className="space-y-3">
												<div className="flex items-center justify-between text-sm">
													<span className="text-muted-foreground">
														Estimated Time
													</span>
													<span className="font-medium flex items-center gap-1">
														<Clock className="h-4 w-4" />
														{template.estimatedTime}
													</span>
												</div>
												<Badge variant="outline" className="capitalize">
													{template.category.replace("_", " ")}
												</Badge>
												{template.requiredDocuments &&
													template.requiredDocuments.length > 0 && (
														<div className="text-xs text-muted-foreground">
															Required:{" "}
															{template.requiredDocuments
																.slice(0, 3)
																.join(", ")}
															{template.requiredDocuments.length > 3 &&
																` +${template.requiredDocuments.length - 3} more`}
														</div>
													)}
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</TabsContent>
				</Tabs>

				<Dialog
					open={!!selectedTicket}
					onOpenChange={(open) => !open && setSelectedTicket(null)}
				>
					<DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<span>{selectedTicket?.ticketNumber}</span>
								<Badge className={getStatusColor(selectedTicket?.status || "")}>
									{selectedTicket?.status?.replace("_", " ")}
								</Badge>
							</DialogTitle>
						</DialogHeader>
						<ScrollArea className="flex-1 pr-4">
							{selectedTicket && (
								<div className="space-y-6">
									<div>
										<h3 className="font-semibold text-lg text-foreground mb-2">
											{selectedTicket.subject}
										</h3>
										<p className="text-muted-foreground">
											{selectedTicket.description}
										</p>
									</div>

									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
										<div>
											<p className="text-sm text-muted-foreground">Client</p>
											<p className="font-medium">{selectedTicket.clientName}</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Email</p>
											<p className="font-medium">
												{selectedTicket.clientEmail}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Category</p>
											<p className="font-medium capitalize">
												{selectedTicket.category.replace("_", " ")}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Created</p>
											<p className="font-medium">
												{new Date(
													selectedTicket.createdAt,
												).toLocaleDateString()}
											</p>
										</div>
									</div>

									{selectedTicket.stepProgress &&
									selectedTicket.stepProgress.total > 0 ? (
										<div>
											<div className="flex items-center justify-between mb-4">
												<h4 className="font-semibold">Workflow Progress</h4>
												<span className="text-sm text-muted-foreground">
													{selectedTicket.stepProgress.completed}/
													{selectedTicket.stepProgress.total} steps completed
												</span>
											</div>
											<Progress
												value={selectedTicket.stepProgress.percentage}
												className="h-3 mb-4"
											/>
											<Button
												onClick={() =>
													setLocation(
														`/partner/ca-support/${selectedTicket.id}`,
													)
												}
												className="w-full mt-4"
												data-testid="button-open-full-workflow"
											>
												Open Full Workflow Details
												<ArrowRight className="h-4 w-4 ml-2" />
											</Button>
										</div>
									) : (
										<div className="p-6 border-2 border-dashed border-border rounded-lg text-center">
											<LayoutTemplate className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
											<h4 className="font-medium text-foreground mb-2">
												No workflow assigned
											</h4>
											<p className="text-sm text-muted-foreground mb-4">
												Apply a service template to create a step-by-step
												workflow for this ticket
											</p>
											<Select
												onValueChange={(templateId) => {
													if (selectedTicket) {
														applyTemplateMutation.mutate({
															ticketId: selectedTicket.id,
															templateId,
														});
													}
												}}
											>
												<SelectTrigger
													className="w-full max-w-xs mx-auto"
													data-testid="select-apply-template"
												>
													<SelectValue placeholder="Select a template to apply" />
												</SelectTrigger>
												<SelectContent>
													{templates.map((template) => (
														<SelectItem key={template.id} value={template.id}>
															{template.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<Button
												variant="outline"
												onClick={() =>
													setLocation(
														`/partner/ca-support/${selectedTicket.id}`,
													)
												}
												className="w-full max-w-xs mx-auto mt-4"
												data-testid="button-view-details"
											>
												View Ticket Details
												<ArrowRight className="h-4 w-4 ml-2" />
											</Button>
										</div>
									)}
								</div>
							)}
						</ScrollArea>
					</DialogContent>
				</Dialog>

				<Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
					<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
						<DialogHeader>
							<DialogTitle>Service Templates</DialogTitle>
						</DialogHeader>
						<ScrollArea className="flex-1 pr-4">
							<div className="grid md:grid-cols-2 gap-4 py-4">
								{templates.map((template) => (
									<Card
										key={template.id}
										className="cursor-pointer hover:border-primary"
										onClick={() => setSelectedTemplate(template)}
										data-testid={`template-select-${template.id}`}
									>
										<CardHeader className="pb-2">
											<div className="flex items-start gap-3">
												<div className="p-2 rounded-lg bg-primary/10">
													{getCategoryIcon(template.category)}
												</div>
												<div>
													<CardTitle className="text-base">
														{template.name}
													</CardTitle>
													<CardDescription className="text-sm mt-1">
														{template.description}
													</CardDescription>
												</div>
											</div>
										</CardHeader>
										<CardContent className="pt-0">
											<div className="flex items-center justify-between text-sm">
												<Badge variant="outline" className="capitalize">
													{template.category.replace("_", " ")}
												</Badge>
												<span className="text-muted-foreground flex items-center gap-1">
													<Clock className="h-4 w-4" />
													{template.estimatedTime}
												</span>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</ScrollArea>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setShowTemplateDialog(false)}
							>
								Close
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
