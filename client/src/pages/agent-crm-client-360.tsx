import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
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
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
	ArrowLeft,
	Phone,
	Mail,
	MessageSquare,
	Calendar,
	FileText,
	User,
	Clock,
	CheckCircle,
	Plus,
	TrendingUp,
	IndianRupee,
	Tag,
	Activity,
	Target,
	Briefcase,
	Send,
	Video,
	Edit,
	ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ClientOverview {
	client: {
		id: string;
		email: string;
		firstName?: string;
		lastName?: string;
		mobile?: string;
	};
	recentInteractions: any[];
	opportunities: any[];
	pendingTasks: any[];
	tags: string[];
	activityTimeline: any[];
	stats: {
		totalOpportunityValue: number;
		totalInteractions: number;
		activeOpportunities: number;
		pendingTasksCount: number;
	};
}

export default function AgentCrmClient360() {
	const [, params] = useRoute("/crm/clients/:clientId");
	const clientId = params?.clientId;
	const { toast } = useToast();
	const { user } = useAuth();
	const queryClient = useQueryClient();

	const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
	const [interactionType, setInteractionType] = useState<string>("call");
	const [interactionSubject, setInteractionSubject] = useState("");
	const [interactionDescription, setInteractionDescription] = useState("");
	const [interactionOutcome, setInteractionOutcome] = useState("");

	const { data: overview, isLoading } = useQuery<ClientOverview>({
		queryKey: ["/api/crm/clients", clientId, "overview"],
		enabled: !!clientId,
	});

	const addInteractionMutation = useMutation({
		mutationFn: (data: any) =>
			apiRequest("/api/crm/interactions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/crm/clients", clientId, "overview"],
			});
			setInteractionDialogOpen(false);
			setInteractionSubject("");
			setInteractionDescription("");
			setInteractionOutcome("");
			toast({ title: "Interaction logged successfully" });
		},
		onError: () => {
			toast({ title: "Failed to log interaction", variant: "destructive" });
		},
	});

	const handleAddInteraction = () => {
		if (!user?.id) return;
		addInteractionMutation.mutate({
			agentId: user.id,
			clientId,
			type: interactionType,
			subject: interactionSubject,
			description: interactionDescription,
			outcome: interactionOutcome,
			completedAt: new Date().toISOString(),
		});
	};

	const getInteractionIcon = (type: string) => {
		switch (type) {
			case "call":
				return Phone;
			case "email":
				return Mail;
			case "meeting":
				return Video;
			case "note":
				return FileText;
			case "whatsapp":
				return MessageSquare;
			default:
				return Activity;
		}
	};

	const getInteractionColor = (type: string) => {
		switch (type) {
			case "call":
				return "bg-blue-500/20 text-blue-400";
			case "email":
				return "bg-purple-500/20 text-purple-400";
			case "meeting":
				return "bg-green-500/20 text-green-400";
			case "note":
				return "bg-yellow-500/20 text-yellow-400";
			case "whatsapp":
				return "bg-emerald-500/20 text-emerald-400";
			default:
				return "bg-muted/20 text-muted-foreground";
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
			</div>
		);
	}

	const client = overview?.client;
	const clientName =
		client?.firstName && client?.lastName
			? `${client.firstName} ${client.lastName}`
			: client?.email || "Unknown Client";

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link href="/clients">
						<Button
							variant="ghost"
							size="icon"
							data-testid="button-back-clients"
						>
							<ArrowLeft className="h-5 w-5" />
						</Button>
					</Link>
					<div>
						<h1
							className="text-2xl font-bold flex items-center gap-2"
							data-testid="text-client-name"
						>
							<User className="h-6 w-6 text-emerald-500" />
							{clientName}
						</h1>
						<p className="text-sm text-muted-foreground">{client?.email}</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{overview?.tags?.map((tag, i) => (
						<Badge key={i} variant="secondary" className="capitalize">
							<Tag className="h-3 w-3 mr-1" />
							{tag}
						</Badge>
					))}

					<Dialog
						open={interactionDialogOpen}
						onOpenChange={setInteractionDialogOpen}
					>
						<DialogTrigger asChild>
							<Button
								className="bg-emerald-600 hover:bg-emerald-700"
								data-testid="button-log-interaction"
							>
								<Plus className="h-4 w-4 mr-2" />
								Log Interaction
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Log New Interaction</DialogTitle>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div>
									<Label>Type</Label>
									<Select
										value={interactionType}
										onValueChange={setInteractionType}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="call">Phone Call</SelectItem>
											<SelectItem value="email">Email</SelectItem>
											<SelectItem value="meeting">Meeting</SelectItem>
											<SelectItem value="whatsapp">WhatsApp</SelectItem>
											<SelectItem value="note">Note</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label>Subject</Label>
									<Input
										value={interactionSubject}
										onChange={(e) => setInteractionSubject(e.target.value)}
										placeholder="Brief subject..."
									/>
								</div>
								<div>
									<Label>Description</Label>
									<Textarea
										value={interactionDescription}
										onChange={(e) => setInteractionDescription(e.target.value)}
										placeholder="Details of the interaction..."
										rows={3}
									/>
								</div>
								<div>
									<Label>Outcome</Label>
									<Select
										value={interactionOutcome}
										onValueChange={setInteractionOutcome}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select outcome..." />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="successful">Successful</SelectItem>
											<SelectItem value="follow_up_needed">
												Follow-up Needed
											</SelectItem>
											<SelectItem value="no_answer">No Answer</SelectItem>
											<SelectItem value="voicemail">Left Voicemail</SelectItem>
											<SelectItem value="completed">Completed</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<Button
									className="w-full bg-emerald-600 hover:bg-emerald-700"
									onClick={handleAddInteraction}
									disabled={addInteractionMutation.isPending}
									data-testid="button-save-interaction"
								>
									{addInteractionMutation.isPending
										? "Saving..."
										: "Save Interaction"}
								</Button>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-3">
							<div className="p-3 rounded-full bg-emerald-500/20">
								<IndianRupee className="h-5 w-5 text-emerald-400" />
							</div>
							<div>
								<p className="text-2xl font-bold">
									₹
									{(
										(overview?.stats?.totalOpportunityValue || 0) / 100000
									).toFixed(1)}
									L
								</p>
								<p className="text-xs text-muted-foreground">Pipeline Value</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-3">
							<div className="p-3 rounded-full bg-blue-500/20">
								<Target className="h-5 w-5 text-blue-400" />
							</div>
							<div>
								<p className="text-2xl font-bold">
									{overview?.stats?.activeOpportunities || 0}
								</p>
								<p className="text-xs text-muted-foreground">
									Active Opportunities
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-3">
							<div className="p-3 rounded-full bg-purple-500/20">
								<Activity className="h-5 w-5 text-purple-400" />
							</div>
							<div>
								<p className="text-2xl font-bold">
									{overview?.stats?.totalInteractions || 0}
								</p>
								<p className="text-xs text-muted-foreground">Interactions</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center gap-3">
							<div className="p-3 rounded-full bg-amber-500/20">
								<Clock className="h-5 w-5 text-amber-400" />
							</div>
							<div>
								<p className="text-2xl font-bold">
									{overview?.stats?.pendingTasksCount || 0}
								</p>
								<p className="text-xs text-muted-foreground">Pending Tasks</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="timeline" className="space-y-4">
				<ScrollableTabsList>
					<TabsTrigger value="timeline" data-testid="tab-timeline">
						<Activity className="h-4 w-4 mr-2" />
						Activity Timeline
					</TabsTrigger>
					<TabsTrigger value="interactions" data-testid="tab-interactions">
						<MessageSquare className="h-4 w-4 mr-2" />
						Interactions
					</TabsTrigger>
					<TabsTrigger value="opportunities" data-testid="tab-opportunities">
						<Briefcase className="h-4 w-4 mr-2" />
						Opportunities
					</TabsTrigger>
					<TabsTrigger value="tasks" data-testid="tab-tasks">
						<CheckCircle className="h-4 w-4 mr-2" />
						Tasks
					</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value="timeline">
					<Card>
						<CardHeader>
							<CardTitle>Activity Timeline</CardTitle>
							<CardDescription>
								Recent activities with this client
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ScrollArea className="h-[400px]">
								{overview?.activityTimeline?.length === 0 ? (
									<p className="text-center text-muted-foreground py-8">
										No activities yet
									</p>
								) : (
									<div className="space-y-4">
										{overview?.activityTimeline?.map((activity, i) => (
											<div key={activity.id || i} className="flex gap-4">
												<div className="relative">
													<div
														className={`p-2 rounded-full ${getInteractionColor(activity.activityType)}`}
													>
														{(() => {
															const Icon = getInteractionIcon(
																activity.activityType,
															);
															return <Icon className="h-4 w-4" />;
														})()}
													</div>
													{i <
														(overview?.activityTimeline?.length || 0) - 1 && (
														<div className="absolute left-1/2 top-10 -translate-x-1/2 h-full w-0.5 bg-border" />
													)}
												</div>
												<div className="flex-1 pb-6">
													<p className="font-medium">{activity.summary}</p>
													<p className="text-xs text-muted-foreground mt-1">
														{activity.createdAt &&
															formatDistanceToNow(
																new Date(activity.createdAt),
																{ addSuffix: true },
															)}
													</p>
												</div>
											</div>
										))}
									</div>
								)}
							</ScrollArea>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="interactions">
					<Card>
						<CardHeader>
							<CardTitle>Recent Interactions</CardTitle>
							<CardDescription>Communication history</CardDescription>
						</CardHeader>
						<CardContent>
							<ScrollArea className="h-[400px]">
								{overview?.recentInteractions?.length === 0 ? (
									<div className="text-center py-8">
										<MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
										<p className="text-muted-foreground">
											No interactions logged yet
										</p>
										<Button
											className="mt-4"
											variant="outline"
											onClick={() => setInteractionDialogOpen(true)}
										>
											Log First Interaction
										</Button>
									</div>
								) : (
									<div className="space-y-3">
										{overview?.recentInteractions?.map((interaction) => {
											const Icon = getInteractionIcon(interaction.type);
											return (
												<div
													key={interaction.id}
													className="flex items-start gap-3 p-3 rounded-lg border"
												>
													<div
														className={`p-2 rounded-full ${getInteractionColor(interaction.type)}`}
													>
														<Icon className="h-4 w-4" />
													</div>
													<div className="flex-1 min-w-0">
														<div className="flex items-center justify-between">
															<p className="font-medium">
																{interaction.subject ||
																	`${interaction.type} interaction`}
															</p>
															<Badge variant="outline" className="capitalize">
																{interaction.type}
															</Badge>
														</div>
														{interaction.description && (
															<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
																{interaction.description}
															</p>
														)}
														<div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
															<Clock className="h-3 w-3" />
															{interaction.createdAt &&
																format(
																	new Date(interaction.createdAt),
																	"MMM d, yyyy h:mm a",
																)}
															{interaction.outcome && (
																<>
																	<span>•</span>
																	<span className="capitalize">
																		{interaction.outcome.replace(/_/g, " ")}
																	</span>
																</>
															)}
														</div>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</ScrollArea>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="opportunities">
					<Card>
						<CardHeader>
							<CardTitle>Active Opportunities</CardTitle>
							<CardDescription>Sales pipeline for this client</CardDescription>
						</CardHeader>
						<CardContent>
							{overview?.opportunities?.length === 0 ? (
								<div className="text-center py-8">
									<Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
									<p className="text-muted-foreground">
										No active opportunities
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{overview?.opportunities?.map((opp) => (
										<div
											key={opp.id}
											className="flex items-center justify-between p-3 rounded-lg border"
										>
											<div className="flex items-center gap-3">
												<div className="p-2 rounded-full bg-emerald-500/20">
													<Target className="h-4 w-4 text-emerald-400" />
												</div>
												<div>
													<p className="font-medium">{opp.name}</p>
													<p className="text-sm text-muted-foreground capitalize">
														{opp.stage} • {opp.productType || "General"}
													</p>
												</div>
											</div>
											<div className="text-right">
												<p className="font-bold">
													₹
													{Number(opp.expectedAmount || 0).toLocaleString(
														"en-IN",
													)}
												</p>
												<Badge variant="outline" className="capitalize">
													{opp.priority}
												</Badge>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="tasks">
					<Card>
						<CardHeader>
							<CardTitle>Pending Tasks</CardTitle>
							<CardDescription>Follow-ups and reminders</CardDescription>
						</CardHeader>
						<CardContent>
							{overview?.pendingTasks?.length === 0 ? (
								<div className="text-center py-8">
									<CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
									<p className="text-muted-foreground">No pending tasks</p>
								</div>
							) : (
								<div className="space-y-3">
									{overview?.pendingTasks?.map((task) => (
										<div
											key={task.id}
											className="flex items-center justify-between p-3 rounded-lg border"
										>
											<div className="flex items-center gap-3">
												<div
													className={`p-2 rounded-full ${
														task.priority === "urgent"
															? "bg-red-500/20"
															: task.priority === "high"
																? "bg-orange-500/20"
																: "bg-blue-500/20"
													}`}
												>
													<Clock
														className={`h-4 w-4 ${
															task.priority === "urgent"
																? "text-red-400"
																: task.priority === "high"
																	? "text-orange-400"
																	: "text-blue-400"
														}`}
													/>
												</div>
												<div>
													<p className="font-medium">{task.title}</p>
													<p className="text-sm text-muted-foreground capitalize">
														{task.type}
													</p>
												</div>
											</div>
											<div className="text-right">
												{task.dueDate && (
													<p className="text-sm">
														{format(new Date(task.dueDate), "MMM d")}
													</p>
												)}
												<Badge
													variant={
														task.priority === "urgent"
															? "destructive"
															: "outline"
													}
													className="capitalize"
												>
													{task.priority}
												</Badge>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
