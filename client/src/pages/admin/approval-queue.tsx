import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import {
	CheckCircle2,
	XCircle,
	Clock,
	AlertCircle,
	FileText,
	User,
} from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

interface ApprovalRequest {
	id: number;
	entityType: string;
	entityId: string;
	action: string;
	requestedBy: number;
	requestedAt: string;
	status: "pending" | "approved" | "rejected";
	requestData: any;
	priority: "low" | "medium" | "high" | "critical";
	justification?: string;
}

export default function AdminApprovalQueue() {
	const { toast } = useToast();
	const [selectedRequest, setSelectedRequest] =
		useState<ApprovalRequest | null>(null);
	const [reviewComments, setReviewComments] = useState("");

	const { data: requests, isLoading } = useQuery<ApprovalRequest[]>({
		queryKey: ["/api/admin/approval-requests"],
	});

	const processMutation = useMutation({
		mutationFn: (data: {
			id: number;
			status: "approved" | "rejected";
			comments: string;
		}) =>
			apiRequest(`/api/admin/approval-requests/${data.id}/process`, {
				method: "POST",
				body: JSON.stringify({ status: data.status, comments: data.comments }),
			}),
		onSuccess: (_, variables) => {
			toast({
				title: `Request ${variables.status === "approved" ? "Approved" : "Rejected"}`,
				description: "The workflow has been processed successfully.",
			});
			setSelectedRequest(null);
			setReviewComments("");
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/approval-requests"],
			});
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Processing Failed",
				description: error.message || "Failed to process the approval request.",
			});
		},
	});

	const getPriorityBadge = (priority: string) => {
		switch (priority) {
			case "critical":
				return <Badge variant="destructive">Critical</Badge>;
			case "high":
				return <Badge className="bg-orange-500 text-white">High</Badge>;
			case "medium":
				return <Badge variant="secondary">Medium</Badge>;
			default:
				return <Badge variant="outline">Low</Badge>;
		}
	};

	if (isLoading)
		return <div className="p-8 text-center">Loading pending requests...</div>;

	return (
		<div className="p-6 space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Governance Queue
					</h1>
					<p className="text-muted-foreground">
						Maker-Checker workflow for high-risk administrative changes
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5 text-blue-500" />
						Pending Approvals
					</CardTitle>
					<CardDescription>
						Requests waiting for second-level authorization (Checker)
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Type</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Requested By</TableHead>
								<TableHead>Time</TableHead>
								<TableHead>Priority</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{!requests || requests.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="text-center py-8 text-muted-foreground"
									>
										No pending approval requests
									</TableCell>
								</TableRow>
							) : (
								requests.map((request) => (
									<TableRow key={request.id}>
										<TableCell className="font-medium">
											<div className="flex items-center gap-2 uppercase text-xs">
												<FileText className="h-3 w-3" />
												{request.entityType.replace("_", " ")}
											</div>
										</TableCell>
										<TableCell>
											<Badge variant="outline">{request.action}</Badge>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<User className="h-3 w-3" />
												User #{request.requestedBy}
											</div>
										</TableCell>
										<TableCell className="text-sm">
											{format(new Date(request.requestedAt), "MMM dd, HH:mm")}
										</TableCell>
										<TableCell>{getPriorityBadge(request.priority)}</TableCell>
										<TableCell className="text-right">
											<Dialog
												open={selectedRequest?.id === request.id}
												onOpenChange={(open) =>
													!open && setSelectedRequest(null)
												}
											>
												<DialogTrigger asChild>
													<Button
														size="sm"
														variant="outline"
														onClick={() => setSelectedRequest(request)}
													>
														Review
													</Button>
												</DialogTrigger>
												<DialogContent className="max-w-xl">
													<DialogHeader>
														<DialogTitle>Review Approval Request</DialogTitle>
														<DialogDescription>
															ID: #{request.id} | Priority:{" "}
															{request.priority.toUpperCase()}
														</DialogDescription>
													</DialogHeader>

													<div className="space-y-4 py-4">
														<div className="grid grid-cols-2 gap-4 text-sm">
															<div className="space-y-1">
																<span className="text-muted-foreground block">
																	Entity Type
																</span>
																<span className="font-medium">
																	{request.entityType}
																</span>
															</div>
															<div className="space-y-1">
																<span className="text-muted-foreground block">
																	Entity ID
																</span>
																<span className="font-medium">
																	{request.entityId}
																</span>
															</div>
														</div>

														<div className="space-y-1">
															<span className="text-muted-foreground text-sm block">
																Justification
															</span>
															<div className="p-3 bg-muted rounded-md text-sm border">
																{request.justification ||
																	"No justification provided."}
															</div>
														</div>

														<div className="space-y-1">
															<span className="text-muted-foreground text-sm block">
																Request Data
															</span>
															<pre className="p-3 bg-slate-950 text-slate-50 rounded-md text-xs overflow-auto max-h-40">
																{JSON.stringify(request.requestData, null, 2)}
															</pre>
														</div>

														<Separator />

														<div className="space-y-2">
															<Label>Checker Comments</Label>
															<Textarea
																placeholder="Provide reason for approval or rejection..."
																value={reviewComments}
																onChange={(e) =>
																	setReviewComments(e.target.value)
																}
															/>
														</div>
													</div>

													<DialogFooter className="gap-2">
														<Button
															variant="destructive"
															onClick={() =>
																processMutation.mutate({
																	id: request.id,
																	status: "rejected",
																	comments: reviewComments,
																})
															}
															disabled={processMutation.isPending}
														>
															<XCircle className="mr-2 h-4 w-4" />
															Reject
														</Button>
														<Button
															className="bg-green-600 hover:bg-green-700 text-white"
															onClick={() =>
																processMutation.mutate({
																	id: request.id,
																	status: "approved",
																	comments: reviewComments,
																})
															}
															disabled={processMutation.isPending}
														>
															<CheckCircle2 className="mr-2 h-4 w-4" />
															Approve
														</Button>
													</DialogFooter>
												</DialogContent>
											</Dialog>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
