import { useState } from "react";
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
import {
	AlertTriangle,
	Building2,
	Check,
	Copy,
	Edit3,
	MessageSquare,
	RefreshCw,
	Shield as LucideShield,
	TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AdvisorTalkingPoint {
	type:
		| "OVERLAP_RISK"
		| "REPLACE_FUND"
		| "DIVERSIFICATION"
		| "SECTOR_CONCENTRATION";
	priority: "HIGH" | "MEDIUM" | "LOW";
	text: string;
	data?: Record<string, any>;
}

interface AdvisorTalkingPointsProps {
	talkingPoints: AdvisorTalkingPoint[];
	editable?: boolean;
	onPointsChange?: (points: AdvisorTalkingPoint[]) => void;
	onInsertToPdf?: (points: AdvisorTalkingPoint[]) => void;
}

const typeConfig = {
	OVERLAP_RISK: {
		icon: AlertTriangle,
		color: "text-red-600",
		bg: "bg-red-50 dark:bg-red-950/30",
	},
	REPLACE_FUND: {
		icon: RefreshCw,
		color: "text-amber-600",
		bg: "bg-amber-50 dark:bg-amber-950/30",
	},
	DIVERSIFICATION: {
		icon: LucideShield,
		color: "text-blue-600",
		bg: "bg-blue-50 dark:bg-blue-950/30",
	},
	SECTOR_CONCENTRATION: {
		icon: Building2,
		color: "text-purple-600",
		bg: "bg-purple-50 dark:bg-purple-950/30",
	},
};

const priorityConfig = {
	HIGH: {
		color:
			"bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
	},
	MEDIUM: {
		color:
			"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
	},
	LOW: {
		color:
			"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
	},
};

function TalkingPointCard({
	point,
	index,
	editable,
	onEdit,
	onRemove,
}: {
	point: AdvisorTalkingPoint;
	index: number;
	editable?: boolean;
	onEdit?: (index: number, newText: string) => void;
	onRemove?: (index: number) => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editText, setEditText] = useState(point.text);
	const { toast } = useToast();
	const config = typeConfig[point.type];
	const priorityStyle = priorityConfig[point.priority];
	const Icon = config.icon;

	const handleCopy = () => {
		navigator.clipboard.writeText(point.text);
		toast({ title: "Copied to clipboard" });
	};

	const handleSave = () => {
		if (onEdit) {
			onEdit(index, editText);
		}
		setIsEditing(false);
	};

	return (
		<div
			className={cn("p-3 rounded-lg border", config.bg, "border-opacity-50")}
		>
			<div className="flex items-start gap-3">
				<Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.color)} />
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						<Badge
							variant="outline"
							className={cn("text-xs", priorityStyle.color)}
						>
							{point.priority}
						</Badge>
						<span className="text-xs text-muted-foreground capitalize">
							{point.type.toLowerCase().replace(/_/g, " ")}
						</span>
					</div>
					{isEditing ? (
						<div className="space-y-2">
							<Textarea
								value={editText}
								onChange={(e) => setEditText(e.target.value)}
								className="min-h-[80px] text-sm"
							/>
							<div className="flex gap-2">
								<Button size="sm" onClick={handleSave}>
									<Check className="h-3.5 w-3.5 mr-1" />
									Save
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										setEditText(point.text);
										setIsEditing(false);
									}}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<p className="text-sm leading-relaxed">{point.text}</p>
					)}
				</div>
				{!isEditing && (
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={handleCopy}
						>
							<Copy className="h-3.5 w-3.5" />
						</Button>
						{editable && (
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								onClick={() => setIsEditing(true)}
							>
								<Edit3 className="h-3.5 w-3.5" />
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

export function AdvisorTalkingPoints({
	talkingPoints,
	editable = true,
	onPointsChange,
	onInsertToPdf,
}: AdvisorTalkingPointsProps) {
	const { toast } = useToast();

	const handleEdit = (index: number, newText: string) => {
		if (onPointsChange) {
			const updated = [...talkingPoints];
			updated[index] = { ...updated[index], text: newText };
			onPointsChange(updated);
		}
	};

	const handleRemove = (index: number) => {
		if (onPointsChange) {
			const updated = talkingPoints.filter((_, i) => i !== index);
			onPointsChange(updated);
		}
	};

	const handleCopyAll = () => {
		const text = talkingPoints.map((p) => `• ${p.text}`).join("\n\n");
		navigator.clipboard.writeText(text);
		toast({ title: "All points copied to clipboard" });
	};

	if (!talkingPoints.length) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<MessageSquare className="h-5 w-5 text-primary" />
						Advisor Talking Points
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="p-4 bg-muted/50 rounded-lg text-center">
						<p className="text-sm text-muted-foreground">
							No talking points generated. Portfolio analysis will auto-generate
							recommendations.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	const highPriority = talkingPoints.filter((p) => p.priority === "HIGH");
	const otherPoints = talkingPoints.filter((p) => p.priority !== "HIGH");

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base flex items-center gap-2">
							<MessageSquare className="h-5 w-5 text-primary" />
							Advisor Talking Points
						</CardTitle>
						<CardDescription>
							Auto-generated explanations for client conversations
						</CardDescription>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" onClick={handleCopyAll}>
							<Copy className="h-3.5 w-3.5 mr-1" />
							Copy All
						</Button>
						{onInsertToPdf && (
							<Button size="sm" onClick={() => onInsertToPdf(talkingPoints)}>
								<TrendingUp className="h-3.5 w-3.5 mr-1" />
								Add to Proposal
							</Button>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				{highPriority.length > 0 && (
					<div className="space-y-2">
						<h4 className="text-xs font-medium text-red-600 uppercase tracking-wide">
							Key Points
						</h4>
						{highPriority.map((point, idx) => (
							<TalkingPointCard
								key={idx}
								point={point}
								index={talkingPoints.indexOf(point)}
								editable={editable}
								onEdit={handleEdit}
								onRemove={handleRemove}
							/>
						))}
					</div>
				)}
				{otherPoints.length > 0 && (
					<div className="space-y-2">
						{highPriority.length > 0 && (
							<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
								Additional Points
							</h4>
						)}
						{otherPoints.map((point, idx) => (
							<TalkingPointCard
								key={idx}
								point={point}
								index={talkingPoints.indexOf(point)}
								editable={editable}
								onEdit={handleEdit}
								onRemove={handleRemove}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default AdvisorTalkingPoints;
