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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import {
	Plus,
	Target,
	IndianRupee,
	User,
	Calendar,
	GripVertical,
	MoreVertical,
	TrendingUp,
	Trophy,
	XCircle,
	Clock,
	ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface Opportunity {
	id: string;
	name: string;
	clientId: string;
	stage: string;
	expectedAmount: string;
	probability: number;
	productType: string;
	priority: string;
	expectedCloseDate: string;
	createdAt: string;
}

interface OpportunitiesByStage {
	lead: Opportunity[];
	qualified: Opportunity[];
	proposal: Opportunity[];
	negotiation: Opportunity[];
	won: Opportunity[];
	lost: Opportunity[];
}

const stageConfig = {
	lead: {
		label: "Lead",
		color: "bg-blue-500",
		textColor: "text-blue-500",
		probability: 10,
	},
	qualified: {
		label: "Qualified",
		color: "bg-cyan-500",
		textColor: "text-cyan-500",
		probability: 25,
	},
	proposal: {
		label: "Proposal",
		color: "bg-purple-500",
		textColor: "text-purple-500",
		probability: 50,
	},
	negotiation: {
		label: "Negotiation",
		color: "bg-orange-500",
		textColor: "text-orange-500",
		probability: 75,
	},
	won: {
		label: "Won",
		color: "bg-emerald-500",
		textColor: "text-emerald-500",
		probability: 100,
	},
	lost: {
		label: "Lost",
		color: "bg-red-500",
		textColor: "text-red-500",
		probability: 0,
	},
};

export default function AgentCrmPipeline() {
	const { toast } = useToast();
	const { user } = useAuth();
	const queryClient = useQueryClient();

	const [newOppDialogOpen, setNewOppDialogOpen] = useState(false);
	const [newOpp, setNewOpp] = useState({
		name: "",
		clientId: "",
		expectedAmount: "",
		productType: "mutual_fund",
		priority: "medium",
		expectedCloseDate: "",
		description: "",
	});

	const { data: opportunities, isLoading } = useQuery<OpportunitiesByStage>({
		queryKey: ["/api/crm/opportunities/by-stage", { agentId: user?.id }],
		enabled: !!user?.id,
	});

	const { data: clients } = useQuery<any[]>({
		queryKey: ["/api/users"],
	});

	const createOpportunityMutation = useMutation({
		mutationFn: (data: any) =>
			apiRequest("/api/crm/opportunities", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/crm/opportunities/by-stage"],
			});
			setNewOppDialogOpen(false);
			setNewOpp({
				name: "",
				clientId: "",
				expectedAmount: "",
				productType: "mutual_fund",
				priority: "medium",
				expectedCloseDate: "",
				description: "",
			});
			toast({ title: "Opportunity created successfully" });
		},
		onError: () => {
			toast({ title: "Failed to create opportunity", variant: "destructive" });
		},
	});

	const updateStageMutation = useMutation({
		mutationFn: ({ id, stage }: { id: string; stage: string }) =>
			apiRequest(`/api/crm/opportunities/${id}/stage`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stage, agentId: user?.id }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/crm/opportunities/by-stage"],
			});
			toast({ title: "Stage updated" });
		},
		onError: () => {
			toast({ title: "Failed to update stage", variant: "destructive" });
		},
	});

	const handleCreateOpportunity = () => {
		if (!user?.id || !newOpp.name || !newOpp.clientId) return;
		createOpportunityMutation.mutate({
			agentId: user.id,
			clientId: newOpp.clientId,
			name: newOpp.name,
			expectedAmount: newOpp.expectedAmount,
			productType: newOpp.productType,
			priority: newOpp.priority,
			expectedCloseDate: newOpp.expectedCloseDate || null,
			description: newOpp.description,
			stage: "lead",
		});
	};

	const handleDragStart = (e: React.DragEvent, oppId: string) => {
		e.dataTransfer.setData("opportunityId", oppId);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDrop = (e: React.DragEvent, newStage: string) => {
		e.preventDefault();
		const oppId = e.dataTransfer.getData("opportunityId");
		if (oppId) {
			updateStageMutation.mutate({ id: oppId, stage: newStage });
		}
	};

	const calculatePipelineValue = (stage: string) => {
		const opps = opportunities?.[stage as keyof OpportunitiesByStage] || [];
		return opps.reduce((sum, o) => sum + Number(o.expectedAmount || 0), 0);
	};

	const totalPipelineValue = [
		"lead",
		"qualified",
		"proposal",
		"negotiation",
	].reduce((sum, stage) => sum + calculatePipelineValue(stage), 0);
	const wonValue = calculatePipelineValue("won");

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1
						className="text-2xl font-bold flex items-center gap-2"
						data-testid="text-pipeline-title"
					>
						<Target className="h-6 w-6 text-emerald-500" />
						Sales Pipeline
					</h1>
					<p className="text-sm text-muted-foreground">
						Manage deals and track progress
					</p>
				</div>

				<div className="flex items-center gap-4">
					<div className="text-right">
						<p className="text-xs text-muted-foreground">Pipeline Value</p>
						<p className="text-lg font-bold text-emerald-400">
							₹{(totalPipelineValue / 100000).toFixed(1)}L
						</p>
					</div>
					<div className="text-right border-l pl-4">
						<p className="text-xs text-muted-foreground">Won</p>
						<p className="text-lg font-bold text-green-400">
							₹{(wonValue / 100000).toFixed(1)}L
						</p>
					</div>

					<Dialog open={newOppDialogOpen} onOpenChange={setNewOppDialogOpen}>
						<DialogTrigger asChild>
							<Button
								className="bg-emerald-600 hover:bg-emerald-700"
								data-testid="button-new-opportunity"
							>
								<Plus className="h-4 w-4 mr-2" />
								New Opportunity
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create New Opportunity</DialogTitle>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div>
									<Label>Opportunity Name</Label>
									<Input
										value={newOpp.name}
										onChange={(e) =>
											setNewOpp({ ...newOpp, name: e.target.value })
										}
										placeholder="e.g., MF SIP for Retirement"
									/>
								</div>
								<div>
									<Label>Client</Label>
									<Select
										value={newOpp.clientId}
										onValueChange={(v) => setNewOpp({ ...newOpp, clientId: v })}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select client..." />
										</SelectTrigger>
										<SelectContent>
											{clients?.slice(0, 50).map((client: any) => (
												<SelectItem key={client.id} value={client.id}>
													{client.firstName} {client.lastName} ({client.email})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label>Expected Amount (₹)</Label>
									<Input
										type="number"
										value={newOpp.expectedAmount}
										onChange={(e) =>
											setNewOpp({ ...newOpp, expectedAmount: e.target.value })
										}
										placeholder="500000"
									/>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label>Product Type</Label>
										<Select
											value={newOpp.productType}
											onValueChange={(v) =>
												setNewOpp({ ...newOpp, productType: v })
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="mutual_fund">Mutual Fund</SelectItem>
												<SelectItem value="stocks">Stocks</SelectItem>
												<SelectItem value="bonds">Bonds</SelectItem>
												<SelectItem value="insurance">Insurance</SelectItem>
												<SelectItem value="pms">PMS</SelectItem>
												<SelectItem value="aif">AIF</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div>
										<Label>Priority</Label>
										<Select
											value={newOpp.priority}
											onValueChange={(v) =>
												setNewOpp({ ...newOpp, priority: v })
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="low">Low</SelectItem>
												<SelectItem value="medium">Medium</SelectItem>
												<SelectItem value="high">High</SelectItem>
												<SelectItem value="urgent">Urgent</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
								<div>
									<Label>Expected Close Date</Label>
									<Input
										type="date"
										value={newOpp.expectedCloseDate}
										onChange={(e) =>
											setNewOpp({
												...newOpp,
												expectedCloseDate: e.target.value,
											})
										}
									/>
								</div>
								<Button
									className="w-full bg-emerald-600 hover:bg-emerald-700"
									onClick={handleCreateOpportunity}
									disabled={
										createOpportunityMutation.isPending ||
										!newOpp.name ||
										!newOpp.clientId
									}
									data-testid="button-save-opportunity"
								>
									{createOpportunityMutation.isPending
										? "Creating..."
										: "Create Opportunity"}
								</Button>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<ScrollArea className="w-full">
				<div className="flex gap-4 pb-4 min-w-max">
					{(
						[
							"lead",
							"qualified",
							"proposal",
							"negotiation",
							"won",
							"lost",
						] as const
					).map((stage) => {
						const config = stageConfig[stage];
						const stageOpps = opportunities?.[stage] || [];
						const stageValue = calculatePipelineValue(stage);

						return (
							<div
								key={stage}
								className="w-72 flex-shrink-0"
								onDragOver={handleDragOver}
								onDrop={(e) => handleDrop(e, stage)}
							>
								<Card className="h-full">
									<CardHeader className="pb-2">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<div
													className={`w-3 h-3 rounded-full ${config.color}`}
												/>
												<CardTitle className="text-sm font-medium">
													{config.label}
												</CardTitle>
												<Badge variant="secondary" className="text-xs">
													{stageOpps.length}
												</Badge>
											</div>
										</div>
										<p className="text-xs text-muted-foreground">
											₹{(stageValue / 100000).toFixed(1)}L •{" "}
											{config.probability}% probability
										</p>
									</CardHeader>
									<CardContent className="p-2">
										<ScrollArea className="h-[500px]">
											<div className="space-y-2 p-1">
												{stageOpps.length === 0 ? (
													<div className="p-4 text-center text-muted-foreground text-xs border-2 border-dashed rounded-lg">
														Drop opportunities here
													</div>
												) : (
													stageOpps.map((opp) => (
														<div
															key={opp.id}
															draggable
															onDragStart={(e) => handleDragStart(e, opp.id)}
															className="p-3 rounded-lg border bg-card hover:border-emerald-500 cursor-grab active:cursor-grabbing transition-colors"
															data-testid={`card-opportunity-${opp.id}`}
														>
															<div className="flex items-start justify-between gap-2">
																<div className="flex-1 min-w-0">
																	<p className="font-medium text-sm truncate">
																		{opp.name}
																	</p>
																	<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
																		<User className="h-3 w-3" />
																		Client ID: {opp.clientId.slice(0, 8)}...
																	</p>
																</div>
																<Badge
																	variant={
																		opp.priority === "urgent"
																			? "destructive"
																			: "outline"
																	}
																	className="text-xs capitalize"
																>
																	{opp.priority}
																</Badge>
															</div>

															<div className="flex items-center justify-between mt-3 pt-2 border-t">
																<div className="flex items-center gap-1 text-emerald-400">
																	<IndianRupee className="h-3 w-3" />
																	<span className="text-sm font-medium">
																		{(
																			Number(opp.expectedAmount || 0) / 100000
																		).toFixed(1)}
																		L
																	</span>
																</div>
																{opp.expectedCloseDate && (
																	<div className="flex items-center gap-1 text-xs text-muted-foreground">
																		<Calendar className="h-3 w-3" />
																		{format(
																			new Date(opp.expectedCloseDate),
																			"MMM d",
																		)}
																	</div>
																)}
															</div>

															<div className="flex items-center justify-between mt-2">
																<Badge
																	variant="secondary"
																	className="text-xs capitalize"
																>
																	{opp.productType?.replace(/_/g, " ")}
																</Badge>
																<Link href={`/crm/clients/${opp.clientId}`}>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-6 px-2"
																	>
																		<ChevronRight className="h-3 w-3" />
																	</Button>
																</Link>
															</div>
														</div>
													))
												)}
											</div>
										</ScrollArea>
									</CardContent>
								</Card>
							</div>
						);
					})}
				</div>
				<ScrollBar orientation="horizontal" />
			</ScrollArea>
		</div>
	);
}
