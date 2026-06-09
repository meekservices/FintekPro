import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/LoadingState";
import { Link } from "wouter";
import { format } from "date-fns";
import {
	Search,
	FileText,
	ArrowLeft,
	RefreshCw,
	Filter,
	Calendar,
	User,
	Building2,
	Activity,
	Clock,
	Loader2,
	CheckCircle,
	XCircle,
	AlertTriangle,
	Edit,
	DollarSign,
	Ban,
	Play,
	Eye,
} from "lucide-react";

interface AuditEntry {
	id: string;
	action: string;
	userId?: string;
	userName?: string;
	companyId?: string;
	companyName?: string;
	timestamp: string;
	details?: Record<string, any>;
	ipAddress?: string;
}

interface AuditLogResponse {
	entries: AuditEntry[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

const actionConfig: Record<
	string,
	{ label: string; icon: any; color: string }
> = {
	price_published: {
		label: "Price Published",
		icon: DollarSign,
		color: "text-green-400",
	},
	price_draft_saved: {
		label: "Draft Saved",
		icon: Edit,
		color: "text-blue-400",
	},
	trading_suspended: {
		label: "Trading Suspended",
		icon: Ban,
		color: "text-red-400",
	},
	trading_resumed: {
		label: "Trading Resumed",
		icon: Play,
		color: "text-green-400",
	},
	company_created: {
		label: "Company Created",
		icon: Building2,
		color: "text-blue-400",
	},
	company_updated: {
		label: "Company Updated",
		icon: Edit,
		color: "text-yellow-400",
	},
	company_deleted: {
		label: "Company Deleted",
		icon: XCircle,
		color: "text-red-400",
	},
	listing_approved: {
		label: "Listing Approved",
		icon: CheckCircle,
		color: "text-green-400",
	},
	listing_rejected: {
		label: "Listing Rejected",
		icon: XCircle,
		color: "text-red-400",
	},
	buy_request_approved: {
		label: "Buy Request Approved",
		icon: CheckCircle,
		color: "text-green-400",
	},
	buy_request_rejected: {
		label: "Buy Request Rejected",
		icon: XCircle,
		color: "text-red-400",
	},
	deal_matched: {
		label: "Deal Matched",
		icon: Activity,
		color: "text-purple-400",
	},
	deal_completed: {
		label: "Deal Completed",
		icon: CheckCircle,
		color: "text-green-400",
	},
	compliance_check: {
		label: "Compliance Check",
		icon: AlertTriangle,
		color: "text-yellow-400",
	},
};

const getActionConfig = (action: string) => {
	return (
		actionConfig[action] || {
			label: action,
			icon: Activity,
			color: "text-muted-foreground",
		}
	);
};

export default function UnlistedAuditLog() {
	const { user, isLoading: authLoading } = useAuth();
	const [searchQuery, setSearchQuery] = useState("");
	const [actionFilter, setActionFilter] = useState("all");
	const [page, setPage] = useState(1);

	const {
		data: responseData,
		isLoading,
		refetch,
	} = useQuery<{ success: boolean; data: AuditLogResponse }>({
		queryKey: ["/api/unlisted/admin/audit-log", page, actionFilter],
		queryFn: async () => {
			const params = new URLSearchParams();
			params.set("page", page.toString());
			if (actionFilter !== "all") {
				params.set("actionType", actionFilter);
			}
			const response = await fetch(
				`/api/unlisted/admin/audit-log?${params.toString()}`,
				{ credentials: "include" },
			);
			if (!response.ok) throw new Error("Failed to fetch audit log");
			return response.json();
		},
	});
	const data = responseData?.data;

	if (authLoading) {
		return <LoadingState />;
	}

	if (!user || !user.roles?.includes("admin")) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-background">
				<Card className="bg-card border-border max-w-md">
					<CardHeader>
						<CardTitle className="text-foreground text-center">
							Access Denied
						</CardTitle>
						<CardDescription className="text-muted-foreground text-center">
							Admin privileges required to access this page.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	const filteredEntries = (data?.entries || []).filter((entry) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			entry.userName?.toLowerCase().includes(query) ||
			entry.companyName?.toLowerCase().includes(query) ||
			entry.action.toLowerCase().includes(query) ||
			entry.id.toLowerCase().includes(query)
		);
	});

