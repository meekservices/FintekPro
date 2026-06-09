import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
	Sparkles,
	FileText,
	AlertTriangle,
	CheckCircle2,
	XCircle,
	MessageSquare,
	ChevronDown,
	ChevronRight,
	Send,
	Loader2,
	Clock,
	Check,
	X,
	Shield as LucideShield,
	Edit3,
	Scale,
	Info,
} from "lucide-react";

interface Annotation {
	id: number;
	documentId: string;
	category: string;
	title: string;
	content: string;
	severity: string;
	textExcerpt?: string;
	suggestedAction?: string;
	suggestedReplacement?: string;
	status: string;
	createdByType: string;
	createdByName?: string;
	confidence?: string;
	createdAt: string;
	acceptedBy?: string;
	acceptedAt?: string;
	rejectedBy?: string;
	rejectedAt?: string;
	rejectionReason?: string;
}

interface AnnotationReply {
	id: number;
	content: string;
	authorName: string;
	authorType: string;
	createdAt: string;
}

interface DocumentAnnotationsPanelProps {
	documentId: string;
	onClose?: () => void;
	userName?: string;
	userType?: "agent" | "client";
	isAnalyzing?: boolean;
	onAnalyze?: () => void;
}

const CATEGORY_CONFIG = {
	summary: { icon: FileText, label: "Summary", color: "text-blue-600" },
	correction: { icon: Edit3, label: "Corrections", color: "text-amber-600" },
	missing_clause: {
		icon: Scale,
		label: "Missing Clauses",
		color: "text-purple-600",
	},
	compliance: {
		icon: LucideShield,
		label: "Compliance",
		color: "text-red-600",
	},
	general: { icon: Info, label: "General", color: "text-muted-foreground" },
};

const SEVERITY_STYLES = {
	info: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
	warning:
		"bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
	error: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
	critical: "bg-red-100 border-red-300 dark:bg-red-900/40 dark:border-red-700",
};

const STATUS_BADGES = {
	open: { label: "Open", variant: "outline" as const, icon: Clock },
	accepted: { label: "Accepted", variant: "default" as const, icon: Check },
	rejected: { label: "Rejected", variant: "secondary" as const, icon: X },
	resolved: {
		label: "Resolved",
		variant: "default" as const,
		icon: CheckCircle2,
	},
	deferred: { label: "Deferred", variant: "outline" as const, icon: Clock },
};

