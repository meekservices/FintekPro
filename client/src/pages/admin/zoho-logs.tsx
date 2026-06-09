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
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, FileJson, Download } from "lucide-react";

interface SyncLog {
	id: string;
	zohoService?: string;
	operation?: string;
	entityType?: string;
	status: string;
	recordsProcessed?: number;
	durationMs?: number;
	createdAt: string;
	requestPayload?: any;
	responseData?: any;
	errorMessage?: string;
}

interface SyncLogsResponse {
	logs?: SyncLog[];
	total?: number;
	pagination?: {
		total: number;
		offset: number;
		limit: number;
		hasMore: boolean;
	};
}

export default function ZohoLogsPage() {
	const [page, setPage] = useState(0);
	const [selectedService, setSelectedService] = useState("all");
	const [selectedStatus, setSelectedStatus] = useState("all");
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);
	const limit = 50;

	const params = new URLSearchParams({
		limit: limit.toString(),
		offset: (page * limit).toString(),
	});

	if (selectedService !== "all") params.append("service", selectedService);
	if (selectedStatus !== "all") params.append("status", selectedStatus);

	const { data, isLoading } = useQuery<SyncLogsResponse>({
		queryKey: [`/api/zoho/admin/sync-logs?${params.toString()}`],
	});

	const handleExport = () => {
		if (!data?.logs) return;

		const csv = [
			[
				"Timestamp",
				"Service",
				"Operation",
				"Entity",
				"Status",
				"Records",
				"Duration (ms)",
			].join(","),
			...data.logs.map((log) =>
				[
					new Date(log.createdAt).toISOString(),
					log.zohoService || "",
					log.operation || "",
					log.entityType || "",
					log.status,
					log.recordsProcessed || 0,
					log.durationMs || 0,
				].join(","),
			),
		].join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `zoho-sync-logs-${new Date().toISOString()}.csv`;
		a.click();
	};

	const filteredLogs = data?.logs?.filter((log) => {
		if (!searchTerm) return true;
		const term = searchTerm.toLowerCase();
		return (
			log.zohoService?.toLowerCase().includes(term) ||
			log.operation?.toLowerCase().includes(term) ||
			log.entityType?.toLowerCase().includes(term)
		);
	});

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Sync Logs</h1>
					<p className="text-muted-foreground mt-2">
						View and filter synchronization activity
					</p>
				</div>
				<Button
					onClick={handleExport}
					disabled={!data?.logs?.length}
					data-testid="button-export-logs"
				>
					<Download className="w-4 h-4 mr-2" />
					Export CSV
				</Button>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Filters</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<label className="text-sm font-medium">Search</label>
							<Input
								placeholder="Search logs..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								data-testid="input-search-logs"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">Service</label>
							<Select
								value={selectedService}
								onValueChange={setSelectedService}
							>
								<SelectTrigger data-testid="select-service-filter">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Services</SelectItem>
									<SelectItem value="CRM">CRM</SelectItem>
									<SelectItem value="Books">Books</SelectItem>
									<SelectItem value="Desk">Desk</SelectItem>
									<SelectItem value="WorkDrive">WorkDrive</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">Status</label>
							<Select value={selectedStatus} onValueChange={setSelectedStatus}>
								<SelectTrigger data-testid="select-status-filter">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Statuses</SelectItem>
									<SelectItem value="success">Success</SelectItem>
									<SelectItem value="failure">Failure</SelectItem>
									<SelectItem value="partial">Partial</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Logs Table */}
			<Card>
				<CardContent className="p-0">
					{isLoading ? (
						<div className="flex items-center justify-center h-96">
							<div className="text-muted-foreground">Loading logs...</div>
						</div>
					) : !filteredLogs || filteredLogs.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-96">
							<p className="text-muted-foreground mb-4">No sync logs found</p>
							{(selectedService !== "all" || selectedStatus !== "all") && (
								<Button
									variant="outline"
									onClick={() => {
										setSelectedService("all");
										setSelectedStatus("all");
										setSearchTerm("");
									}}
									data-testid="button-clear-filters"
								>
									Clear Filters
								</Button>
							)}
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Timestamp</TableHead>
										<TableHead>Service</TableHead>
										<TableHead>Operation</TableHead>
										<TableHead>Entity</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">Records</TableHead>
										<TableHead className="text-right">Duration</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredLogs.map((log: any) => (
										<TableRow key={log.id} data-testid={`log-row-${log.id}`}>
											<TableCell className="text-sm">
												{new Date(log.createdAt).toLocaleString()}
											</TableCell>
											<TableCell>
												<Badge variant="outline">{log.zohoService}</Badge>
											</TableCell>
											<TableCell className="font-medium">
												{log.operation}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{log.entityType}
											</TableCell>
											<TableCell>
												<Badge
													variant={
														log.status === "success"
															? "default"
															: log.status === "failure"
																? "destructive"
																: "secondary"
													}
												>
													{log.status}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="text-sm">
													<div>{log.recordsProcessed || 0}</div>
													{log.recordsFailed > 0 && (
														<div className="text-xs text-destructive">
															{log.recordsFailed} failed
														</div>
													)}
												</div>
											</TableCell>
											<TableCell className="text-right text-sm">
												{log.durationMs || 0}ms
											</TableCell>
											<TableCell>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => setSelectedLog(log)}
													data-testid={`button-view-details-${log.id}`}
												>
													<FileJson className="w-4 h-4" />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Pagination */}
			{data?.pagination && (
				<div className="flex items-center justify-between">
					<div className="text-sm text-muted-foreground">
						Showing {page * limit + 1} to{" "}
						{Math.min((page + 1) * limit, data.pagination.total)} of{" "}
						{data.pagination.total} logs
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage(page - 1)}
							disabled={page === 0}
							data-testid="button-previous-page"
						>
							<ChevronLeft className="w-4 h-4" />
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage(page + 1)}
							disabled={!data?.pagination?.hasMore}
							data-testid="button-next-page"
						>
							Next
							<ChevronRight className="w-4 h-4" />
						</Button>
					</div>
				</div>
			)}

			{/* Log Details Dialog */}
			<Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
				<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Sync Log Details</DialogTitle>
					</DialogHeader>
					{selectedLog && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Service
									</div>
									<Badge variant="outline" className="mt-1">
										{selectedLog.zohoService || "Unknown"}
									</Badge>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Status
									</div>
									<Badge
										variant={
											selectedLog.status === "success"
												? "default"
												: "destructive"
										}
										className="mt-1"
									>
										{selectedLog.status}
									</Badge>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Operation
									</div>
									<div className="mt-1">{selectedLog.operation || "N/A"}</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Entity Type
									</div>
									<div className="mt-1">{selectedLog.entityType || "N/A"}</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Records Processed
									</div>
									<div className="mt-1">
										{selectedLog.recordsProcessed || 0}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Duration
									</div>
									<div className="mt-1">{selectedLog.durationMs || 0}ms</div>
								</div>
							</div>

							{selectedLog.errorMessage && (
								<div>
									<div className="text-sm font-medium text-muted-foreground mb-2">
										Error Message
									</div>
									<div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
										{selectedLog.errorMessage}
									</div>
								</div>
							)}

							{selectedLog.requestPayload && (
								<div>
									<div className="text-sm font-medium text-muted-foreground mb-2">
										Request Payload
									</div>
									<pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
										{JSON.stringify(selectedLog.requestPayload, null, 2)}
									</pre>
								</div>
							)}

							{selectedLog.responseData && (
								<div>
									<div className="text-sm font-medium text-muted-foreground mb-2">
										Response Data
									</div>
									<pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
										{JSON.stringify(selectedLog.responseData, null, 2)}
									</pre>
								</div>
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
