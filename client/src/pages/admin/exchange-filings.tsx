import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { format } from "date-fns";
import {
	Search,
	FileText,
	ArrowLeft,
	RefreshCw,
	Filter,
	Calendar,
	Building2,
	Clock,
	Loader2,
	CheckCircle,
	XCircle,
	AlertTriangle,
	ExternalLink,
	Play,
	Eye,
	Edit,
	Shield as LucideShield,
	Database,
	BarChart3,
	Download,
} from "lucide-react";

interface Filing {
	id: string;
	exchange: string;
	symbol: string;
	company_name: string;
	filing_type: string;
	financial_type: string;
	document_url: string;
	document_hash: string;
	filing_date: string;
	financial_year: string;
	quarter: string;
	document_type: string;
	processing_status: string;
	extraction_confidence: number;
	ingested_at: string;
}

interface FilingsResponse {
	filings: Filing[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

interface FilingStats {
	total: number;
	pending: number;
	completed: number;
	failed: number;
	byExchange: { nse: number; bse: number };
}

interface ExtractedMetric {
	id: string;
	metric: string;
	metric_value: string;
	extraction_confidence: number;
	extraction_method: string;
	extraction_source: string;
	is_approved: boolean;
	is_manual_override: boolean;
	override_reason?: string;
}

interface FilingDetail {
	filing: Filing;
	extractedMetrics: ExtractedMetric[];
	viewOriginalUrl: string;
	documentHash: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
	pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400" },
	processing: { label: "Processing", color: "bg-blue-500/20 text-blue-400" },
	completed: { label: "Completed", color: "bg-green-500/20 text-green-400" },
	failed: { label: "Failed", color: "bg-red-500/20 text-red-400" },
	needs_review: {
		label: "Needs Review",
		color: "bg-orange-500/20 text-orange-400",
	},
};

export default function ExchangeFilingsAdmin() {
	const { user, isLoading: authLoading } = useAuth();
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");
	const [exchangeFilter, setExchangeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [selectedFiling, setSelectedFiling] = useState<string | null>(null);
	const [approvalJustification, setApprovalJustification] = useState("");
	const [overrideValue, setOverrideValue] = useState("");
	const [overrideReason, setOverrideReason] = useState("");
	const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

	const { data: statsData, isLoading: statsLoading } = useQuery<{
		success: boolean;
		data: FilingStats;
	}>({
		queryKey: ["/api/admin/exchange-filings/stats"],
	});

	const {
		data: filingsData,
		isLoading: filingsLoading,
		refetch,
	} = useQuery<{ success: boolean; data: FilingsResponse }>({
		queryKey: [
			"/api/admin/exchange-filings/list",
			{
				page,
				exchange: exchangeFilter !== "all" ? exchangeFilter : undefined,
				status: statusFilter !== "all" ? statusFilter : undefined,
				symbol: searchQuery || undefined,
			},
		],
	});

	const { data: filingDetail, isLoading: detailLoading } = useQuery<{
		success: boolean;
		data: FilingDetail;
	}>({
		queryKey: ["/api/admin/exchange-filings", selectedFiling],
		enabled: !!selectedFiling,
	});

	const fetchMutation = useMutation({
		mutationFn: async (params: {
			exchange?: string;
			fromDate?: string;
			toDate?: string;
		}) => {
			return apiRequest("/api/admin/exchange-filings/fetch", {
				method: "POST",
				body: JSON.stringify(params),
			});
		},
		onSuccess: (data: any) => {
			toast({
				title: "Fetch Complete",
				description: `Processed ${data.data?.filingsProcessed || 0} filings, ${data.data?.newFilings || 0} new.`,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/exchange-filings"],
			});
			refetch();
		},
		onError: (error: any) => {
			toast({
				title: "Fetch Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const processMutation = useMutation({
		mutationFn: async (filingId: string) => {
			return apiRequest(`/api/admin/exchange-filings/${filingId}/process`, {
				method: "POST",
			});
		},
		onSuccess: (data: any) => {
			toast({
				title: "Processing Complete",
				description: `Extracted ${data.data?.metricsExtracted || 0} metrics with ${((data.data?.confidence || 0) * 100).toFixed(1)}% confidence.`,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/exchange-filings"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Processing Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const approveMutation = useMutation({
		mutationFn: async ({
			filingId,
			metricId,
			justification,
		}: { filingId: string; metricId: string; justification: string }) => {
			return apiRequest(
				`/api/admin/exchange-filings/${filingId}/metrics/${metricId}/approve`,
				{
					method: "POST",
					body: JSON.stringify({
						approvedBy: user?.email || "admin",
						justification,
					}),
				},
			);
		},
		onSuccess: () => {
			toast({
				title: "Metric Approved",
				description: "The metric value has been approved for use.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/exchange-filings", selectedFiling],
			});
			setApprovalJustification("");
		},
	});

	const overrideMutation = useMutation({
		mutationFn: async ({
			filingId,
			metricId,
			newValue,
			reason,
		}: {
			filingId: string;
			metricId: string;
			newValue: string;
			reason: string;
		}) => {
			return apiRequest(
				`/api/admin/exchange-filings/${filingId}/metrics/${metricId}/override`,
				{
					method: "POST",
					body: JSON.stringify({
						newValue,
						overrideBy: user?.email || "admin",
						reason,
					}),
				},
			);
		},
		onSuccess: () => {
			toast({
				title: "Metric Overridden",
				description: "The metric value has been overridden with audit trail.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/exchange-filings", selectedFiling],
			});
			setOverrideValue("");
			setOverrideReason("");
		},
	});

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

	const stats = statsData?.data;
	const filings = filingsData?.data?.filings || [];
	const pagination = filingsData?.data?.pagination;
	const detail = filingDetail?.data;

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<div
					className="flex items-center justify-between"
					data-testid="header-section"
				>
					<div className="flex items-center gap-4">
						<Link href="/admin">
							<Button variant="ghost" size="icon" data-testid="button-back">
								<ArrowLeft className="h-5 w-5" />
							</Button>
						</Link>
						<div>
							<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
								<Database className="h-6 w-6" />
								Exchange Filings Management
							</h1>
							<p className="text-muted-foreground">
								NSE/BSE filings ingestion and data extraction with SEBI
								compliance
							</p>
						</div>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => fetchMutation.mutate({})}
							disabled={fetchMutation.isPending}
							data-testid="button-fetch-filings"
						>
							{fetchMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Download className="h-4 w-4 mr-2" />
							)}
							Fetch New Filings
						</Button>
						<Button
							variant="ghost"
							onClick={() => refetch()}
							data-testid="button-refresh"
						>
							<RefreshCw className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div
					className="grid grid-cols-1 md:grid-cols-5 gap-4"
					data-testid="stats-section"
				>
					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-muted-foreground text-sm">Total Filings</p>
									<p className="text-2xl font-bold text-foreground">
										{stats?.total || 0}
									</p>
								</div>
								<FileText className="h-8 w-8 text-muted-foreground" />
							</div>
						</CardContent>
					</Card>
					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-muted-foreground text-sm">Pending</p>
									<p className="text-2xl font-bold text-yellow-400">
										{stats?.pending || 0}
									</p>
								</div>
								<Clock className="h-8 w-8 text-yellow-400" />
							</div>
						</CardContent>
					</Card>
					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-muted-foreground text-sm">Completed</p>
									<p className="text-2xl font-bold text-green-400">
										{stats?.completed || 0}
									</p>
								</div>
								<CheckCircle className="h-8 w-8 text-green-400" />
							</div>
						</CardContent>
					</Card>
					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-muted-foreground text-sm">NSE</p>
									<p className="text-2xl font-bold text-blue-400">
										{stats?.byExchange?.nse || 0}
									</p>
								</div>
								<BarChart3 className="h-8 w-8 text-blue-400" />
							</div>
						</CardContent>
					</Card>
					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-muted-foreground text-sm">BSE</p>
									<p className="text-2xl font-bold text-purple-400">
										{stats?.byExchange?.bse || 0}
									</p>
								</div>
								<BarChart3 className="h-8 w-8 text-purple-400" />
							</div>
						</CardContent>
					</Card>
				</div>

				<Card className="bg-card border-border">
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-foreground">Filing Records</CardTitle>
							<div className="flex gap-2">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search by symbol..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="pl-9 w-48"
										data-testid="input-search"
									/>
								</div>
								<Select
									value={exchangeFilter}
									onValueChange={setExchangeFilter}
								>
									<SelectTrigger className="w-32" data-testid="select-exchange">
										<SelectValue placeholder="Exchange" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										<SelectItem value="NSE">NSE</SelectItem>
										<SelectItem value="BSE">BSE</SelectItem>
									</SelectContent>
								</Select>
								<Select value={statusFilter} onValueChange={setStatusFilter}>
									<SelectTrigger className="w-32" data-testid="select-status">
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										<SelectItem value="pending">Pending</SelectItem>
										<SelectItem value="processing">Processing</SelectItem>
										<SelectItem value="completed">Completed</SelectItem>
										<SelectItem value="failed">Failed</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{filingsLoading ? (
							<LoadingState />
						) : (
							<>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Exchange</TableHead>
											<TableHead>Symbol</TableHead>
											<TableHead>Company</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Filing Date</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Confidence</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filings.map((filing) => (
											<TableRow
												key={filing.id}
												data-testid={`row-filing-${filing.id}`}
											>
												<TableCell>
													<Badge
														variant="outline"
														className={
															filing.exchange === "NSE"
																? "border-blue-500 text-blue-400"
																: "border-purple-500 text-purple-400"
														}
													>
														{filing.exchange}
													</Badge>
												</TableCell>
												<TableCell className="font-mono">
													{filing.symbol}
												</TableCell>
												<TableCell className="max-w-48 truncate">
													{filing.company_name}
												</TableCell>
												<TableCell>
													<span className="text-sm">
														{filing.filing_type} - {filing.financial_type}
													</span>
												</TableCell>
												<TableCell>
													{format(new Date(filing.filing_date), "dd MMM yyyy")}
												</TableCell>
												<TableCell>
													<Badge
														className={
															statusConfig[filing.processing_status]?.color ||
															"bg-muted/20"
														}
													>
														{statusConfig[filing.processing_status]?.label ||
															filing.processing_status}
													</Badge>
												</TableCell>
												<TableCell>
													{filing.extraction_confidence ? (
														<span
															className={
																filing.extraction_confidence >= 0.9
																	? "text-green-400"
																	: filing.extraction_confidence >= 0.8
																		? "text-yellow-400"
																		: "text-red-400"
															}
														>
															{(filing.extraction_confidence * 100).toFixed(0)}%
														</span>
													) : (
														"-"
													)}
												</TableCell>
												<TableCell>
													<div className="flex gap-1">
														<Button
															variant="ghost"
															size="sm"
															onClick={() => setSelectedFiling(filing.id)}
															data-testid={`button-view-${filing.id}`}
														>
															<Eye className="h-4 w-4" />
														</Button>
														{filing.processing_status === "pending" &&
															filing.document_type === "XBRL" && (
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() =>
																		processMutation.mutate(filing.id)
																	}
																	disabled={processMutation.isPending}
																	data-testid={`button-process-${filing.id}`}
																>
																	<Play className="h-4 w-4" />
																</Button>
															)}
														<a
															href={filing.document_url}
															target="_blank"
															rel="noopener noreferrer"
														>
															<Button
																variant="ghost"
																size="sm"
																data-testid={`button-original-${filing.id}`}
															>
																<ExternalLink className="h-4 w-4" />
															</Button>
														</a>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>

								{pagination && pagination.totalPages > 1 && (
									<div className="flex justify-between items-center mt-4">
										<p className="text-sm text-muted-foreground">
											Page {pagination.page} of {pagination.totalPages} (
											{pagination.total} total)
										</p>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setPage((p) => Math.max(1, p - 1))}
												disabled={page === 1}
												data-testid="button-prev-page"
											>
												Previous
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => setPage((p) => p + 1)}
												disabled={page >= pagination.totalPages}
												data-testid="button-next-page"
											>
												Next
											</Button>
										</div>
									</div>
								)}
							</>
						)}
					</CardContent>
				</Card>

				<Dialog
					open={!!selectedFiling}
					onOpenChange={(open) => !open && setSelectedFiling(null)}
				>
					<DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5" />
								Filing Detail
							</DialogTitle>
							<DialogDescription>
								Review extracted metrics and approve for production use
							</DialogDescription>
						</DialogHeader>

						{detailLoading ? (
							<LoadingState />
						) : detail ? (
							<div className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label className="text-muted-foreground">Company</Label>
										<p className="font-medium">{detail.filing.company_name}</p>
									</div>
									<div>
										<Label className="text-muted-foreground">
											Exchange / Symbol
										</Label>
										<p className="font-medium">
											{detail.filing.exchange} - {detail.filing.symbol}
										</p>
									</div>
									<div>
										<Label className="text-muted-foreground">Filing Type</Label>
										<p className="font-medium">
											{detail.filing.filing_type} (
											{detail.filing.financial_type})
										</p>
									</div>
									<div>
										<Label className="text-muted-foreground">
											Document Hash
										</Label>
										<p className="font-mono text-sm truncate">
											{detail.documentHash}
										</p>
									</div>
								</div>

								<div className="border rounded-lg p-4">
									<div className="flex items-center justify-between mb-4">
										<h3 className="font-medium flex items-center gap-2">
											<LucideShield className="h-4 w-4" />
											Extracted Metrics
										</h3>
										<a
											href={detail.viewOriginalUrl}
											target="_blank"
											rel="noopener noreferrer"
										>
											<Button
												variant="outline"
												size="sm"
												data-testid="button-view-original"
											>
												<ExternalLink className="h-4 w-4 mr-2" />
												View Original Document
											</Button>
										</a>
									</div>

									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Metric</TableHead>
												<TableHead>Value</TableHead>
												<TableHead>Confidence</TableHead>
												<TableHead>Method</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{detail.extractedMetrics.map((metric) => (
												<TableRow
													key={metric.id}
													data-testid={`row-metric-${metric.id}`}
												>
													<TableCell className="font-medium">
														{metric.metric}
													</TableCell>
													<TableCell className="font-mono">
														{Number.parseFloat(
															metric.metric_value || "0",
														).toLocaleString("en-IN")}
													</TableCell>
													<TableCell>
														<span
															className={
																metric.extraction_confidence >= 0.9
																	? "text-green-400"
																	: "text-yellow-400"
															}
														>
															{(metric.extraction_confidence * 100).toFixed(0)}%
														</span>
													</TableCell>
													<TableCell>
														<Badge variant="outline">
															{metric.extraction_method}
														</Badge>
													</TableCell>
													<TableCell>
														{metric.is_approved ? (
															<Badge className="bg-green-500/20 text-green-400">
																Approved
															</Badge>
														) : metric.is_manual_override ? (
															<Badge className="bg-orange-500/20 text-orange-400">
																Overridden
															</Badge>
														) : (
															<Badge className="bg-yellow-500/20 text-yellow-400">
																Pending
															</Badge>
														)}
													</TableCell>
													<TableCell>
														<div className="flex gap-1">
															{!metric.is_approved && (
																<Dialog>
																	<DialogTrigger asChild>
																		<Button
																			variant="ghost"
																			size="sm"
																			onClick={() =>
																				setSelectedMetricId(metric.id)
																			}
																			data-testid={`button-approve-${metric.id}`}
																		>
																			<CheckCircle className="h-4 w-4 text-green-400" />
																		</Button>
																	</DialogTrigger>
																	<DialogContent>
																		<DialogHeader>
																			<DialogTitle>Approve Metric</DialogTitle>
																			<DialogDescription>
																				Provide justification for SEBI
																				compliance audit trail
																			</DialogDescription>
																		</DialogHeader>
																		<div className="space-y-4">
																			<div>
																				<Label>Metric: {metric.metric}</Label>
																				<p className="text-lg font-mono">
																					{metric.metric_value}
																				</p>
																			</div>
																			<div>
																				<Label>Justification (required)</Label>
																				<Textarea
																					value={approvalJustification}
																					onChange={(e) =>
																						setApprovalJustification(
																							e.target.value,
																						)
																					}
																					placeholder="Enter justification for approving this value..."
																					data-testid="input-justification"
																				/>
																			</div>
																		</div>
																		<DialogFooter>
																			<Button
																				onClick={() => {
																					if (
																						approvalJustification.length >= 10
																					) {
																						approveMutation.mutate({
																							filingId: selectedFiling!,
																							metricId: metric.id,
																							justification:
																								approvalJustification,
																						});
																					}
																				}}
																				disabled={
																					approvalJustification.length < 10 ||
																					approveMutation.isPending
																				}
																				data-testid="button-confirm-approve"
																			>
																				{approveMutation.isPending ? (
																					<Loader2 className="h-4 w-4 animate-spin" />
																				) : (
																					"Approve"
																				)}
																			</Button>
																		</DialogFooter>
																	</DialogContent>
																</Dialog>
															)}
															<Dialog>
																<DialogTrigger asChild>
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={() =>
																			setSelectedMetricId(metric.id)
																		}
																		data-testid={`button-override-${metric.id}`}
																	>
																		<Edit className="h-4 w-4 text-orange-400" />
																	</Button>
																</DialogTrigger>
																<DialogContent>
																	<DialogHeader>
																		<DialogTitle>
																			Override Metric Value
																		</DialogTitle>
																		<DialogDescription>
																			Provide new value and detailed reason for
																			SEBI compliance
																		</DialogDescription>
																	</DialogHeader>
																	<div className="space-y-4">
																		<div>
																			<Label>Current Value</Label>
																			<p className="font-mono text-lg">
																				{metric.metric_value}
																			</p>
																		</div>
																		<div>
																			<Label>New Value</Label>
																			<Input
																				value={overrideValue}
																				onChange={(e) =>
																					setOverrideValue(e.target.value)
																				}
																				placeholder="Enter corrected value"
																				data-testid="input-override-value"
																			/>
																		</div>
																		<div>
																			<Label>
																				Reason (minimum 20 characters)
																			</Label>
																			<Textarea
																				value={overrideReason}
																				onChange={(e) =>
																					setOverrideReason(e.target.value)
																				}
																				placeholder="Explain why this value needs correction..."
																				data-testid="input-override-reason"
																			/>
																		</div>
																	</div>
																	<DialogFooter>
																		<Button
																			variant="destructive"
																			onClick={() => {
																				if (
																					overrideReason.length >= 20 &&
																					overrideValue
																				) {
																					overrideMutation.mutate({
																						filingId: selectedFiling!,
																						metricId: metric.id,
																						newValue: overrideValue,
																						reason: overrideReason,
																					});
																				}
																			}}
																			disabled={
																				overrideReason.length < 20 ||
																				!overrideValue ||
																				overrideMutation.isPending
																			}
																			data-testid="button-confirm-override"
																		>
																			{overrideMutation.isPending ? (
																				<Loader2 className="h-4 w-4 animate-spin" />
																			) : (
																				"Override Value"
																			)}
																		</Button>
																	</DialogFooter>
																</DialogContent>
															</Dialog>
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							</div>
						) : (
							<p className="text-muted-foreground">No filing data available</p>
						)}
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
