import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
	ArrowLeft,
	Check,
	X,
	MessageSquare,
	GitCompare,
	FileText,
	Clock,
	User,
	CheckCircle,
	XCircle,
	AlertTriangle,
	Send,
	RefreshCw,
	Eye,
	History,
	Bot,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
	draft: "bg-muted text-foreground",
	negotiation:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	review: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
	approved:
		"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	signed:
		"bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
	legacy:
		"bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
	expired: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	archived: "bg-muted text-muted-foreground",
};

const CHANGE_COLORS: Record<
	string,
	{ bg: string; text: string; border: string }
> = {
	insert: {
		bg: "bg-green-50 dark:bg-green-950/30",
		text: "text-green-800 dark:text-green-200",
		border: "border-green-300 dark:border-green-700",
	},
	delete: {
		bg: "bg-red-50 dark:bg-red-950/30",
		text: "text-red-800 dark:text-red-200 line-through",
		border: "border-red-300 dark:border-red-700",
	},
	modify: {
		bg: "bg-yellow-50 dark:bg-yellow-950/30",
		text: "text-yellow-800 dark:text-yellow-200",
		border: "border-yellow-300 dark:border-yellow-700",
	},
	comment: {
		bg: "bg-blue-50 dark:bg-blue-950/30",
		text: "text-blue-800 dark:text-blue-200",
		border: "border-blue-300 dark:border-blue-700",
	},
};

interface TrackedChange {
	id: string;
	documentId: string;
	versionId: string;
	clauseId?: string;
	operation: "insert" | "delete" | "modify" | "comment";
	oldText?: string;
	newText?: string;
	startPosition?: number;
	endPosition?: number;
	suggestedBy: string;
	suggestedByRole: string;
	status: "pending" | "accepted" | "rejected";
	resolvedBy?: string;
	resolvedByRole?: string;
	resolvedAt?: string;
	resolutionNote?: string;
	createdAt: string;
}

interface Comment {
	id: string;
	documentId: string;
	versionId?: string;
	parentCommentId?: string;
	content: string;
	commentType: string;
	clauseRef?: string;
	authorId: string;
	authorRole: string;
	authorName?: string;
	isResolved: boolean;
	resolvedBy?: string;
	resolvedAt?: string;
	createdAt: string;
}

interface DocumentVersion {
	id: string;
	documentId: string;
	versionNumber: number;
	versionLabel: string;
	content: string;
	contentType: string;
	contentHash: string;
	statusAtVersion: string;
	changeSummary?: string;
	createdBy: string;
	createdByRole: string;
	createdAt: string;
}

// User role type for permission checking
type UserRole = "admin" | "reviewer" | "editor" | "viewer";

// Permission matrix
const ROLE_PERMISSIONS: Record<
	UserRole,
	{ canAcceptReject: boolean; canComment: boolean; canSuggestChanges: boolean }
> = {
	admin: { canAcceptReject: true, canComment: true, canSuggestChanges: true },
	reviewer: {
		canAcceptReject: false,
		canComment: true,
		canSuggestChanges: false,
	},
	editor: { canAcceptReject: false, canComment: true, canSuggestChanges: true },
	viewer: {
		canAcceptReject: false,
		canComment: false,
		canSuggestChanges: false,
	},
};

