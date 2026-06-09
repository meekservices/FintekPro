import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
	Lightbulb,
	ChevronLeft,
	Search,
	Copy,
	Check,
	Sparkles,
	BookOpen,
	MessageSquare,
	Wand2,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ExplanationTemplate {
	id: string;
	topic: string;
	category: string;
	expertVersion: string;
	simplifiedVersion: string;
	keyPoints: string[];
	commonQuestions?: string[];
	usageCount: number;
	version: number;
	status: string;
}

const categoryOptions = [
	{ value: "all", label: "All Categories" },
	{ value: "mutual_funds", label: "Mutual Funds" },
	{ value: "stocks", label: "Stocks" },
	{ value: "bonds", label: "Bonds" },
	{ value: "tax", label: "Tax Planning" },
	{ value: "risk", label: "Risk Management" },
	{ value: "general", label: "General" },
];

export default function AgentKnowledgeExplanations() {
	const [searchTerm, setSearchTerm] = useState("");
	const [category, setCategory] = useState("all");
	const [selectedTemplate, setSelectedTemplate] =
		useState<ExplanationTemplate | null>(null);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [simplifyDialogOpen, setSimplifyDialogOpen] = useState(false);
	const [customText, setCustomText] = useState("");
	const [simplifiedResult, setSimplifiedResult] = useState("");
	const { toast } = useToast();

	const { data: templates, isLoading } = useQuery<ExplanationTemplate[]>({
		queryKey: ["/api/knowledge-hub/explanations", category],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (category !== "all") params.append("category", category);
			params.append("status", "published");
			const response = await fetch(`/api/knowledge-hub/explanations?${params}`);
			if (!response.ok) throw new Error("Failed to fetch templates");
			return response.json();
		},
	});

	const simplifyMutation = useMutation({
		mutationFn: async (text: string) => {
			const response = await apiRequest("POST", "/api/knowledge-hub/simplify", {
				text,
			});
			return response.json();
		},
		onSuccess: (data) => {
			setSimplifiedResult(data.simplified);
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to simplify text. Please try again.",
				variant: "destructive",
			});
		},
	});

	const usageTrackMutation = useMutation({
		mutationFn: async (templateId: string) => {
			await apiRequest(
				"POST",
				`/api/knowledge-hub/explanations/${templateId}/use`,
			);
		},
	});

	const filteredTemplates = templates?.filter(
		(t) =>
			t.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
			t.expertVersion.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const copyToClipboard = async (text: string, templateId: string) => {
		await navigator.clipboard.writeText(text);
		setCopiedId(templateId);
		usageTrackMutation.mutate(templateId);
		setTimeout(() => setCopiedId(null), 2000);
		toast({
			title: "Copied!",
			description: "Explanation copied to clipboard",
		});
	};

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link href="/agent/knowledge-hub">
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground"
						>
							<ChevronLeft className="h-4 w-4 mr-1" />
							Back
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
							<Lightbulb className="h-7 w-7 text-amber-500" />
							Client Explanation Templates
						</h1>
						<p className="text-muted-foreground mt-1">
							Ready-to-use explanations for client communication
						</p>
					</div>
				</div>
				<Button
					onClick={() => setSimplifyDialogOpen(true)}
					className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
					data-testid="button-ai-simplify"
				>
					<Wand2 className="h-4 w-4 mr-2" />
					AI Simplify
				</Button>
			</div>

			<div className="flex flex-col md:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search explanations..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-10 bg-background border-border text-foreground"
						data-testid="input-search"
					/>
				</div>
				<Select value={category} onValueChange={setCategory}>
					<SelectTrigger
						className="w-48 bg-background border-border"
						data-testid="select-category"
					>
						<SelectValue placeholder="Category" />
					</SelectTrigger>
					<SelectContent>
						{categoryOptions.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{isLoading ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-40 bg-card" />
					))}
				</div>
			) : filteredTemplates && filteredTemplates.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{filteredTemplates.map((template) => (
						<Card
							key={template.id}
							className="bg-background border-border hover:border-border transition-colors"
							data-testid={`card-template-${template.id}`}
						>
							<CardHeader className="pb-2">
								<div className="flex items-start justify-between">
									<CardTitle className="text-foreground text-lg">
										{template.topic}
									</CardTitle>
									<Badge variant="outline" className="text-xs border-border">
										{template.category}
									</Badge>
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground text-sm line-clamp-3 mb-4">
									{template.simplifiedVersion}
								</p>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<MessageSquare className="h-3 w-3" />
										Used {template.usageCount} times
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											className="border-border"
											onClick={() => setSelectedTemplate(template)}
										>
											View Full
										</Button>
										<Button
											size="sm"
											className="bg-emerald-600 hover:bg-emerald-700"
											onClick={() =>
												copyToClipboard(template.simplifiedVersion, template.id)
											}
										>
											{copiedId === template.id ? (
												<Check className="h-4 w-4" />
											) : (
												<Copy className="h-4 w-4" />
											)}
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<Card className="bg-background border-border">
					<CardContent className="p-8 text-center">
						<BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-xl font-semibold text-foreground mb-2">
							No Templates Found
						</h3>
						<p className="text-muted-foreground">
							{searchTerm
								? "Try adjusting your search or category filter"
								: "Explanation templates will appear here once added"}
						</p>
					</CardContent>
				</Card>
			)}

			<Dialog
				open={!!selectedTemplate}
				onOpenChange={() => setSelectedTemplate(null)}
			>
				<DialogContent className="max-w-2xl max-h-[90vh] bg-background border-border">
					{selectedTemplate && (
						<>
							<DialogHeader>
								<DialogTitle className="text-foreground text-xl">
									{selectedTemplate.topic}
								</DialogTitle>
								<DialogDescription className="text-muted-foreground">
									{selectedTemplate.category} • v{selectedTemplate.version}
								</DialogDescription>
							</DialogHeader>
							<ScrollArea className="max-h-[60vh]">
								<div className="space-y-6">
									<div>
										<h4 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
											<Sparkles className="h-4 w-4" />
											Simplified Version (for clients)
										</h4>
										<div className="p-4 bg-card rounded-lg relative">
											<p className="text-muted-foreground pr-8">
												{selectedTemplate.simplifiedVersion}
											</p>
											<Button
												size="sm"
												variant="ghost"
												className="absolute top-2 right-2"
												onClick={() =>
													copyToClipboard(
														selectedTemplate.simplifiedVersion,
														selectedTemplate.id,
													)
												}
											>
												{copiedId === selectedTemplate.id ? (
													<Check className="h-4 w-4 text-emerald-500" />
												) : (
													<Copy className="h-4 w-4" />
												)}
											</Button>
										</div>
									</div>

									<div>
										<h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
											<BookOpen className="h-4 w-4" />
											Expert Version (technical details)
										</h4>
										<div className="p-4 bg-card/50 rounded-lg">
											<p className="text-muted-foreground text-sm">
												{selectedTemplate.expertVersion}
											</p>
										</div>
									</div>

									{selectedTemplate.keyPoints.length > 0 && (
										<div>
											<h4 className="text-sm font-medium text-muted-foreground mb-2">
												Key Points
											</h4>
											<ul className="space-y-1">
												{selectedTemplate.keyPoints.map((point, idx) => (
													<li
														key={idx}
														className="text-muted-foreground text-sm flex items-start gap-2"
													>
														<span className="text-emerald-500 mt-1">•</span>
														{point}
													</li>
												))}
											</ul>
										</div>
									)}

									{selectedTemplate.commonQuestions &&
										selectedTemplate.commonQuestions.length > 0 && (
											<div>
												<h4 className="text-sm font-medium text-muted-foreground mb-2">
													Common Questions
												</h4>
												<ul className="space-y-1">
													{selectedTemplate.commonQuestions.map((q, idx) => (
														<li
															key={idx}
															className="text-muted-foreground text-sm flex items-start gap-2"
														>
															<span className="text-blue-500">Q:</span>
															{q}
														</li>
													))}
												</ul>
											</div>
										)}
								</div>
							</ScrollArea>
						</>
					)}
				</DialogContent>
			</Dialog>

			<Dialog open={simplifyDialogOpen} onOpenChange={setSimplifyDialogOpen}>
				<DialogContent className="max-w-2xl bg-background border-border">
					<DialogHeader>
						<DialogTitle className="text-foreground flex items-center gap-2">
							<Wand2 className="h-5 w-5 text-purple-500" />
							AI Text Simplifier
						</DialogTitle>
						<DialogDescription className="text-muted-foreground">
							Paste complex financial jargon and get a client-friendly
							explanation
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<label className="text-sm text-muted-foreground mb-2 block">
								Complex Text
							</label>
							<Textarea
								placeholder="Paste the technical explanation here..."
								value={customText}
								onChange={(e) => setCustomText(e.target.value)}
								className="bg-card border-border text-foreground min-h-32"
								data-testid="textarea-complex"
							/>
						</div>
						<Button
							className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
							disabled={!customText.trim() || simplifyMutation.isPending}
							onClick={() => simplifyMutation.mutate(customText)}
							data-testid="button-simplify"
						>
							{simplifyMutation.isPending ? (
								"Simplifying..."
							) : (
								<>
									<Sparkles className="h-4 w-4 mr-2" />
									Simplify with AI
								</>
							)}
						</Button>
						{simplifiedResult && (
							<div>
								<label className="text-sm text-emerald-400 mb-2 block flex items-center gap-2">
									<Check className="h-4 w-4" />
									Simplified Version
								</label>
								<div className="p-4 bg-card rounded-lg relative">
									<p className="text-muted-foreground pr-8">
										{simplifiedResult}
									</p>
									<Button
										size="sm"
										variant="ghost"
										className="absolute top-2 right-2"
										onClick={() => {
											navigator.clipboard.writeText(simplifiedResult);
											toast({
												title: "Copied!",
												description: "Simplified text copied",
											});
										}}
									>
										<Copy className="h-4 w-4" />
									</Button>
								</div>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