	return (
		<div className="space-y-6 p-6">
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-4">
					<Link href="/admin/unlisted/dashboard">
						<Button
							variant="ghost"
							size="sm"
							data-testid="button-back-dashboard"
						>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Dashboard
						</Button>
					</Link>
					<div>
						<h1 className="text-3xl font-bold text-foreground">Audit Log</h1>
						<p className="text-muted-foreground mt-1">
							Track all marketplace activities and changes
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					onClick={() => refetch()}
					className="border-border"
					data-testid="button-refresh-audit"
				>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			<Card className="bg-card border-border">
				<CardHeader>
					<div className="flex flex-col md:flex-row gap-4 justify-between">
						<div className="flex gap-2 flex-1">
							<div className="relative flex-1 max-w-md">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search by user, company, or action..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9 bg-muted border-border"
									data-testid="input-search-audit"
								/>
							</div>
							<Select value={actionFilter} onValueChange={setActionFilter}>
								<SelectTrigger
									className="w-[180px] bg-muted border-border"
									data-testid="select-action-filter"
								>
									<SelectValue placeholder="Action Type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Actions</SelectItem>
									<SelectItem value="price_published">
										Price Published
									</SelectItem>
									<SelectItem value="price_draft_saved">Draft Saved</SelectItem>
									<SelectItem value="trading_suspended">
										Trading Suspended
									</SelectItem>
									<SelectItem value="trading_resumed">
										Trading Resumed
									</SelectItem>
									<SelectItem value="company_created">
										Company Created
									</SelectItem>
									<SelectItem value="company_updated">
										Company Updated
									</SelectItem>
									<SelectItem value="listing_approved">
										Listing Approved
									</SelectItem>
									<SelectItem value="listing_rejected">
										Listing Rejected
									</SelectItem>
									<SelectItem value="deal_matched">Deal Matched</SelectItem>
									<SelectItem value="compliance_check">
										Compliance Check
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="text-sm text-muted-foreground">
							{data?.pagination.total || 0} total entries
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : filteredEntries.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
							<p>No audit entries found</p>
						</div>
					) : (
						<div className="space-y-3">
							{filteredEntries.map((entry) => {
								const config = getActionConfig(entry.action);
								const Icon = config.icon;

								return (
									<div
										key={entry.id}
										className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
										data-testid={`audit-entry-${entry.id}`}
									>
										<div
											className={`p-2 rounded-full bg-muted/50 ${config.color}`}
										>
											<Icon className="h-5 w-5" />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<span className={`font-medium ${config.color}`}>
													{config.label}
												</span>
												{entry.companyName && (
													<>
														<span className="text-muted-foreground">•</span>
														<span className="text-foreground">
															{entry.companyName}
														</span>
													</>
												)}
											</div>
											<div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
												{entry.userName && (
													<span className="flex items-center gap-1">
														<User className="h-3 w-3" />
														{entry.userName}
													</span>
												)}
												<span className="flex items-center gap-1">
													<Clock className="h-3 w-3" />
													{format(
														new Date(entry.timestamp),
														"MMM d, yyyy HH:mm",
													)}
												</span>
												{entry.ipAddress && (
													<span className="text-muted-foreground">
														{entry.ipAddress}
													</span>
												)}
											</div>
											{entry.details &&
												Object.keys(entry.details).length > 0 && (
													<div className="mt-2 p-2 rounded bg-card text-xs font-mono text-muted-foreground">
														{Object.entries(entry.details).map(
															([key, value]) => (
																<div key={key}>
																	<span className="text-muted-foreground">
																		{key}:
																	</span>{" "}
																	<span className="text-muted-foreground">
																		{JSON.stringify(value)}
																	</span>
																</div>
															),
														)}
													</div>
												)}
										</div>
										{entry.companyId && (
											<Link href={`/admin/unlisted/preview/${entry.companyId}`}>
												<Button
													variant="ghost"
													size="sm"
													data-testid={`button-view-${entry.id}`}
												>
													<Eye className="h-4 w-4" />
												</Button>
											</Link>
										)}
									</div>
								);
							})}
						</div>
					)}

					{data && data.pagination.totalPages > 1 && (
						<div className="flex justify-center gap-2 mt-6">
							<Button
								variant="outline"
								size="sm"
								disabled={page === 1}
								onClick={() => setPage((p) => p - 1)}
								className="border-border"
								data-testid="button-prev-page"
							>
								Previous
							</Button>
							<span className="flex items-center px-4 text-sm text-muted-foreground">
								Page {page} of {data.pagination.totalPages}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={page === data.pagination.totalPages}
								onClick={() => setPage((p) => p + 1)}
								className="border-border"
								data-testid="button-next-page"
							>
								Next
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