export function DocumentAnnotationsPanel({
	documentId,
	onClose,
	userName = "User",
	userType = "agent",
	isAnalyzing = false,
	onAnalyze,
}: DocumentAnnotationsPanelProps) {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("all");
	const [expandedAnnotations, setExpandedAnnotations] = useState<Set<number>>(
		new Set(),
	);
	const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});

	const { data: annotationsData, isLoading } = useQuery<{
		annotations: Annotation[];
	}>({
		queryKey: ["/api/esign/ai/annotations", documentId],
		enabled: !!documentId,
	});

	const annotations = annotationsData?.annotations || [];

	const updateStatusMutation = useMutation({
		mutationFn: async ({
			annotationId,
			status,
			rejectionReason,
		}: {
			annotationId: number;
			status: string;
			rejectionReason?: string;
		}) => {
			return apiRequest(`/api/esign/ai/annotations/${annotationId}/status`, {
				method: "PATCH",
				body: JSON.stringify({ status, rejectionReason }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/esign/ai/annotations", documentId],
			});
			toast({
				title: "Status updated",
				description: "Annotation status has been updated.",
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to update status.",
				variant: "destructive",
			});
		},
	});

	const addReplyMutation = useMutation({
		mutationFn: async ({
			annotationId,
			content,
		}: { annotationId: number; content: string }) => {
			return apiRequest(`/api/esign/ai/annotations/${annotationId}/replies`, {
				method: "POST",
				body: JSON.stringify({
					content,
					authorName: userName,
					authorType: userType,
				}),
			});
		},
		onSuccess: (_, variables) => {
			setReplyTexts((prev) => ({ ...prev, [variables.annotationId]: "" }));
			queryClient.invalidateQueries({
				queryKey: ["/api/esign/ai/annotations", documentId],
			});
			toast({
				title: "Reply added",
				description: "Your reply has been posted.",
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to add reply.",
				variant: "destructive",
			});
		},
	});

	const acceptAllMutation = useMutation({
		mutationFn: async () => {
			return apiRequest(`/api/esign/ai/annotations/0/accept-all`, {
				method: "POST",
				body: JSON.stringify({ documentId }),
			});
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/esign/ai/annotations", documentId],
			});
			toast({
				title: "All annotations accepted",
				description: `${data.acceptedCount} annotations have been accepted.`,
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to accept all.",
				variant: "destructive",
			});
		},
	});

	const toggleExpanded = (id: number) => {
		setExpandedAnnotations((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const filterAnnotations = (category?: string) => {
		if (!category || category === "all") return annotations;
		return annotations.filter((a) => a.category === category);
	};

	const getCounts = () => {
		const counts: Record<string, number> = { all: annotations.length };
		annotations.forEach((a) => {
			counts[a.category] = (counts[a.category] || 0) + 1;
		});
		return counts;
	};

	const counts = getCounts();
	const openCount = annotations.filter((a) => a.status === "open").length;

	if (isLoading) {
		return (
			<Card className="h-full">
				<CardHeader className="pb-3">
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent className="space-y-4">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-24 w-full" />
					))}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="pb-3 flex-shrink-0">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-lg">
						<Sparkles className="h-5 w-5 text-emerald-600" />
						AI Suggestions
						{annotations.length > 0 && (
							<Badge variant="secondary" className="ml-2">
								{annotations.length}
							</Badge>
						)}
					</CardTitle>
					{onClose && (
						<Button variant="ghost" size="icon" onClick={onClose}>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>

				{annotations.length === 0 && !isAnalyzing && onAnalyze && (
					<Button onClick={onAnalyze} className="mt-3 w-full" variant="outline">
						<Sparkles className="h-4 w-4 mr-2" />
						Analyze Document with AI
					</Button>
				)}

				{isAnalyzing && (
					<Alert className="mt-3">
						<Loader2 className="h-4 w-4 animate-spin" />
						<AlertDescription>Analyzing document with AI...</AlertDescription>
					</Alert>
				)}

				{openCount > 0 && (
					<div className="flex gap-2 mt-3">
						<Button
							size="sm"
							variant="outline"
							onClick={() => acceptAllMutation.mutate()}
							disabled={acceptAllMutation.isPending}
						>
							{acceptAllMutation.isPending ? (
								<Loader2 className="h-4 w-4 mr-1 animate-spin" />
							) : (
								<CheckCircle2 className="h-4 w-4 mr-1" />
							)}
							Accept All ({openCount})
						</Button>
					</div>
				)}
			</CardHeader>

			<CardContent className="flex-1 overflow-hidden flex flex-col pt-0">
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="flex flex-col h-full"
				>
					<ScrollableTabsList className="mb-3 flex-shrink-0">
						<TabsTrigger value="all" className="text-xs">
							All {counts.all > 0 && `(${counts.all})`}
						</TabsTrigger>
						{Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
							<TabsTrigger key={key} value={key} className="text-xs">
								<config.icon className={cn("h-3 w-3 mr-1", config.color)} />
								{config.label} {counts[key] > 0 && `(${counts[key]})`}
							</TabsTrigger>
						))}
					</ScrollableTabsList>

					<div className="flex-1 overflow-y-auto">
						<TabsContent value={activeTab} className="mt-0 space-y-3">
							{filterAnnotations(activeTab === "all" ? undefined : activeTab)
								.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
									<p>No annotations in this category</p>
								</div>
							) : (
								filterAnnotations(
									activeTab === "all" ? undefined : activeTab,
								).map((annotation) => (
									<AnnotationCard
										key={annotation.id}
										annotation={annotation}
										isExpanded={expandedAnnotations.has(annotation.id)}
										onToggle={() => toggleExpanded(annotation.id)}
										onAccept={() =>
											updateStatusMutation.mutate({
												annotationId: annotation.id,
												status: "accepted",
											})
										}
										onReject={(reason) =>
											updateStatusMutation.mutate({
												annotationId: annotation.id,
												status: "rejected",
												rejectionReason: reason,
											})
										}
										replyText={replyTexts[annotation.id] || ""}
										onReplyChange={(text) =>
											setReplyTexts((prev) => ({
												...prev,
												[annotation.id]: text,
											}))
										}
										onSendReply={() => {
											if (replyTexts[annotation.id]?.trim()) {
												addReplyMutation.mutate({
													annotationId: annotation.id,
													content: replyTexts[annotation.id],
												});
											}
										}}
										isUpdating={updateStatusMutation.isPending}
										isSendingReply={addReplyMutation.isPending}
									/>
								))
							)}
						</TabsContent>
					</div>
				</Tabs>
			</CardContent>
		</Card>
	);
}

interface AnnotationCardProps {
	annotation: Annotation;
	isExpanded: boolean;
	onToggle: () => void;
	onAccept: () => void;
	onReject: (reason?: string) => void;
	replyText: string;
	onReplyChange: (text: string) => void;
	onSendReply: () => void;
	isUpdating: boolean;
	isSendingReply: boolean;
}

