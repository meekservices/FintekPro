import { useState } from "react";
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
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
	ChevronDown,
	ChevronRight,
	Copy,
	GraduationCap,
	AlertCircle,
	MessageSquare,
	RefreshCw,
	Eye,
	EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface DiversificationScore {
	score: number;
	grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
	penalties: any[];
	stockExposures: any[];
	sectorExposures: any[];
}

interface TrainingPrompt {
	id: string;
	category:
		| "OVERLAP"
		| "DIVERSIFICATION"
		| "SIP"
		| "REPLACEMENT"
		| "GOAL"
		| "GENERAL";
	priority: "HIGH" | "MEDIUM" | "LOW";
	prompt: string;
	context: string;
	suggestedApproach: string;
	doNotSay: string[];
}

interface AdvisorTrainingPanelProps {
	diversificationScore: DiversificationScore;
	replaceFundSuggestions?: any[];
	sipRoutingApplied?: boolean;
	selectedGoal?: string;
	isAdvisor?: boolean;
}

const categoryConfig = {
	OVERLAP: {
		color:
			"bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
		icon: "🔄",
	},
	DIVERSIFICATION: {
		color:
			"bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
		icon: "📊",
	},
	SIP: {
		color:
			"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
		icon: "💰",
	},
	REPLACEMENT: {
		color:
			"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
		icon: "🔀",
	},
	GOAL: {
		color:
			"bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
		icon: "🎯",
	},
	GENERAL: {
		color: "bg-muted text-muted-foreground border-border",
		icon: "💬",
	},
};

const priorityConfig = {
	HIGH: "bg-red-500",
	MEDIUM: "bg-amber-500",
	LOW: "bg-green-500",
};

function TrainingPromptCard({ prompt }: { prompt: TrainingPrompt }) {
	const [isExpanded, setIsExpanded] = useState(false);
	const { toast } = useToast();
	const config = categoryConfig[prompt.category];

	const handleCopy = (text: string, label: string) => {
		navigator.clipboard.writeText(text);
		toast({ title: `${label} copied to clipboard` });
	};

	return (
		<div className="border rounded-lg overflow-hidden">
			<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
				<CollapsibleTrigger asChild>
					<div className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer">
						<Button variant="ghost" size="icon" className="h-5 w-5 p-0 mt-0.5">
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</Button>
						<div className="flex-1">
							<div className="flex items-center gap-2 mb-1">
								<div
									className={cn(
										"w-2 h-2 rounded-full",
										priorityConfig[prompt.priority],
									)}
								/>
								<Badge
									variant="outline"
									className={cn("text-xs", config.color)}
								>
									{config.icon} {prompt.category}
								</Badge>
								<span className="text-xs text-muted-foreground">
									{prompt.id}
								</span>
							</div>
							<p className="text-sm font-medium">{prompt.prompt}</p>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={(e) => {
								e.stopPropagation();
								handleCopy(prompt.suggestedApproach, "Approach");
							}}
						>
							<Copy className="h-3.5 w-3.5" />
						</Button>
					</div>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="px-3 pb-3 pt-0 space-y-3 bg-muted/30 border-t">
						<div className="pt-3">
							<p className="text-xs font-medium text-muted-foreground uppercase mb-1">
								Context
							</p>
							<p className="text-sm">{prompt.context}</p>
						</div>
						<div>
							<div className="flex items-center justify-between mb-1">
								<p className="text-xs font-medium text-muted-foreground uppercase">
									Suggested Approach
								</p>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 text-xs"
									onClick={() =>
										handleCopy(prompt.suggestedApproach, "Approach")
									}
								>
									<Copy className="h-3 w-3 mr-1" />
									Copy
								</Button>
							</div>
							<p className="text-sm p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
								{prompt.suggestedApproach}
							</p>
						</div>
						{prompt.doNotSay.length > 0 && (
							<div>
								<p className="text-xs font-medium text-red-600 uppercase mb-1 flex items-center gap-1">
									<AlertCircle className="h-3 w-3" />
									Do Not Say
								</p>
								<ul className="space-y-1">
									{prompt.doNotSay.map((item, idx) => (
										<li
											key={idx}
											className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded"
										>
											❌ "{item}"
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

export function AdvisorTrainingPanel({
	diversificationScore,
	replaceFundSuggestions = [],
	sipRoutingApplied = false,
	selectedGoal,
	isAdvisor = true,
}: AdvisorTrainingPanelProps) {
	const [isVisible, setIsVisible] = useState(true);

	const {
		data: trainingData,
		isLoading,
		refetch,
		error,
	} = useQuery<{ prompts: TrainingPrompt[]; totalPrompts: number }>({
		queryKey: ["/api/sip/training-prompts", diversificationScore.score],
		queryFn: async () => {
			const response = await fetch("/api/sip/training-prompts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					diversificationScore,
					replaceFundSuggestions,
					sipRoutingApplied,
					selectedGoal,
				}),
			});
			const result = await response.json();
			if (!result.success) throw new Error(result.error);
			return result.data;
		},
		enabled: isAdvisor,
		staleTime: 5 * 60 * 1000,
	});

	if (!isAdvisor) {
		return null; // Only show to advisors
	}

	return (
		<Card className="border-purple-200 dark:border-purple-800">
			<CardHeader className="pb-3 bg-purple-50 dark:bg-purple-950/30">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base flex items-center gap-2">
							<GraduationCap className="h-5 w-5 text-purple-600" />
							Advisor Training Prompts
						</CardTitle>
						<CardDescription>
							Conversation guides for client meetings (advisor-only)
						</CardDescription>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsVisible(!isVisible)}
						>
							{isVisible ? (
								<EyeOff className="h-3.5 w-3.5" />
							) : (
								<Eye className="h-3.5 w-3.5" />
							)}
						</Button>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							<RefreshCw className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			</CardHeader>
			{isVisible && (
				<CardContent className="pt-4">
					{isLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : error ? (
						<div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
							<div className="flex items-center gap-2">
								<AlertCircle className="h-4 w-4 text-red-500" />
								<p className="text-sm text-red-600 dark:text-red-400">
									Failed to generate training prompts.
								</p>
							</div>
						</div>
					) : trainingData?.prompts.length ? (
						<div className="space-y-3">
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<MessageSquare className="h-3.5 w-3.5" />
								<span>{trainingData.totalPrompts} prompts generated</span>
								<div className="flex items-center gap-1 ml-auto">
									<div className="w-2 h-2 rounded-full bg-red-500" />
									<span>High</span>
									<div className="w-2 h-2 rounded-full bg-amber-500 ml-2" />
									<span>Medium</span>
									<div className="w-2 h-2 rounded-full bg-green-500 ml-2" />
									<span>Low</span>
								</div>
							</div>
							{trainingData.prompts.map((prompt) => (
								<TrainingPromptCard key={prompt.id} prompt={prompt} />
							))}
							<div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center">
								<p className="text-xs text-purple-600">
									These prompts are for advisor preparation only and will not
									appear in client-facing documents.
								</p>
							</div>
						</div>
					) : (
						<div className="p-4 bg-muted/50 rounded-lg text-center">
							<p className="text-sm text-muted-foreground">
								No training prompts generated. Complete portfolio analysis
								first.
							</p>
						</div>
					)}
				</CardContent>
			)}
		</Card>
	);
}

export default AdvisorTrainingPanel;
