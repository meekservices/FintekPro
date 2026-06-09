import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
	Plus,
	Edit,
	Trash2,
	ShoppingCart,
	FileText,
	DollarSign,
	User,
	Search,
	Filter,
	Eye,
	CheckCircle,
	AlertCircle,
	Clock,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProposalItem {
	id: string;
	productType: "mutual_fund" | "equity" | "bond" | "ipo" | "insurance" | "loan";
	productId: string;
	productName: string;
	amount: number;
	units?: number;
	rate?: number;
	duration?: string;
	frequency?: string;
	notes?: string;
}

interface Proposal {
	id: string;
	clientId: string;
	clientName: string;
	clientEmail: string;
	title: string;
	description: string;
	status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
	totalAmount: number;
	validUntil: string;
	createdAt: string;
	updatedAt: string;
	items: ProposalItem[];
	advisorNotes?: string;
}

const statusColors = {
	draft: "bg-muted text-foreground",
	sent: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
	viewed:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	accepted:
		"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	expired: "bg-muted text-muted-foreground",
};

const statusIcons = {
	draft: Clock,
	sent: FileText,
	viewed: Eye,
	accepted: CheckCircle,
	rejected: AlertCircle,
	expired: AlertCircle,
};

export default function AdminProposalsPage() {
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
		null,
	);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
	const [newProposal, setNewProposal] = useState({
		clientId: "",
		title: "",
		description: "",
		validUntil: "",
		advisorNotes: "",
	});
	const { toast } = useToast();
	const queryClient = useQueryClient();

	// Fetch proposals
	const { data: proposals = [], isLoading } = useQuery({
		queryKey: ["/api/admin/proposals"],
		queryFn: async () => {
			const response = await apiRequest("GET", "/api/admin/proposals");
			return (await response.json()) as Proposal[];
		},
	});

	// Fetch clients for proposal creation
	const { data: clients = [] } = useQuery({
		queryKey: ["/api/admin/clients"],
		queryFn: async () => {
			const response = await apiRequest("GET", "/api/admin/clients");
			return (await response.json()) as Array<{
				id: string;
				name: string;
				email: string;
			}>;
		},
	});

	// Create proposal mutation
	const createProposalMutation = useMutation({
		mutationFn: async (proposalData: any) => {
			const response = await apiRequest("POST", "/api/admin/proposals", {
				body: proposalData,
			});
			return await response.json();
		},
		onSuccess: () => {
			toast({
				title: "Proposal created successfully",
				description:
					"The proposal has been created and can now have items added to it.",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals"] });
			setIsCreateDialogOpen(false);
			setNewProposal({
				clientId: "",
				title: "",
				description: "",
				validUntil: "",
				advisorNotes: "",
			});
		},
		onError: () => {
			toast({
				variant: "destructive",
				title: "Failed to create proposal",
				description: "Please check the information and try again.",
			});
		},
	});

	// Load proposal to cart mutation
	const loadToCartMutation = useMutation({
		mutationFn: async (proposalId: string) => {
			const response = await apiRequest(
				"POST",
				`/api/proposals/${proposalId}/load-to-cart`,
			);
			return await response.json();
		},
		onSuccess: (data, proposalId) => {
			const proposal = proposals.find((p) => p.id === proposalId);
			toast({
				title: "Proposal loaded to cart",
				description: `${proposal?.title} has been added to ${proposal?.clientName}'s cart.`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals"] });
		},
		onError: () => {
			toast({
				variant: "destructive",
				title: "Failed to load proposal",
				description: "Unable to load proposal to cart. Please try again.",
			});
		},
	});

	// Update proposal status mutation
	const updateStatusMutation = useMutation({
		mutationFn: async ({
			proposalId,
			status,
		}: { proposalId: string; status: string }) => {
			const response = await apiRequest(
				"PUT",
				`/api/admin/proposals/${proposalId}/status`,
				{ body: { status } },
			);
			return await response.json();
		},
		onSuccess: () => {
			toast({
				title: "Status updated",
				description: "Proposal status has been updated successfully.",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals"] });
		},
		onError: () => {
			toast({
				variant: "destructive",
				title: "Failed to update status",
				description: "Unable to update proposal status.",
			});
		},
	});

	// Delete proposal mutation
	const deleteProposalMutation = useMutation({
		mutationFn: async (proposalId: string) => {
			const response = await apiRequest(
				"DELETE",
				`/api/admin/proposals/${proposalId}`,
			);
			return await response.json();
		},
		onSuccess: () => {
			toast({
				title: "Proposal deleted",
				description: "The proposal has been permanently deleted.",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals"] });
		},
		onError: () => {
			toast({
				variant: "destructive",
				title: "Failed to delete proposal",
				description: "Unable to delete the proposal.",
			});
		},
	});

	// Filter proposals
	const filteredProposals = proposals.filter((proposal) => {
		const matchesSearch =
			proposal.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
			proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
			proposal.clientEmail.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus =
			statusFilter === "all" || proposal.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const handleCreateProposal = () => {
		if (!newProposal.clientId || !newProposal.title) {
			toast({
				variant: "destructive",
				title: "Missing information",
				description: "Please select a client and enter a title.",
			});
			return;
		}

		createProposalMutation.mutate({
			...newProposal,
			validUntil:
				newProposal.validUntil ||
				new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
					.toISOString()
					.split("T")[0],
		});
	};

	const handleLoadToCart = (proposalId: string) => {
		const proposal = proposals.find((p) => p.id === proposalId);
		if (!proposal) return;

		if (proposal.status !== "accepted") {
			toast({
				variant: "destructive",
				title: "Cannot load proposal",
				description: "Only accepted proposals can be loaded to cart.",
			});
			return;
		}

		loadToCartMutation.mutate(proposalId);
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
		}).format(amount);
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-IN");
	};

	return (
		<div className="container mx-auto py-8 px-4">
			<div className="flex justify-between items-center mb-8">
				<div>
					<h1 className="text-3xl font-bold mb-2">Client Proposals</h1>
					<p className="text-muted-foreground">
						Manage investment proposals for your clients
					</p>
				</div>
				<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
					<DialogTrigger asChild>
						<Button data-testid="button-create-proposal">
							<Plus className="h-4 w-4 mr-2" />
							Create Proposal
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Create New Proposal</DialogTitle>
							<DialogDescription>
								Create a new investment proposal for a client
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="clientId">Client *</Label>
								<Select
									value={newProposal.clientId}
									onValueChange={(value) =>
										setNewProposal((prev) => ({ ...prev, clientId: value }))
									}
								>
									<SelectTrigger data-testid="select-client">
										<SelectValue placeholder="Select a client" />
									</SelectTrigger>
									<SelectContent>
										{clients.map((client) => (
											<SelectItem key={client.id} value={client.id}>
												{client.name} - {client.email}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="title">Title *</Label>
								<Input
									id="title"
									value={newProposal.title}
									onChange={(e) =>
										setNewProposal((prev) => ({
											...prev,
											title: e.target.value,
										}))
									}
									placeholder="Enter proposal title"
									data-testid="input-proposal-title"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									value={newProposal.description}
									onChange={(e) =>
										setNewProposal((prev) => ({
											...prev,
											description: e.target.value,
										}))
									}
									placeholder="Enter proposal description"
									data-testid="textarea-proposal-description"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="validUntil">Valid Until</Label>
								<Input
									id="validUntil"
									type="date"
									value={newProposal.validUntil}
									onChange={(e) =>
										setNewProposal((prev) => ({
											...prev,
											validUntil: e.target.value,
										}))
									}
									data-testid="input-valid-until"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="advisorNotes">Advisor Notes</Label>
								<Textarea
									id="advisorNotes"
									value={newProposal.advisorNotes}
									onChange={(e) =>
										setNewProposal((prev) => ({
											...prev,
											advisorNotes: e.target.value,
										}))
									}
									placeholder="Internal notes (not visible to client)"
									data-testid="textarea-advisor-notes"
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setIsCreateDialogOpen(false)}
								data-testid="button-cancel-proposal"
							>
								Cancel
							</Button>
							<Button
								onClick={handleCreateProposal}
								disabled={createProposalMutation.isPending}
								data-testid="button-save-proposal"
							>
								{createProposalMutation.isPending
									? "Creating..."
									: "Create Proposal"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* Filters */}
			<Card className="mb-6">
				<CardContent className="pt-6">
					<div className="flex flex-col sm:flex-row gap-4">
						<div className="flex-1">
							<Label htmlFor="search">Search</Label>
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									id="search"
									placeholder="Search by client name, email, or title..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-10"
									data-testid="input-search-proposals"
								/>
							</div>
						</div>
						<div className="w-full sm:w-48">
							<Label htmlFor="status">Status Filter</Label>
							<Select value={statusFilter} onValueChange={setStatusFilter}>
								<SelectTrigger data-testid="select-status-filter">
									<SelectValue placeholder="All statuses" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Statuses</SelectItem>
									<SelectItem value="draft">Draft</SelectItem>
									<SelectItem value="sent">Sent</SelectItem>
									<SelectItem value="viewed">Viewed</SelectItem>
									<SelectItem value="accepted">Accepted</SelectItem>
									<SelectItem value="rejected">Rejected</SelectItem>
									<SelectItem value="expired">Expired</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Proposals Table */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Proposals ({filteredProposals.length})
					</CardTitle>
					<CardDescription>
						Manage and track all client investment proposals
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-muted-foreground">Loading proposals...</div>
						</div>
					) : filteredProposals.length === 0 ? (
						<div className="text-center py-8">
							<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
							<h3 className="text-lg font-semibold mb-2">No proposals found</h3>
							<p className="text-muted-foreground mb-4">
								{searchTerm || statusFilter !== "all"
									? "No proposals match your current filters."
									: "Create your first proposal to get started."}
							</p>
						</div>
					) : (
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Client</TableHead>
										<TableHead>Title</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Amount</TableHead>
										<TableHead>Items</TableHead>
										<TableHead>Valid Until</TableHead>
										<TableHead>Created</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredProposals.map((proposal) => {
										const StatusIcon = statusIcons[proposal.status];
										return (
											<TableRow
												key={proposal.id}
												data-testid={`row-proposal-${proposal.id}`}
											>
												<TableCell>
													<div>
														<div className="font-medium">
															{proposal.clientName}
														</div>
														<div className="text-sm text-muted-foreground">
															{proposal.clientEmail}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<div>
														<div className="font-medium">{proposal.title}</div>
														{proposal.description && (
															<div className="text-sm text-muted-foreground truncate max-w-xs">
																{proposal.description}
															</div>
														)}
													</div>
												</TableCell>
												<TableCell>
													<Badge
														className={statusColors[proposal.status]}
														variant="secondary"
													>
														<StatusIcon className="h-3 w-3 mr-1" />
														{(proposal.status || "pending")
															.charAt(0)
															.toUpperCase() +
															(proposal.status || "pending").slice(1)}
													</Badge>
												</TableCell>
												<TableCell>
													<span className="font-medium">
														{formatCurrency(proposal.totalAmount)}
													</span>
												</TableCell>
												<TableCell>
													<span className="text-sm">
														{proposal.items.length} items
													</span>
												</TableCell>
												<TableCell>
													<span className="text-sm">
														{formatDate(proposal.validUntil)}
													</span>
												</TableCell>
												<TableCell>
													<span className="text-sm">
														{formatDate(proposal.createdAt)}
													</span>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Button
															variant="outline"
															size="sm"
															onClick={() => {
																setSelectedProposal(proposal);
																setIsViewDialogOpen(true);
															}}
															data-testid={`button-view-${proposal.id}`}
														>
															<Eye className="h-4 w-4" />
														</Button>
														{proposal.status === "accepted" && (
															<Button
																variant="outline"
																size="sm"
																onClick={() => handleLoadToCart(proposal.id)}
																disabled={loadToCartMutation.isPending}
																data-testid={`button-load-cart-${proposal.id}`}
															>
																<ShoppingCart className="h-4 w-4" />
															</Button>
														)}
														<Select
															value={proposal.status}
															onValueChange={(status) =>
																updateStatusMutation.mutate({
																	proposalId: proposal.id,
																	status,
																})
															}
														>
															<SelectTrigger
																className="h-8 w-20"
																data-testid={`select-status-${proposal.id}`}
															>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="draft">Draft</SelectItem>
																<SelectItem value="sent">Sent</SelectItem>
																<SelectItem value="viewed">Viewed</SelectItem>
																<SelectItem value="accepted">
																	Accepted
																</SelectItem>
																<SelectItem value="rejected">
																	Rejected
																</SelectItem>
																<SelectItem value="expired">Expired</SelectItem>
															</SelectContent>
														</Select>
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																deleteProposalMutation.mutate(proposal.id)
															}
															disabled={deleteProposalMutation.isPending}
															className="text-destructive hover:text-destructive"
															data-testid={`button-delete-${proposal.id}`}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* View Proposal Dialog */}
			<Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							{selectedProposal?.title}
						</DialogTitle>
						<DialogDescription>
							Proposal for {selectedProposal?.clientName}
						</DialogDescription>
					</DialogHeader>
					{selectedProposal && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-sm font-medium">Client</Label>
									<p className="text-sm">{selectedProposal.clientName}</p>
									<p className="text-xs text-muted-foreground">
										{selectedProposal.clientEmail}
									</p>
								</div>
								<div>
									<Label className="text-sm font-medium">Status</Label>
									<div className="mt-1">
										<Badge
											className={statusColors[selectedProposal.status]}
											variant="secondary"
										>
											{(selectedProposal.status || "pending")
												.charAt(0)
												.toUpperCase() +
												(selectedProposal.status || "pending").slice(1)}
										</Badge>
									</div>
								</div>
							</div>

							{selectedProposal.description && (
								<div>
									<Label className="text-sm font-medium">Description</Label>
									<p className="text-sm mt-1">{selectedProposal.description}</p>
								</div>
							)}

							<div className="grid grid-cols-3 gap-4">
								<div>
									<Label className="text-sm font-medium">Total Amount</Label>
									<p className="text-lg font-semibold">
										{formatCurrency(selectedProposal.totalAmount)}
									</p>
								</div>
								<div>
									<Label className="text-sm font-medium">Valid Until</Label>
									<p className="text-sm">
										{formatDate(selectedProposal.validUntil)}
									</p>
								</div>
								<div>
									<Label className="text-sm font-medium">Created</Label>
									<p className="text-sm">
										{formatDate(selectedProposal.createdAt)}
									</p>
								</div>
							</div>

							<div>
								<Label className="text-sm font-medium mb-2 block">
									Proposal Items ({selectedProposal.items.length})
								</Label>
								<div className="rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Product</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Amount</TableHead>
												<TableHead>Details</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{selectedProposal.items.map((item, index) => (
												<TableRow key={index}>
													<TableCell>{item.productName}</TableCell>
													<TableCell>
														<Badge variant="outline">
															{(item.productType || "other")
																.replace("_", " ")
																.toUpperCase()}
														</Badge>
													</TableCell>
													<TableCell>{formatCurrency(item.amount)}</TableCell>
													<TableCell>
														<div className="text-xs text-muted-foreground">
															{item.units && <div>Units: {item.units}</div>}
															{item.rate && <div>Rate: {item.rate}%</div>}
															{item.duration && (
																<div>Duration: {item.duration}</div>
															)}
															{item.frequency && (
																<div>Frequency: {item.frequency}</div>
															)}
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							</div>

							{selectedProposal.advisorNotes && (
								<div>
									<Label className="text-sm font-medium">Advisor Notes</Label>
									<p className="text-sm mt-1 p-3 bg-muted rounded-md">
										{selectedProposal.advisorNotes}
									</p>
								</div>
							)}
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsViewDialogOpen(false)}
						>
							Close
						</Button>
						{selectedProposal?.status === "accepted" && (
							<Button
								onClick={() => {
									handleLoadToCart(selectedProposal.id);
									setIsViewDialogOpen(false);
								}}
								disabled={loadToCartMutation.isPending}
							>
								<ShoppingCart className="h-4 w-4 mr-2" />
								Load to Cart
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