function AnnotationCard({
	annotation,
	isExpanded,
	onToggle,
	onAccept,
	onReject,
	replyText,
	onReplyChange,
	onSendReply,
	isUpdating,
	isSendingReply,
}: AnnotationCardProps) {
	const [showRejectReason, setShowRejectReason] = useState(false);
	const [rejectReason, setRejectReason] = useState("");

	const categoryConfig =
		CATEGORY_CONFIG[annotation.category as keyof typeof CATEGORY_CONFIG] ||
		CATEGORY_CONFIG.general;
	const CategoryIcon = categoryConfig.icon;
	const statusConfig =
		STATUS_BADGES[annotation.status as keyof typeof STATUS_BADGES] ||
		STATUS_BADGES.open;
	const StatusIcon = statusConfig.icon;

	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<div
				className={cn(
					"border rounded-lg p-3 transition-all",
					SEVERITY_STYLES[
						annotation.severity as keyof typeof SEVERITY_STYLES
					] || SEVERITY_STYLES.info,
				)}
			>
				<CollapsibleTrigger asChild>
					<div className="flex items-start gap-3 cursor-pointer">
						<div className="flex-shrink-0 mt-0.5">
							<CategoryIcon className={cn("h-4 w-4", categoryConfig.color)} />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 flex-wrap">
								<span className="font-medium text-sm">{annotation.title}</span>
								<Badge variant={statusConfig.variant} className="text-xs">
									<StatusIcon className="h-3 w-3 mr-1" />
									{statusConfig.label}
								</Badge>
								{annotation.createdByType === "ai" && (
									<Badge variant="outline" className="text-xs">
										<Sparkles className="h-3 w-3 mr-1" />
										AI
									</Badge>
								)}
							</div>
							<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
								{annotation.content}
							</p>
						</div>
						<div className="flex-shrink-0">
							{isExpanded ? (
								<ChevronDown className="h-4 w-4 text-muted-foreground" />
							) : (
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							)}
						</div>
					</div>
				</CollapsibleTrigger>

				<CollapsibleContent className="mt-3 space-y-3">
					<div className="text-sm">{annotation.content}</div>

					{annotation.textExcerpt && (
						<div className="bg-muted/50 p-2 rounded text-sm italic border-l-2 border-muted-foreground/30">
							"{annotation.textExcerpt}"
						</div>
					)}

					{annotation.suggestedAction && (
						<div className="text-sm">
							<span className="font-medium">Suggested Action: </span>
							{annotation.suggestedAction}
						</div>
					)}

					{annotation.suggestedReplacement && (
						<div className="bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded text-sm border border-emerald-200 dark:border-emerald-800">
							<span className="font-medium text-emerald-700 dark:text-emerald-400">
								Suggested Text:{" "}
							</span>
							{annotation.suggestedReplacement}
						</div>
					)}

					{annotation.status === "open" && (
						<div className="flex gap-2 pt-2">
							<Button
								size="sm"
								onClick={onAccept}
								disabled={isUpdating}
								className="bg-emerald-600 hover:bg-emerald-700"
							>
								{isUpdating ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Check className="h-4 w-4 mr-1" />
								)}
								Accept
							</Button>
							{!showRejectReason ? (
								<Button
									size="sm"
									variant="outline"
									onClick={() => setShowRejectReason(true)}
									disabled={isUpdating}
								>
									<X className="h-4 w-4 mr-1" />
									Reject
								</Button>
							) : (
								<div className="flex-1 flex gap-2">
									<Textarea
										placeholder="Reason for rejection (optional)"
										value={rejectReason}
										onChange={(e) => setRejectReason(e.target.value)}
										className="text-sm h-8 min-h-[32px]"
									/>
									<Button
										size="sm"
										variant="destructive"
										onClick={() => {
											onReject(rejectReason);
											setShowRejectReason(false);
											setRejectReason("");
										}}
										disabled={isUpdating}
									>
										Confirm
									</Button>
								</div>
							)}
						</div>
					)}

					{(annotation.status === "accepted" ||
						annotation.status === "rejected") && (
						<div className="text-xs text-muted-foreground pt-2 border-t">
							{annotation.status === "accepted" && annotation.acceptedBy && (
								<span>
									Accepted by {annotation.acceptedBy}{" "}
									{annotation.acceptedAt &&
										`on ${format(new Date(annotation.acceptedAt), "MMM d, yyyy")}`}
								</span>
							)}
							{annotation.status === "rejected" && annotation.rejectedBy && (
								<div>
									<span>
										Rejected by {annotation.rejectedBy}{" "}
										{annotation.rejectedAt &&
											`on ${format(new Date(annotation.rejectedAt), "MMM d, yyyy")}`}
									</span>
									{annotation.rejectionReason && (
										<div className="mt-1">
											Reason: {annotation.rejectionReason}
										</div>
									)}
								</div>
							)}
						</div>
					)}

					<div className="pt-2 border-t">
						<div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
							<MessageSquare className="h-3 w-3" />
							Discussion
						</div>
						<div className="flex gap-2">
							<Textarea
								placeholder="Add a comment..."
								value={replyText}
								onChange={(e) => onReplyChange(e.target.value)}
								className="text-sm min-h-[60px]"
							/>
							<Button
								size="icon"
								onClick={onSendReply}
								disabled={!replyText.trim() || isSendingReply}
							>
								{isSendingReply ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Send className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

export default DocumentAnnotationsPanel;
