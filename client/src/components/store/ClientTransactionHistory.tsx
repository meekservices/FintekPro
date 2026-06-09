import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { format } from "date-fns";
import {
	Receipt,
	TrendingUp,
	ShoppingCart,
	FileText,
	CheckCircle,
	XCircle,
	Clock,
	ChevronRight,
	Filter,
	Download,
	IndianRupee,
} from "lucide-react";

interface Transaction {
	id: string;
	transactionId: string;
	transactionType: string;
	productCategory: string;
	productName?: string;
	amount?: string;
	quantity?: number;
	status: string;
	source: string;
	createdAt: string;
	completedAt?: string;
}

interface TransactionSummary {
	category: string;
	totalAmount: string;
	count: number;
}

interface ClientTransactionHistoryProps {
	category?: string;
	showFilters?: boolean;
	limit?: number;
	compact?: boolean;
}

const categoryLabels: Record<string, string> = {
	mutual_fund: "Mutual Funds",
	bond: "Bonds",
	mld: "MLDs",
	unlisted: "Unlisted Shares",
	aif: "AIF",
	pms: "PMS",
	ipo: "IPO",
	insurance: "Insurance",
	loan: "Loans",
};

const transactionTypeIcons: Record<string, any> = {
	purchase: ShoppingCart,
	cart_add: ShoppingCart,
	checkout: Receipt,
	payment: IndianRupee,
	proposal_accept: CheckCircle,
	proposal_reject: XCircle,
	inquiry: FileText,
};

const statusColors: Record<string, string> = {
	completed:
		"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	pending:
		"bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
	cancelled: "bg-muted text-muted-foreground",
};

export function ClientTransactionHistory({
	category,
	showFilters = true,
	limit = 20,
	compact = false,
}: ClientTransactionHistoryProps) {
	const [selectedCategory, setSelectedCategory] = useState(category || "all");
	const [page, setPage] = useState(0);

	const { data: transactionsData, isLoading } = useQuery<{
		success: boolean;
		transactions: Transaction[];
		total: number;
		hasMore: boolean;
	}>({
		queryKey: ["/api/client/transactions", selectedCategory, page, limit],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (selectedCategory && selectedCategory !== "all")
				params.append("category", selectedCategory);
			params.append("limit", limit.toString());
			params.append("offset", (page * limit).toString());

			const response = await fetch(`/api/client/transactions?${params}`, {
				credentials: "include",
			});
			if (!response.ok) throw new Error("Failed to fetch transactions");
			return response.json();
		},
	});

	const { data: summaryData } = useQuery<{
		success: boolean;
		summary: TransactionSummary[];
	}>({
		queryKey: ["/api/client/transactions/summary"],
	});

	const transactions = transactionsData?.transactions || [];
	const summary = summaryData?.summary || [];

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent className="space-y-3">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-16 w-full" />
					))}
				</CardContent>
			</Card>
		);
	}

	const formatAmount = (amount?: string) => {
		if (!amount) return "-";
		const num = Number.parseFloat(amount);
		if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
		if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
		return `₹${num.toLocaleString("en-IN")}`;
	};

	const renderTransactionRow = (tx: Transaction) => {
		const Icon = transactionTypeIcons[tx.transactionType] || Receipt;

		return (
			<div
				key={tx.id}
				className={`flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors ${compact ? "py-2" : ""}`}
				data-testid={`transaction-${tx.id}`}
			>
				<div className="flex items-center gap-3 flex-1 min-w-0">
					<div className="p-2 rounded-full bg-primary/10">
						<Icon className="h-4 w-4 text-primary" />
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm truncate">
								{tx.productName ||
									categoryLabels[tx.productCategory] ||
									tx.productCategory}
							</span>
							<Badge variant="outline" className="text-xs">
								{tx.transactionType.replace(/_/g, " ")}
							</Badge>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span>
								{format(new Date(tx.createdAt), "dd MMM yyyy, hh:mm a")}
							</span>
							<span>•</span>
							<span className="uppercase">{tx.transactionId}</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3 ml-3">
					<div className="text-right">
						<div className="font-semibold text-sm">
							{formatAmount(tx.amount)}
						</div>
						{tx.quantity && (
							<div className="text-xs text-muted-foreground">
								{tx.quantity} units
							</div>
						)}
					</div>
					<Badge className={statusColors[tx.status] || statusColors.pending}>
						{tx.status}
					</Badge>
				</div>
			</div>
		);
	};

	return (
		<Card>
			<CardHeader className={compact ? "pb-2" : ""}>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Receipt className="h-5 w-5 text-primary" />
							{category
								? `${categoryLabels[category] || category} Transactions`
								: "Transaction History"}
						</CardTitle>
						{!compact && (
							<CardDescription>
								All your investment transactions and activities
							</CardDescription>
						)}
					</div>
					{showFilters && !category && (
						<Select
							value={selectedCategory}
							onValueChange={setSelectedCategory}
						>
							<SelectTrigger
								className="w-[180px]"
								data-testid="category-filter"
							>
								<Filter className="h-4 w-4 mr-2" />
								<SelectValue placeholder="All Categories" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Categories</SelectItem>
								{Object.entries(categoryLabels).map(([key, label]) => (
									<SelectItem key={key} value={key}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>

				{!compact && summary.length > 0 && (
					<div className="flex flex-wrap gap-2 mt-3">
						{summary.map((s) => (
							<Badge key={s.category} variant="secondary" className="py-1 px-2">
								{categoryLabels[s.category] || s.category}:{" "}
								{formatAmount(s.totalAmount)} ({s.count})
							</Badge>
						))}
					</div>
				)}
			</CardHeader>

			<CardContent>
				{transactions.length === 0 ? (
					<div className="text-center py-8 text-muted-foreground">
						<Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
						<p>No transactions found</p>
						<p className="text-sm">Your transaction history will appear here</p>
					</div>
				) : (
					<>
						<ScrollArea className={compact ? "h-[300px]" : "h-[400px]"}>
							<div className="space-y-2 pr-4">
								{transactions.map(renderTransactionRow)}
							</div>
						</ScrollArea>

						{transactionsData?.hasMore && (
							<div className="flex justify-center mt-4">
								<Button
									variant="outline"
									onClick={() => setPage((p) => p + 1)}
									data-testid="load-more-transactions"
								>
									Load More
									<ChevronRight className="h-4 w-4 ml-1" />
								</Button>
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
