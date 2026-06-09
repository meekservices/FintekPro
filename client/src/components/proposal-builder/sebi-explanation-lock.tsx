import { useState, useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	AlertTriangle,
	Check,
	Copy,
	Edit3,
	FileText,
	Lock,
	Shield as LucideShield,
	X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SEBINarrative {
	type: string;
	narrative: string;
	disclaimer: string;
	isLocked: boolean;
	templateId: string;
}

interface AdvisorComment {
	id: string;
	text: string;
	createdAt: Date;
}

interface SEBIExplanationLockProps {
	narratives: SEBINarrative[];
	advisorComments?: AdvisorComment[];
	onAddComment?: (comment: string) => void;
	onRemoveComment?: (id: string) => void;
	showDisclaimer?: boolean;
}

function NarrativeCard({ narrative }: { narrative: SEBINarrative }) {
	const { toast } = useToast();

	const handleCopy = () => {
		navigator.clipboard.writeText(narrative.narrative);
		toast({ title: "Copied to clipboard" });
	};

	return (
		<div className="p-4 bg-muted/30 rounded-lg border">
			<div className="flex items-start justify-between gap-3">
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						<Badge
							variant="outline"
							className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
						>
							{narrative.type.replace(/_/g, " ")}
						</Badge>
						<Badge variant="outline" className="text-xs">
							{narrative.templateId}
						</Badge>
						{narrative.isLocked && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Lock className="h-3.5 w-3.5 text-amber-600" />
									</TooltipTrigger>
									<TooltipContent>
										<p className="text-xs">
											SEBI-compliant template - cannot be edited
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</div>
					<p className="text-sm leading-relaxed">{narrative.narrative}</p>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={handleCopy}
				>
					<Copy className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

export function SEBIExplanationLock({
	narratives,
	advisorComments = [],
	onAddComment,
	onRemoveComment,
	showDisclaimer = true,
}: SEBIExplanationLockProps) {
	const { toast } = useToast();
	const [newComment, setNewComment] = useState("");
	const [isAddingComment, setIsAddingComment] = useState(false);

	const handleAddComment = () => {
		if (newComment.trim() && onAddComment) {
			onAddComment(newComment.trim());
			setNewComment("");
			setIsAddingComment(false);
			toast({ title: "Comment added" });
		}
	};

	const handleCopyAll = () => {
		const text = narratives.map((n) => n.narrative).join("\n\n");
		navigator.clipboard.writeText(text);
		toast({ title: "All narratives copied" });
	};

	// Collect all unique disclaimers
	const uniqueDisclaimers = useMemo(() => {
		const disclaimerSet = new Set<string>();
		narratives.forEach((n) => {
			if (n.disclaimer) disclaimerSet.add(n.disclaimer);
		});
		return Array.from(disclaimerSet);
	}, [narratives]);

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base flex items-center gap-2">
							<LucideShield className="h-5 w-5 text-primary" />
							SEBI-Compliant Explanations
						</CardTitle>
						<CardDescription>
							Pre-approved templates for regulatory compliance
						</CardDescription>
					</div>
					<Button variant="outline" size="sm" onClick={handleCopyAll}>
						<Copy className="h-3.5 w-3.5 mr-1" />
						Copy All
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Locked SEBI narratives */}
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<Lock className="h-4 w-4 text-amber-600" />
						<h4 className="text-sm font-medium">Locked Templates</h4>
					</div>
					{narratives.map((narrative, idx) => (
						<NarrativeCard key={idx} narrative={narrative} />
					))}
				</div>

				<Separator />

				{/* Advisor comments section */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Edit3 className="h-4 w-4 text-green-600" />
							<h4 className="text-sm font-medium">Advisor Comments</h4>
							<Badge
								variant="outline"
								className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
							>
								Editable
							</Badge>
						</div>
						{!isAddingComment && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsAddingComment(true)}
							>
								<Edit3 className="h-3.5 w-3.5 mr-1" />
								Add Comment
							</Button>
						)}
					</div>

					{isAddingComment && (
						<div className="space-y-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
							<Textarea
								value={newComment}
								onChange={(e) => setNewComment(e.target.value)}
								placeholder="Add your personalized notes for the client..."
								className="min-h-[80px]"
							/>
							<div className="flex gap-2">
								<Button
									size="sm"
									onClick={handleAddComment}
									disabled={!newComment.trim()}
								>
									<Check className="h-3.5 w-3.5 mr-1" />
									Save
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										setNewComment("");
										setIsAddingComment(false);
									}}
								>
									<X className="h-3.5 w-3.5 mr-1" />
									Cancel
								</Button>
							</div>
						</div>
					)}

					{advisorComments.length > 0 ? (
						<div className="space-y-2">
							{advisorComments.map((comment) => (
								<div
									key={comment.id}
									className="flex items-start justify-between p-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg border border-green-100"
								>
									<p className="text-sm flex-1">{comment.text}</p>
									{onRemoveComment && (
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6"
											onClick={() => onRemoveComment(comment.id)}
										>
											<X className="h-3 w-3" />
										</Button>
									)}
								</div>
							))}
						</div>
					) : (
						!isAddingComment && (
							<p className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
								No advisor comments added. These appear separately in the
								proposal PDF.
							</p>
						)
					)}
				</div>

				{/* Mandatory disclaimers - show all unique ones */}
				{showDisclaimer && uniqueDisclaimers.length > 0 && (
					<>
						<Separator />
						<div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
							<div className="flex items-start gap-2">
								<AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
								<div className="space-y-2">
									<p className="text-xs font-medium text-amber-700 dark:text-amber-300">
										Mandatory Disclaimer
										{uniqueDisclaimers.length > 1 ? "s" : ""}
									</p>
									{uniqueDisclaimers.map((disclaimer, idx) => (
										<p key={idx} className="text-xs text-amber-600">
											{disclaimer}
										</p>
									))}
								</div>
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

export default SEBIExplanationLock;