// Inline diff renderer - applies tracked changes at character positions
function renderDocumentWithDiffs(
	content: string,
	changes: TrackedChange[],
	showPending: boolean = true,
): JSX.Element[] {
	// Sort changes by startPosition
	const sortedChanges = [...changes]
		.filter((c) => c.startPosition !== undefined && c.endPosition !== undefined)
		.filter((c) => (showPending ? c.status === "pending" : true))
		.sort((a, b) => (a.startPosition || 0) - (b.startPosition || 0));

	if (sortedChanges.length === 0) {
		return [<span key="content">{content}</span>];
	}

	const result: JSX.Element[] = [];
	let lastEnd = 0;

	sortedChanges.forEach((change, idx) => {
		const start = change.startPosition || 0;
		const end = change.endPosition || 0;

		// Add text before this change
		if (start > lastEnd) {
			result.push(
				<span key={`text-${idx}`}>{content.slice(lastEnd, start)}</span>,
			);
		}

		// Style based on operation and status
		const isPending = change.status === "pending";
		const opClass =
			change.operation === "insert"
				? `bg-green-200 dark:bg-green-800/30 text-green-900 dark:text-green-100 ${isPending ? "border-b-2 border-green-500" : ""}`
				: change.operation === "delete"
					? `bg-red-200 dark:bg-red-800/30 text-red-900 dark:text-red-100 line-through ${isPending ? "border-b-2 border-red-500" : ""}`
					: `bg-yellow-200 dark:bg-yellow-800/30 text-yellow-900 dark:text-yellow-100 ${isPending ? "border-b-2 border-yellow-500" : ""}`;

		const displayText =
			change.operation === "delete"
				? change.oldText || content.slice(start, end)
				: change.operation === "insert"
					? change.newText || ""
					: change.newText || content.slice(start, end);

		result.push(
			<span
				key={`change-${change.id}`}
				className={`px-1 rounded ${opClass}`}
				title={`${(change.operation || "modify").toUpperCase()} by ${change.suggestedByRole || "system"} - ${change.status || "pending"}`}
				data-testid={`inline-change-${change.id}`}
			>
				{displayText}
			</span>,
		);

		// For modify operations, show both old and new
		if (change.operation === "modify" && change.oldText && change.newText) {
			result.pop(); // Remove the previous element
			result.push(
				<span key={`change-${change.id}`}>
					<span
						className="bg-red-200 dark:bg-red-800/30 text-red-900 dark:text-red-100 line-through px-1 rounded"
						title={`OLD: ${change.oldText}`}
					>
						{change.oldText}
					</span>
					<span
						className={`bg-green-200 dark:bg-green-800/30 text-green-900 dark:text-green-100 px-1 rounded ${isPending ? "border-b-2 border-green-500" : ""}`}
						title={`NEW: ${change.newText}`}
						data-testid={`inline-change-${change.id}`}
					>
						{change.newText}
					</span>
				</span>,
			);
		}

		lastEnd = end;
	});

	// Add remaining text after last change
	if (lastEnd < content.length) {
		result.push(<span key="text-end">{content.slice(lastEnd)}</span>);
	}

	return result;
}

// Build comment tree from flat list using parentCommentId
interface CommentWithReplies extends Comment {
	replies: CommentWithReplies[];
}

function buildCommentTree(comments: Comment[]): CommentWithReplies[] {
	const commentMap = new Map<string, CommentWithReplies>();
	const rootComments: CommentWithReplies[] = [];

	// First pass: create CommentWithReplies for each comment
	comments.forEach((comment) => {
		commentMap.set(comment.id, { ...comment, replies: [] });
	});

	// Second pass: link children to parents
	comments.forEach((comment) => {
		const commentWithReplies = commentMap.get(comment.id)!;
		if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
			commentMap.get(comment.parentCommentId)!.replies.push(commentWithReplies);
		} else {
			rootComments.push(commentWithReplies);
		}
	});

	// Sort by createdAt
	const sortByDate = (a: CommentWithReplies, b: CommentWithReplies) =>
		new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

	rootComments.sort(sortByDate);
	rootComments.forEach((comment) => comment.replies.sort(sortByDate));

	return rootComments;
}

