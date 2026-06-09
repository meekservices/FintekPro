import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
	Brain,
	User,
	FileText,
	CheckCircle,
	ShoppingCart,
	ChevronRight,
	Loader2,
	AlertCircle,
} from "lucide-react";

type ProposalSource =
	| "ai_rebalancing"
	| "ai_retirement"
	| "ai_goals"
	| "agent"
	| "self";

interface CategoryProposalItem {
	id: string;
	productType: string;
	productName: string;
	amount: number;
	actionType?: string;
	status: string;
}

interface CategoryProposal {
	id: string;
	title: string;
	proposalSource: ProposalSource;
	status: string;
	createdAt: string;
	addedToCart: boolean;
	items: CategoryProposalItem[];
	categoryTotal: number;
}

interface CategoryProposalSectionProps {
	category:
		| "mutual_fund"
		| "equity"
		| "bond"
		| "ipo"
		| "unlisted"
		| "insurance"
		| "loan"
		| "aif"
		| "pms";
	title?: string;
	showViewAll?: boolean;
}

const sourceConfig: Record<
	ProposalSource,
	{ label: string; icon: any; color: string }
> = {
	ai_rebalancing: {
		label: "AI",
		icon: Brain,
		color:
			"bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
	},
	ai_retirement: {
		label: "AI Retirement",
		icon: Brain,
		color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	},
	ai_goals: {
		label: "AI Goals",
		icon: Brain,
		color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	},
	agent: {
		label: "Agent",
		icon: User,
		color:
			"bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
	},
	self: {
		label: "Self",
		icon: FileText,
		color: "bg-muted text-muted-foreground",
	},
};

const categoryLabels: Record<string, string> = {
	mutual_fund: "Mutual Funds",
	equity: "Equities",
	bond: "Bonds",
	ipo: "IPO",
	unlisted: "Unlisted Shares",
	insurance: "Insurance",
	loan: "Loans",
	aif: "AIF",
	pms: "PMS",
};

export default function CategoryProposalSection({
	category,
	title,
	showViewAll = true,
}: CategoryProposalSectionProps) {
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const { data: proposals = [], isLoading } = useQuery({
		queryKey: ["/api/unified-proposals/by-category", category],
		queryFn: async () => {
			const response = await fetch(
				`/api/unified-proposals/by-category/${category}`,
				{ credentials: "include" },
			);
			if (!response.ok) return [];
			return response.json() as Promise<CategoryProposal[]>;
		},
	});

	const addToCartMutation = useMutation({
		mutationFn: async (proposalId: string) => {
			const response = await apiRequest(
				"POST",
				`/api/unified-proposals/${proposalId}/add-to-cart`,
				{ orderType: "LUMPSUM" },
			);
			return response.json();
		},
		onSuccess: () => {
			toast({ title: "Added to cart" });
			queryClient.invalidateQueries({
				queryKey: ["/api/unified-proposals/by-category", category],
			});
			queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
		},
		onError: () => {
			toast({ variant: "destructive", title: "Failed to add to cart" });
		},
	});

	const acceptProposalMutation = useMutation({
		mutationFn: async (proposalId: string) => {
			const response = await apiRequest(
				"PUT",
				`/api/unified-proposals/${proposalId}/accept`,
			);
			return response.json();
		},
		onSuccess: () => {
			toast({ title: "Proposal accepted" });
			queryClient.invalidateQueries({
				queryKey: ["/api/unified-proposals/by-category", category],
			});
		},
		onError: () => {
			toast({ variant: "destructive", title: "Failed to accept proposal" });
		},
	});

	const pendingProposals = proposals.filter((p) =>
		["sent", "pending_review", "viewed"].includes(p.status),
	);
	const acceptedProposals = proposals.filter(
		(p) => p.status === "accepted" && !p.addedToCart,
	);

	if (isLoading) {
		return (
			<Card className="border-dashed">
				<CardHeader className="pb-3">
					<Skeleton className="h-5 w-40" />
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (proposals.length === 0) {
		return null;
	}

	const renderSourceBadge = (source: ProposalSource) => {
		const config = sourceConfig[source];
		const Icon = config.icon;
		return (
			<Badge
				variant="outline"
				className={`${config.color} flex items-center gap-1 text-xs`}
			>
				<Icon className="h-3 w-3" />
				{config.label}
			</Badge>
		);
	};

	return (
		<Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-lg flex items-center gap-2">
							<FileText className="h-5 w-5 text-primary" />
							{title || `${categoryLabels[category]} Proposals`}
						</CardTitle>
						<CardDescription>
							{pendingProposals.length} pending, {acceptedProposals.length}{" "}
							ready for cart
						</CardDescription>
					</div>
					{showViewAll && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate("/my-proposals")}
							data-testid="view-all-proposals"
						>
							View All
							<ChevronRight className="h-4 w-4 ml-1" />
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{proposals.slice(0, 3).map((proposal) => {
					const isPending = ["sent", "pending_review", "viewed"].includes(
						proposal.status,
					);
					const canAddToCart =
						proposal.status === "accepted" && !proposal.addedToCart;

					return (
						<div
							key={proposal.id}
							className="flex items-center justify-between p-3 bg-background rounded-lg border"
							data-testid={`category-proposal-${proposal.id}`}
						>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 mb-1">
									<span className="font-medium text-sm truncate">
										{proposal.title}
									</span>
									{renderSourceBadge(proposal.proposalSource)}
								</div>
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span>{proposal.items.length} items</span>
									<span>₹{proposal.categoryTotal.toLocaleString("en-IN")}</span>
								</div>
							</div>

							<div className="flex items-center gap-2 ml-3">
								{isPending && (
									<Button
										size="sm"
										variant="outline"
										onClick={() => acceptProposalMutation.mutate(proposal.id)}
										disabled={acceptProposalMutation.isPending}
										data-testid={`accept-category-proposal-${proposal.id}`}
									>
										{acceptProposalMutation.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<CheckCircle className="h-4 w-4" />
										)}
									</Button>
								)}

								{canAddToCart && (
									<Button
										size="sm"
										className="bg-green-600 hover:bg-green-700"
										onClick={() => addToCartMutation.mutate(proposal.id)}
										disabled={addToCartMutation.isPending}
										data-testid={`add-to-cart-category-${proposal.id}`}
									>
										{addToCartMutation.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<ShoppingCart className="h-4 w-4" />
										)}
									</Button>
								)}

								{proposal.addedToCart && (
									<Badge variant="secondary" className="text-xs">
										In Cart
									</Badge>
								)}
							</div>
						</div>
					);
				})}

				{proposals.length > 3 && (
					<Button
						variant="ghost"
						className="w-full text-sm"
						onClick={() => navigate("/my-proposals")}
					>
						+{proposals.length - 3} more proposals
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
