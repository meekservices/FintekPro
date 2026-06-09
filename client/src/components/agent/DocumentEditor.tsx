import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	FileText,
	Edit3,
	MessageSquare,
	Check,
	X,
	Clock,
	Send,
	Eye,
	History,
	Lock,
	Unlock,
	AlertTriangle,
	Users,
	CheckCircle,
} from "lucide-react";

interface DocumentEditorProps {
	workflowId: string;
	proposalId: string;
	canEdit?: boolean;
	canComment?: boolean;
	canApprove?: boolean;
}

interface EditableField {
	id: string;
	name: string;
	path: string;
	type: string;
	currentValue: string;
	isRequired: boolean;
	isEditable: boolean;
}

interface FieldEdit {
	id: string;
	fieldName: string;
	previousValue?: string;
	newValue: string;
	changeType: "add" | "modify" | "delete";
	approvalStatus: "pending" | "approved" | "rejected";
	editedByName?: string;
	createdAt: string;
}

interface Comment {
	id: string;
	content: string;
	commentType: string;
	authorName?: string;
	createdAt: string;
	threadResolved: boolean;
	pageNumber?: number;
	highlightedText?: string;
}

export default function DocumentEditor({
	workflowId,
	proposalId,
	canEdit = false,
	canComment = true,
	canApprove = false,
}: DocumentEditorProps) {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("document");
	const [editingField, setEditingField] = useState<string | null>(null);
	const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
	const [newComment, setNewComment] = useState("");
	const [commentType, setCommentType] = useState<
		"comment" | "suggestion" | "question" | "issue"
	>("comment");

	const {
		data: workflow,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["/api/proposal-esign/workflows", workflowId],
		enabled: !!workflowId,
	});

	const { data: editableFields } = useQuery<{
		success: boolean;
		editableFields: EditableField[];
	}>({
		queryKey: ["/api/proposal-esign/agreements", proposalId, "fields"],
		enabled: !!proposalId,
	});

	const recordEditMutation = useMutation({
		mutationFn: async (data: {
			fieldName: string;
			previousValue?: string;
			newValue: string;
			changeType: "modify";
		}) => {
			return apiRequest(`/api/proposal-esign/workflows/${workflowId}/edits`, {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			toast({ title: "Edit submitted for approval" });
			refetch();
			setEditingField(null);
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const approveEditMutation = useMutation({
		mutationFn: async (editId: string) => {
			return apiRequest(`/api/proposal-esign/edits/${editId}/approve`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			toast({ title: "Edit approved" });
			refetch();
		},
	});

	const rejectEditMutation = useMutation({
		mutationFn: async ({
			editId,
			reason,
		}: { editId: string; reason: string }) => {
			return apiRequest(`/api/proposal-esign/edits/${editId}/reject`, {
				method: "POST",
				body: JSON.stringify({ reason }),
			});
		},
		onSuccess: () => {
			toast({ title: "Edit rejected" });
			refetch();
		},
	});

	const addCommentMutation = useMutation({
		mutationFn: async (data: { content: string; commentType: string }) => {
			return apiRequest(
				`/api/proposal-esign/workflows/${workflowId}/comments`,
				{
					method: "POST",
					body: JSON.stringify(data),
				},
			);
		},
		onSuccess: () => {
			toast({ title: "Comment added" });
			setNewComment("");
			refetch();
		},
	});

	const resolveCommentMutation = useMutation({
		mutationFn: async (commentId: string) => {
			return apiRequest(`/api/proposal-esign/comments/${commentId}/resolve`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			toast({ title: "Comment resolved" });
			refetch();
		},
	});

	useEffect(() => {
		if (editableFields?.editableFields) {
			const values: Record<string, string> = {};
			editableFields.editableFields.forEach((f) => {
				values[f.id] = f.currentValue;
			});
			setFieldValues(values);
		}
	}, [editableFields]);

	const handleFieldEdit = (fieldId: string, newValue: string) => {
		const field = editableFields?.editableFields?.find((f) => f.id === fieldId);
		if (!field) return;

		recordEditMutation.mutate({
			fieldName: field.name,
			previousValue: field.currentValue,
			newValue,
			changeType: "modify",
		});
	};

	const workflowData = workflow as any;
	const isLocked = workflowData?.workflow?.editingLockedAt;
	const pendingEdits = workflowData?.workflow?.pendingEdits || [];
	const comments = workflowData?.workflow?.comments || [];
	const versions = workflowData?.workflow?.versions || [];

	if (isLoading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-12">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5" />
								Document Editor
							</CardTitle>
							<CardDescription>
								Review and edit the investment agreement
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							{isLocked ? (
								<Badge
									variant="destructive"
									className="flex items-center gap-1"
								>
									<Lock className="h-3 w-3" />
									Locked for Signing
								</Badge>
							) : (
								<Badge variant="secondary" className="flex items-center gap-1">
									<Unlock className="h-3 w-3" />
									Editable
								</Badge>
							)}
							<Badge variant="outline">
								Version {workflowData?.workflow?.currentVersion || 1}
							</Badge>
						</div>
					</div>
				</CardHeader>
			</Card>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="document" className="flex items-center gap-1">
						<FileText className="h-4 w-4" />
						Document
					</TabsTrigger>
					<TabsTrigger value="edits" className="flex items-center gap-1">
						<Edit3 className="h-4 w-4" />
						Edits
						{pendingEdits.length > 0 && (
							<Badge
								variant="secondary"
								className="ml-1 h-5 w-5 p-0 justify-center"
							>
								{pendingEdits.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="comments" className="flex items-center gap-1">
						<MessageSquare className="h-4 w-4" />
						Comments
						{comments.filter((c: Comment) => !c.threadResolved).length > 0 && (
							<Badge
								variant="secondary"
								className="ml-1 h-5 w-5 p-0 justify-center"
							>
								{comments.filter((c: Comment) => !c.threadResolved).length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="history" className="flex items-center gap-1">
						<History className="h-4 w-4" />
						History
					</TabsTrigger>
				</TabsList>

				<TabsContent value="document" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Editable Fields</CardTitle>
							<CardDescription>
								{canEdit && !isLocked
									? "Click on any field to edit. Changes require approval."
									: "View document fields. Editing is currently disabled."}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4">
								{editableFields?.editableFields?.map((field) => (
									<div key={field.id} className="space-y-2">
										<Label className="flex items-center gap-2">
											{field.name}
											{field.isRequired && (
												<span className="text-red-500">*</span>
											)}
											{!field.isEditable && (
												<Badge variant="outline" className="text-xs">
													Read-only
												</Badge>
											)}
										</Label>
										{editingField === field.id ? (
											<div className="flex gap-2">
												<Input
													value={fieldValues[field.id] || ""}
													onChange={(e) =>
														setFieldValues({
															...fieldValues,
															[field.id]: e.target.value,
														})
													}
													type={
														field.type === "number" || field.type === "currency"
															? "number"
															: "text"
													}
												/>
												<Button
													size="sm"
													onClick={() =>
														handleFieldEdit(field.id, fieldValues[field.id])
													}
													disabled={recordEditMutation.isPending}
												>
													<Check className="h-4 w-4" />
												</Button>
												<Button
													size="sm"
													variant="outline"
													onClick={() => {
														setEditingField(null);
														setFieldValues({
															...fieldValues,
															[field.id]: field.currentValue,
														});
													}}
												>
													<X className="h-4 w-4" />
												</Button>
											</div>
										) : (
											<div
												className={`p-3 rounded-md border ${
													canEdit && field.isEditable && !isLocked
														? "cursor-pointer hover:bg-muted/50 border-dashed"
														: "bg-muted/30"
												}`}
												onClick={() => {
													if (canEdit && field.isEditable && !isLocked) {
														setEditingField(field.id);
													}
												}}
											>
												<span
													className={
														field.type === "currency" ? "font-mono" : ""
													}
												>
													{field.currentValue || "-"}
												</span>
												{canEdit && field.isEditable && !isLocked && (
													<Edit3 className="h-3 w-3 inline-block ml-2 text-muted-foreground" />
												)}
											</div>
										)}
									</div>
								))}
							</div>
						</CardContent>
						<CardFooter>
							<Button
								variant="outline"
								className="w-full"
								onClick={() =>
									window.open(
										`/api/proposal-esign/agreements/${proposalId}/preview`,
										"_blank",
									)
								}
							>
								<Eye className="h-4 w-4 mr-2" />
								Preview Full Document
							</Button>
						</CardFooter>
					</Card>
				</TabsContent>

				<TabsContent value="edits" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Pending Edits</CardTitle>
							<CardDescription>
								Review and approve/reject proposed changes
							</CardDescription>
						</CardHeader>
						<CardContent>
							{pendingEdits.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<Edit3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No pending edits</p>
								</div>
							) : (
								<ScrollArea className="h-[400px]">
									<div className="space-y-4">
										{pendingEdits.map((edit: FieldEdit) => (
											<div
												key={edit.id}
												className="border rounded-lg p-4 space-y-3"
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2">
														<Badge
															variant={
																edit.approvalStatus === "pending"
																	? "secondary"
																	: edit.approvalStatus === "approved"
																		? "default"
																		: "destructive"
															}
														>
															{edit.approvalStatus}
														</Badge>
														<span className="font-medium">
															{edit.fieldName}
														</span>
													</div>
													<span className="text-sm text-muted-foreground">
														by {edit.editedByName || "Unknown"}
													</span>
												</div>

												<div className="grid grid-cols-2 gap-4 text-sm">
													<div>
														<Label className="text-muted-foreground">
															Previous Value
														</Label>
														<div className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-red-700 dark:text-red-300 line-through">
															{edit.previousValue || "-"}
														</div>
													</div>
													<div>
														<Label className="text-muted-foreground">
															New Value
														</Label>
														<div className="p-2 bg-green-50 dark:bg-green-950/20 rounded text-green-700 dark:text-green-300">
															{edit.newValue}
														</div>
													</div>
												</div>

												{canApprove && edit.approvalStatus === "pending" && (
													<div className="flex gap-2 pt-2">
														<Button
															size="sm"
															onClick={() =>
																approveEditMutation.mutate(edit.id)
															}
															disabled={approveEditMutation.isPending}
														>
															<Check className="h-4 w-4 mr-1" />
															Approve
														</Button>
														<Dialog>
															<DialogTrigger asChild>
																<Button size="sm" variant="destructive">
																	<X className="h-4 w-4 mr-1" />
																	Reject
																</Button>
															</DialogTrigger>
															<DialogContent>
																<DialogHeader>
																	<DialogTitle>Reject Edit</DialogTitle>
																	<DialogDescription>
																		Provide a reason for rejecting this edit.
																	</DialogDescription>
																</DialogHeader>
																<form
																	onSubmit={(e) => {
																		e.preventDefault();
																		const formData = new FormData(
																			e.target as HTMLFormElement,
																		);
																		const reason = formData.get(
																			"reason",
																		) as string;
																		rejectEditMutation.mutate({
																			editId: edit.id,
																			reason,
																		});
																	}}
																>
																	<Textarea
																		name="reason"
																		placeholder="Reason for rejection..."
																		required
																	/>
																	<DialogFooter className="mt-4">
																		<Button type="submit" variant="destructive">
																			Reject Edit
																		</Button>
																	</DialogFooter>
																</form>
															</DialogContent>
														</Dialog>
													</div>
												)}
											</div>
										))}
									</div>
								</ScrollArea>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="comments" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Comments & Annotations</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{canComment && (
								<div className="space-y-3 border-b pb-4">
									<div className="flex gap-2">
										<Select
											value={commentType}
											onValueChange={(v) => setCommentType(v as any)}
										>
											<SelectTrigger className="w-[140px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="comment">Comment</SelectItem>
												<SelectItem value="suggestion">Suggestion</SelectItem>
												<SelectItem value="question">Question</SelectItem>
												<SelectItem value="issue">Issue</SelectItem>
											</SelectContent>
										</Select>
										<div className="flex-1 flex gap-2">
											<Textarea
												placeholder="Add a comment..."
												value={newComment}
												onChange={(e) => setNewComment(e.target.value)}
												className="min-h-[60px]"
											/>
											<Button
												onClick={() =>
													addCommentMutation.mutate({
														content: newComment,
														commentType,
													})
												}
												disabled={
													!newComment.trim() || addCommentMutation.isPending
												}
											>
												<Send className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</div>
							)}

							<ScrollArea className="h-[350px]">
								{comments.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
										<p>No comments yet</p>
									</div>
								) : (
									<div className="space-y-3">
										{comments.map((comment: Comment) => (
											<div
												key={comment.id}
												className={`p-3 rounded-lg border ${
													comment.threadResolved
														? "bg-muted/30 opacity-60"
														: "bg-card"
												}`}
											>
												<div className="flex items-center justify-between mb-2">
													<div className="flex items-center gap-2">
														<Badge
															variant={
																comment.commentType === "issue"
																	? "destructive"
																	: comment.commentType === "question"
																		? "secondary"
																		: comment.commentType === "suggestion"
																			? "outline"
																			: "default"
															}
														>
															{comment.commentType}
														</Badge>
														<span className="text-sm font-medium">
															{comment.authorName || "Anonymous"}
														</span>
													</div>
													<div className="flex items-center gap-2">
														<span className="text-xs text-muted-foreground">
															{new Date(comment.createdAt).toLocaleDateString()}
														</span>
														{!comment.threadResolved && canApprove && (
															<Button
																size="sm"
																variant="ghost"
																onClick={() =>
																	resolveCommentMutation.mutate(comment.id)
																}
															>
																<CheckCircle className="h-4 w-4" />
															</Button>
														)}
													</div>
												</div>
												<p className="text-sm">{comment.content}</p>
												{comment.highlightedText && (
													<div className="mt-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded italic">
														"{comment.highlightedText}"
													</div>
												)}
												{comment.threadResolved && (
													<Badge variant="outline" className="mt-2 text-xs">
														<Check className="h-3 w-3 mr-1" />
														Resolved
													</Badge>
												)}
											</div>
										))}
									</div>
								)}
							</ScrollArea>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="history" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Version History</CardTitle>
							<CardDescription>
								Track all document versions and changes
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ScrollArea className="h-[400px]">
								{versions.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<History className="h-12 w-12 mx-auto mb-4 opacity-50" />
										<p>No version history available</p>
									</div>
								) : (
									<div className="space-y-4">
										{versions.map((version: any, index: number) => (
											<div key={version.id} className="flex gap-4">
												<div className="flex flex-col items-center">
													<div
														className={`w-8 h-8 rounded-full flex items-center justify-center ${
															index === 0
																? "bg-primary text-primary-foreground"
																: "bg-muted"
														}`}
													>
														{version.versionNumber}
													</div>
													{index < versions.length - 1 && (
														<div className="w-0.5 h-full bg-border mt-2" />
													)}
												</div>
												<div className="flex-1 pb-4">
													<div className="flex items-center justify-between">
														<div>
															<span className="font-medium">
																{version.versionLabel ||
																	`Version ${version.versionNumber}`}
															</span>
															{version.isLocked && (
																<Badge variant="outline" className="ml-2">
																	<Lock className="h-3 w-3 mr-1" />
																	Locked
																</Badge>
															)}
														</div>
														<span className="text-sm text-muted-foreground">
															{new Date(version.createdAt).toLocaleString()}
														</span>
													</div>
													{version.changeDescription && (
														<p className="text-sm text-muted-foreground mt-1">
															{version.changeDescription}
														</p>
													)}
													<p className="text-xs text-muted-foreground mt-1">
														Round {version.negotiationRound} • By{" "}
														{version.createdByName || "System"}
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
			</Tabs>
		</div>
	);
}