// Recursive component for threaded comments
function ThreadedComment({
	comment,
	depth,
	onResolve,
	canResolve,
}: {
	comment: CommentWithReplies;
	depth: number;
	onResolve: (id: string) => void;
	canResolve: boolean;
}) {
	const maxIndent = 3; // Maximum nesting depth for visual indentation
	const indentPx = Math.min(depth, maxIndent) * 16;

	return (
		<div style={{ marginLeft: `${indentPx}px` }}>
			<div
				className={`p-3 rounded-lg border mb-2 ${
					comment.isResolved ? "bg-muted opacity-60" : "bg-card"
				} ${depth > 0 ? "border-l-2 border-l-primary/30" : ""}`}
				data-testid={`comment-${comment.id}`}
			>
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2">
						<div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
							<User className="h-3 w-3 text-primary" />
						</div>
						<div>
							<span className="text-xs font-medium">
								{comment.authorName || comment.authorRole}
							</span>
							<span className="text-xs text-muted-foreground ml-2">
								{new Date(comment.createdAt).toLocaleDateString()}
							</span>
							{depth > 0 && (
								<Badge variant="outline" className="ml-2 text-xs py-0">
									Reply
								</Badge>
							)}
						</div>
					</div>
					{!comment.isResolved && canResolve && (
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0"
							onClick={() => onResolve(comment.id)}
							data-testid={`button-resolve-comment-${comment.id}`}
						>
							<Check className="h-3 w-3" />
						</Button>
					)}
				</div>
				<p className="text-sm mt-2">{comment.content}</p>
				{comment.isResolved && (
					<Badge variant="secondary" className="mt-2 text-xs">
						Resolved
					</Badge>
				)}
			</div>
			{/* Render replies recursively */}
			{comment.replies.length > 0 && (
				<div className="space-y-1">
					{comment.replies.map((reply) => (
						<ThreadedComment
							key={reply.id}
							comment={reply}
							depth={depth + 1}
							onResolve={onResolve}
							canResolve={canResolve}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export default function AdminDLMNegotiatePage() {
	const { toast } = useToast();
	const params = useParams<{ documentId: string }>();
	const [, setLocation] = useLocation();
	const documentId = params.documentId;

	const [activeTab, setActiveTab] = useState("changes");
	const [newComment, setNewComment] = useState("");
	const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
	const [showResolvedChanges, setShowResolvedChanges] = useState(false);

	// For now, default to admin role - in production this would come from auth context
	const userRole: UserRole = "admin";
	const permissions = ROLE_PERMISSIONS[userRole];

	// Fetch document with versions
	const { data: documentData, isLoading: documentLoading } = useQuery<any>({
		queryKey: ["/api/dlm/documents", documentId],
		queryFn: async () => {
			const res = await fetch(`/api/dlm/documents/${documentId}`, {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to fetch document");
			return res.json();
		},
		enabled: !!documentId,
	});

	// Fetch tracked changes
	const {
		data: changesData,
		isLoading: changesLoading,
		refetch: refetchChanges,
	} = useQuery<any>({
		queryKey: ["/api/dlm/documents", documentId, "changes"],
		queryFn: async () => {
			const res = await fetch(`/api/dlm/documents/${documentId}/changes`, {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to fetch changes");
			return res.json();
		},
		enabled: !!documentId,
	});

	// Fetch comments
	const {
		data: commentsData,
		isLoading: commentsLoading,
		refetch: refetchComments,
	} = useQuery<any>({
		queryKey: ["/api/dlm/documents", documentId, "comments"],
		queryFn: async () => {
			const res = await fetch(`/api/dlm/documents/${documentId}/comments`, {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to fetch comments");
			return res.json();
		},
		enabled: !!documentId,
	});

	// Fetch AI review
	const { data: aiReviewData } = useQuery<any>({
		queryKey: ["/api/dlm/documents", documentId, "ai-review"],
		queryFn: async () => {
			const res = await fetch(`/api/dlm/documents/${documentId}/ai-review`, {
				credentials: "include",
			});
			if (!res.ok) return null;
			return res.json();
		},
		enabled: !!documentId,
	});

	// Resolve change mutation
	const resolveChangeMutation = useMutation({
		mutationFn: async ({
			changeId,
			resolution,
			note,
		}: {
			changeId: string;
			resolution: "accepted" | "rejected";
			note?: string;
		}) => {
			return apiRequest(`/api/dlm/changes/${changeId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ resolution, resolutionNote: note }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/dlm/documents", documentId, "changes"],
			});
			toast({
				title: "Change resolved",
				description: "The tracked change has been processed.",
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to resolve change",
				variant: "destructive",
			});
		},
	});

	// Add comment mutation
	const addCommentMutation = useMutation({
		mutationFn: async (content: string) => {
			return apiRequest(`/api/dlm/documents/${documentId}/comments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content,
					commentType: "general",
					versionId: documentData?.data?.document?.currentVersionId,
				}),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/dlm/documents", documentId, "comments"],
			});
			setNewComment("");
			toast({
				title: "Comment added",
				description: "Your comment has been posted.",
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to add comment",
				variant: "destructive",
			});
		},
	});

	// Resolve comment mutation
	const resolveCommentMutation = useMutation({
		mutationFn: async (commentId: string) => {
			return apiRequest(`/api/dlm/comments/${commentId}/resolve`, {
				method: "PATCH",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/dlm/documents", documentId, "comments"],
			});
			toast({ title: "Comment resolved" });
		},
	});

	// Trigger AI review mutation
	const triggerAIReviewMutation = useMutation({
		mutationFn: async () => {
			return apiRequest(`/api/dlm/documents/${documentId}/ai-review`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/dlm/documents", documentId, "ai-review"],
			});
			toast({
				title: "AI Review Complete",
				description: "The compliance analysis has been updated.",
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to run AI review",
				variant: "destructive",
			});
		},
	});

	const document = documentData?.data?.document;
	const versions = documentData?.data?.versions || [];
	const changes: TrackedChange[] = changesData?.data || [];
	const comments: Comment[] = commentsData?.data || [];
	const aiReview = aiReviewData?.data;

	const pendingChanges = useMemo(
		() => changes.filter((c) => c.status === "pending"),
		[changes],
	);
	const resolvedChanges = useMemo(
		() => changes.filter((c) => c.status !== "pending"),
		[changes],
	);
	const unresolvedComments = useMemo(
		() => comments.filter((c) => !c.isResolved),
		[comments],
	);

	const currentVersion = useMemo(() => {
		if (selectedVersion) {
			return versions.find((v: DocumentVersion) => v.id === selectedVersion);
		}
		return (
			versions.find(
				(v: DocumentVersion) => v.id === document?.currentVersionId,
			) || versions[0]
		);
	}, [versions, selectedVersion, document?.currentVersionId]);

	if (documentLoading) {
		return (
			<div
				className="flex items-center justify-center min-h-screen"
				data-testid="loading-spinner"
			>
				<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!document) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-4">
				<AlertTriangle className="h-12 w-12 text-yellow-500" />
				<p className="text-lg text-muted-foreground">Document not found</p>
				<Button
					onClick={() => setLocation("/admin/dlm")}
					data-testid="button-back-to-dlm"
				>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to Documents
				</Button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<div className="border-b bg-card sticky top-0 z-10">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setLocation("/admin/dlm")}
								data-testid="button-back"
							>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back
							</Button>
							<Separator orientation="vertical" className="h-6" />
							<div>
								<h1
									className="text-xl font-semibold"
									data-testid="text-document-title"
								>
									{document.title}
								</h1>
								<p className="text-sm text-muted-foreground">
									{document.documentNumber}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<Badge
								className={STATUS_COLORS[document.status]}
								data-testid="badge-status"
							>
								{(document.status || "pending").charAt(0).toUpperCase() +
									(document.status || "pending").slice(1)}
							</Badge>
							<Button
								variant="outline"
								size="sm"
								onClick={() => triggerAIReviewMutation.mutate()}
								disabled={triggerAIReviewMutation.isPending}
								data-testid="button-ai-review"
							>
								<Bot className="h-4 w-4 mr-2" />
								{triggerAIReviewMutation.isPending
									? "Analyzing..."
									: "AI Review"}
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content - Split View */}
			<div className="container mx-auto px-4 py-6">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Document Viewer - Left Panel (2/3) */}
					<div className="lg:col-span-2 space-y-4">
						{/* Version Selector */}
						<Card>
							<CardHeader className="py-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<History className="h-4 w-4 text-muted-foreground" />
										<span className="text-sm font-medium">Version</span>
										<select
											value={selectedVersion || currentVersion?.id || ""}
											onChange={(e) => setSelectedVersion(e.target.value)}
											className="text-sm border rounded px-2 py-1"
											data-testid="select-version"
										>
											{versions.map((v: DocumentVersion) => (
												<option key={v.id} value={v.id}>
													{v.versionLabel} -{" "}
													{new Date(v.createdAt).toLocaleDateString()}
												</option>
											))}
										</select>
									</div>
									{pendingChanges.length > 0 && (
										<Badge
											variant="secondary"
											data-testid="badge-pending-changes"
										>
											{pendingChanges.length} pending changes
										</Badge>
									)}
								</div>
							</CardHeader>
						</Card>

						{/* Document Content with Tracked Changes */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									Document Content
								</CardTitle>
								<CardDescription>
									Review the document with tracked changes highlighted
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-[500px] border rounded-lg p-4">
									{/* Render document content with inline tracked change highlights */}
									<div
										className="prose prose-sm max-w-none"
										data-testid="document-content"
									>
										{currentVersion?.content ? (
											<div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
												{renderDocumentWithDiffs(
													currentVersion.content,
													pendingChanges,
													true,
												)}
											</div>
										) : (
											<p className="text-muted-foreground italic">
												No content available for this version
											</p>
										)}
									</div>

									{/* Legend for change highlights */}
									{pendingChanges.length > 0 && (
										<div className="mt-4 pt-4 border-t flex gap-4 text-xs text-muted-foreground">
											<span className="flex items-center gap-1">
												<span className="w-3 h-3 bg-green-200 dark:bg-green-800/30 rounded" />{" "}
												Insertion
											</span>
											<span className="flex items-center gap-1">
												<span className="w-3 h-3 bg-red-200 dark:bg-red-800/30 rounded" />{" "}
												Deletion
											</span>
											<span className="flex items-center gap-1">
												<span className="w-3 h-3 bg-yellow-200 dark:bg-yellow-800/30 rounded" />{" "}
												Modification
											</span>
										</div>
									)}

									{/* Inline tracked changes display */}
									{pendingChanges.length > 0 && (
										<div className="mt-6 border-t pt-4">
											<h4 className="font-medium mb-3 flex items-center gap-2">
												<GitCompare className="h-4 w-4" />
												Pending Changes
											</h4>
											<div className="space-y-3">
												{pendingChanges.map((change) => (
													<div
														key={change.id}
														className={`p-3 rounded-lg border-l-4 ${CHANGE_COLORS[change.operation].bg} ${CHANGE_COLORS[change.operation].border}`}
														data-testid={`change-${change.id}`}
													>
														<div className="flex items-start justify-between gap-2">
															<div className="flex-1">
																<div className="flex items-center gap-2 mb-2">
																	<Badge variant="outline" className="text-xs">
																		{(
																			change.operation || "modify"
																		).toUpperCase()}
																	</Badge>
																	<span className="text-xs text-muted-foreground">
																		by {change.suggestedBy} (
																		{change.suggestedByRole})
																	</span>
																</div>
																{change.oldText && (
																	<div className="text-sm mb-1">
																		<span className="text-muted-foreground">
																			Old:{" "}
																		</span>
																		<span className="line-through text-red-600">
																			{change.oldText}
																		</span>
																	</div>
																)}
																{change.newText && (
																	<div className="text-sm">
																		<span className="text-muted-foreground">
																			New:{" "}
																		</span>
																		<span className="text-green-600">
																			{change.newText}
																		</span>
																	</div>
																)}
															</div>
															{permissions.canAcceptReject && (
																<div className="flex gap-1">
																	<Button
																		size="sm"
																		variant="ghost"
																		className="h-8 w-8 p-0 text-green-600 hover:text-green-700 dark:text-green-300 hover:bg-green-100 dark:bg-green-900/30"
																		onClick={() =>
																			resolveChangeMutation.mutate({
																				changeId: change.id,
																				resolution: "accepted",
																			})
																		}
																		disabled={resolveChangeMutation.isPending}
																		data-testid={`button-accept-change-${change.id}`}
																	>
																		<Check className="h-4 w-4" />
																	</Button>
																	<Button
																		size="sm"
																		variant="ghost"
																		className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-300 hover:bg-red-100 dark:bg-red-900/30"
																		onClick={() =>
																			resolveChangeMutation.mutate({
																				changeId: change.id,
																				resolution: "rejected",
																			})
																		}
																		disabled={resolveChangeMutation.isPending}
																		data-testid={`button-reject-change-${change.id}`}
																	>
																		<X className="h-4 w-4" />
																	</Button>
																</div>
															)}
														</div>
													</div>
												))}
											</div>
										</div>
									)}
								</ScrollArea>
							</CardContent>
						</Card>

						{/* AI Compliance Summary */}
						{aiReview && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Bot className="h-5 w-5" />
										AI Compliance Analysis
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-3 gap-4 mb-4">
										<div className="text-center p-3 bg-muted rounded-lg">
											<div
												className="text-2xl font-bold"
												data-testid="text-overall-score"
											>
												{aiReview.overallScore || 0}
											</div>
											<div className="text-xs text-muted-foreground">
												Overall Score
											</div>
										</div>
										<div className="text-center p-3 bg-muted rounded-lg">
											<div
												className="text-2xl font-bold"
												data-testid="text-compliance-score"
											>
												{aiReview.complianceScore || 0}
											</div>
											<div className="text-xs text-muted-foreground">
												Compliance
											</div>
										</div>
										<div className="text-center p-3 bg-muted rounded-lg">
											<div
												className="text-2xl font-bold"
												data-testid="text-risk-score"
											>
												{aiReview.riskScore || 0}
											</div>
											<div className="text-xs text-muted-foreground">
												Risk Score
											</div>
										</div>
									</div>
									{aiReview.findings && aiReview.findings.length > 0 && (
										<div className="space-y-2">
											<h4 className="text-sm font-medium">Key Findings</h4>
											{aiReview.findings
												.slice(0, 3)
												.map((finding: any, idx: number) => (
													<div
														key={idx}
														className="text-sm p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border-l-2 border-yellow-400"
													>
														<span className="font-medium">
															{finding.clauseRef}:
														</span>{" "}
														{finding.issue}
													</div>
												))}
										</div>
									)}
								</CardContent>
							</Card>
						)}
					</div>

					{/* Activity Panel - Right Panel (1/3) */}
					<div className="space-y-4">
						<Card>
							<CardHeader className="py-3">
								<Tabs value={activeTab} onValueChange={setActiveTab}>
									<TabsList className="grid w-full grid-cols-2">
										<TabsTrigger
											value="changes"
											className="text-xs"
											data-testid="tab-changes"
										>
											<GitCompare className="h-3 w-3 mr-1" />
											Changes ({changes.length})
										</TabsTrigger>
										<TabsTrigger
											value="comments"
											className="text-xs"
											data-testid="tab-comments"
										>
											<MessageSquare className="h-3 w-3 mr-1" />
											Comments ({comments.length})
										</TabsTrigger>
									</TabsList>
								</Tabs>
							</CardHeader>
							<CardContent>
								<Tabs value={activeTab} onValueChange={setActiveTab}>
									{/* Changes Tab */}
									<TabsContent value="changes" className="mt-0">
										{/* Toggle for resolved changes */}
										<div className="flex items-center justify-between mb-3 pb-2 border-b">
											<span className="text-xs text-muted-foreground">
												{pendingChanges.length} pending,{" "}
												{resolvedChanges.length} resolved
											</span>
											<Button
												variant="ghost"
												size="sm"
												className="text-xs h-6"
												onClick={() =>
													setShowResolvedChanges(!showResolvedChanges)
												}
												data-testid="button-toggle-resolved"
											>
												{showResolvedChanges
													? "Hide Resolved"
													: "Show Resolved"}
											</Button>
										</div>
										<ScrollArea className="h-[370px]">
											{changesLoading ? (
												<div className="flex justify-center py-8">
													<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
												</div>
											) : changes.length === 0 ? (
												<div className="text-center py-8 text-muted-foreground">
													<GitCompare className="h-8 w-8 mx-auto mb-2 opacity-50" />
													<p className="text-sm">No tracked changes</p>
												</div>
											) : (
												<div className="space-y-2">
													{/* Pending Changes Section */}
													{pendingChanges.length > 0 && (
														<div className="mb-3">
															<h5 className="text-xs font-medium text-muted-foreground mb-2">
																Pending
															</h5>
															{pendingChanges.map((change) => (
																<div
																	key={change.id}
																	className="p-2 rounded border text-sm bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800 mb-2"
																	data-testid={`change-item-${change.id}`}
																>
																	<div className="flex items-center justify-between mb-1">
																		<Badge
																			variant="outline"
																			className="text-xs"
																		>
																			{change.operation}
																		</Badge>
																		<span className="text-xs text-muted-foreground">
																			{new Date(
																				change.createdAt,
																			).toLocaleDateString()}
																		</span>
																	</div>
																	{change.newText && (
																		<p className="text-xs truncate text-green-700 dark:text-green-300">
																			+ {change.newText}
																		</p>
																	)}
																	{change.oldText && (
																		<p className="text-xs truncate text-red-700 dark:text-red-300 line-through">
																			- {change.oldText}
																		</p>
																	)}
																	<div className="flex items-center justify-between mt-1">
																		<span className="text-xs text-muted-foreground">
																			{change.suggestedByRole}
																		</span>
																		{permissions.canAcceptReject && (
																			<div className="flex gap-1">
																				<Button
																					size="sm"
																					variant="ghost"
																					className="h-6 w-6 p-0"
																					onClick={() =>
																						resolveChangeMutation.mutate({
																							changeId: change.id,
																							resolution: "accepted",
																						})
																					}
																					data-testid={`button-accept-${change.id}`}
																				>
																					<CheckCircle className="h-3 w-3 text-green-600" />
																				</Button>
																				<Button
																					size="sm"
																					variant="ghost"
																					className="h-6 w-6 p-0"
																					onClick={() =>
																						resolveChangeMutation.mutate({
																							changeId: change.id,
																							resolution: "rejected",
																						})
																					}
																					data-testid={`button-reject-${change.id}`}
																				>
																					<XCircle className="h-3 w-3 text-red-600" />
																				</Button>
																			</div>
																		)}
																	</div>
																</div>
															))}
														</div>
													)}

													{/* Resolved Changes Section */}
													{showResolvedChanges &&
														resolvedChanges.length > 0 && (
															<div>
																<h5 className="text-xs font-medium text-muted-foreground mb-2">
																	Resolved
																</h5>
																{resolvedChanges.map((change) => (
																	<div
																		key={change.id}
																		className={`p-2 rounded border text-sm mb-2 opacity-70 ${
																			change.status === "accepted"
																				? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
																				: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
																		}`}
																		data-testid={`change-resolved-${change.id}`}
																	>
																		<div className="flex items-center justify-between mb-1">
																			<Badge
																				variant="outline"
																				className="text-xs"
																			>
																				{change.operation}
																			</Badge>
																			<Badge
																				variant="secondary"
																				className="text-xs"
																			>
																				{change.status}
																			</Badge>
																		</div>
																		{change.newText && (
																			<p className="text-xs truncate">
																				{change.newText}
																			</p>
																		)}
																		<div className="text-xs text-muted-foreground mt-1">
																			Resolved by {change.resolvedByRole}
																		</div>
																	</div>
																))}
															</div>
														)}

													{/* Legacy: show all if no pending */}
													{pendingChanges.length === 0 &&
														!showResolvedChanges && (
															<div className="text-center py-4 text-muted-foreground text-sm">
																No pending changes. Click "Show Resolved" to
																view history.
															</div>
														)}
												</div>
											)}
										</ScrollArea>
									</TabsContent>

									{/* Comments Tab */}
									<TabsContent value="comments" className="mt-0">
										<div className="space-y-3">
											{/* Add Comment Form - only if user can comment */}
											{permissions.canComment ? (
												<>
													<div className="flex gap-2">
														<Textarea
															placeholder="Add a comment..."
															value={newComment}
															onChange={(e) => setNewComment(e.target.value)}
															className="min-h-[60px] text-sm"
															data-testid="input-new-comment"
														/>
													</div>
													<Button
														size="sm"
														onClick={() =>
															newComment.trim() &&
															addCommentMutation.mutate(newComment)
														}
														disabled={
															!newComment.trim() || addCommentMutation.isPending
														}
														className="w-full"
														data-testid="button-add-comment"
													>
														<Send className="h-3 w-3 mr-2" />
														{addCommentMutation.isPending
															? "Posting..."
															: "Post Comment"}
													</Button>
													<Separator />
												</>
											) : (
												<div className="text-xs text-muted-foreground text-center py-2 border-b">
													You don't have permission to add comments
												</div>
											)}

											{/* Threaded Comments List */}
											<ScrollArea className="h-[300px]">
												{commentsLoading ? (
													<div className="flex justify-center py-8">
														<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
													</div>
												) : comments.length === 0 ? (
													<div className="text-center py-8 text-muted-foreground">
														<MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
														<p className="text-sm">No comments yet</p>
													</div>
												) : (
													<div className="space-y-3">
														{buildCommentTree(comments).map((comment) => (
															<ThreadedComment
																key={comment.id}
																comment={comment}
																depth={0}
																onResolve={(id) =>
																	resolveCommentMutation.mutate(id)
																}
																canResolve={permissions.canComment}
															/>
														))}
													</div>
												)}
											</ScrollArea>
										</div>
									</TabsContent>
								</Tabs>
							</CardContent>
						</Card>

						{/* Document Info Card */}
						<Card>
							<CardHeader className="py-3">
								<CardTitle className="text-sm">Document Details</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Entity</span>
									<span className="font-medium">
										{document.entityName || document.entityType}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Agreement Type</span>
									<span className="font-medium">
										{document.agreementType?.replace(/_/g, " ")}
									</span>
								</div>
								{document.entityPan && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">PAN</span>
										<span className="font-medium font-mono">
											{document.entityPan}
										</span>
									</div>
								)}
								{document.effectiveDate && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">
											Effective Date
										</span>
										<span className="font-medium">
											{new Date(document.effectiveDate).toLocaleDateString()}
										</span>
									</div>
								)}
								{document.expiryDate && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Expiry Date</span>
										<span className="font-medium">
											{new Date(document.expiryDate).toLocaleDateString()}
										</span>
									</div>
								)}
								<div className="flex justify-between">
									<span className="text-muted-foreground">Versions</span>
									<span className="font-medium">{versions.length}</span>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
