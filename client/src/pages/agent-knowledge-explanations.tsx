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
import { apiRequest } from "@/lib/queryClient";

interface ExplanationTemplate {
	id: string;
	title?: string;
	topic?: string;
	category: string;
	whatIsHappening?: string;
	whyItMatters?: string;
	clientImpact?: string;
	risks?: string;
	whatIsNotClaimed?: string;
	technicalVersion?: string;
	expertVersion?: string;
	simpleVersion?: string;
	simplifiedVersion?: string;
	keyPoints?: string[];
	commonQuestions?: string[];
	applicableProducts?: string[];
	applicableScenarios?: string[];
	usageCount?: number;
	version?: number;
	status?: string;
}

const categoryOptions = [
	{ value: "all", label: "All Categories" },
	{ value: "product_explanation", label: "Product & Concept Explanations" },
	{ value: "market_movement", label: "Market Volatility & SIPs" },
	{ value: "suitability_rationale", label: "Asset Allocation & Suitability" },
	{ value: "risk_disclosure", label: "Taxation & Risk Disclosures" },
	{ value: "alternatives_rejected", label: "Alternatives & Rebuttals" },
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

	const filteredTemplates = templates?.filter((t) => {
		const title = t.title || t.topic || "";
		const expert = t.technicalVersion || t.expertVersion || t.whatIsHappening || "";
		const simple = t.simpleVersion || t.simplifiedVersion || t.whyItMatters || "";
		const search = searchTerm.toLowerCase();
		return (
			title.toLowerCase().includes(search) ||
			expert.toLowerCase().includes(search) ||
			simple.toLowerCase().includes(search)
		);
	});

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
					{filteredTemplates.map((template) => {
						const title = template.title || template.topic || "Untitled Explanation";
						const simpleText = template.simpleVersion || template.simplifiedVersion || template.whyItMatters || "";
						const categoryLabel = (template.category || "General").replace(/_/g, " ");

						return (
							<Card
								key={template.id}
								className="bg-background border-border hover:border-emerald-500/40 transition-colors"
								data-testid={`card-template-${template.id}`}
							>
								<CardHeader className="pb-2">
									<div className="flex items-start justify-between gap-2">
										<CardTitle className="text-foreground text-base font-semibold leading-snug">
											{title}
										</CardTitle>
										<Badge variant="outline" className="text-[10px] shrink-0 uppercase tracking-wider font-semibold border-border">
											{categoryLabel}
										</Badge>
									</div>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground text-sm line-clamp-3 mb-4 leading-relaxed">
										{simpleText}
									</p>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
											<MessageSquare className="h-3 w-3" />
											Used {template.usageCount || 0} times
										</div>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												className="border-border text-xs h-8"
												onClick={() => setSelectedTemplate(template)}
											>
												View Full
											</Button>
											<Button
												size="sm"
												className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2.5"
												onClick={() =>
													copyToClipboard(simpleText, template.id)
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
						);
					})}
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
				<DialogContent className="max-w-4xl lg:max-w-5xl max-h-[92vh] bg-background border-border">
					{selectedTemplate && (() => {
						const title = selectedTemplate.title || selectedTemplate.topic || "Untitled Explanation";
						const simpleText = selectedTemplate.simpleVersion || selectedTemplate.simplifiedVersion || selectedTemplate.whyItMatters || "";
						const expertText = selectedTemplate.technicalVersion || selectedTemplate.expertVersion || selectedTemplate.whatIsHappening || "";
						const categoryLabel = (selectedTemplate.category || "General").replace(/_/g, " ");
						const points = selectedTemplate.keyPoints || [
							selectedTemplate.whatIsHappening && `What is Happening: ${selectedTemplate.whatIsHappening}`,
							selectedTemplate.whyItMatters && `Why it Matters: ${selectedTemplate.whyItMatters}`,
							selectedTemplate.clientImpact && `Client Impact: ${selectedTemplate.clientImpact}`,
						].filter(Boolean) as string[];

						return (
							<>
								<DialogHeader className="pb-3 border-b border-border/50">
									<div className="flex items-center justify-between gap-3 pr-6">
										<DialogTitle className="text-foreground text-xl font-bold">
											{title}
										</DialogTitle>
										<Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
											{categoryLabel}
										</Badge>
									</div>
									<DialogDescription className="text-muted-foreground">
										FASP-AI Client Advisory Playbook • v{selectedTemplate.version || 1}
									</DialogDescription>
								</DialogHeader>
								<ScrollArea className="max-h-[70vh] pr-2">
									<div className="space-y-6 pt-2">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<h4 className="text-sm font-semibold text-amber-500 mb-2 flex items-center gap-2">
													<Sparkles className="h-4 w-4" />
													Simplified Version (Client Pitch & WhatsApp)
												</h4>
												<div className="p-4 bg-card rounded-xl border border-border/70 relative h-[calc(100%-2rem)] flex flex-col justify-between">
													<p className="text-foreground text-sm leading-relaxed pr-8 whitespace-pre-line">
														{simpleText}
													</p>
													<Button
														size="sm"
														variant="ghost"
														className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
														onClick={() =>
															copyToClipboard(
																simpleText,
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
												<h4 className="text-sm font-semibold text-blue-500 mb-2 flex items-center gap-2">
													<BookOpen className="h-4 w-4" />
													Expert Version (Technical SEBI Definition)
												</h4>
												<div className="p-4 bg-card/60 rounded-xl border border-border/70 h-[calc(100%-2rem)]">
													<p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
														{expertText}
													</p>
												</div>
											</div>
										</div>

										{/* Risks & Safe Harbor Disclosure */}
										{(selectedTemplate.risks || selectedTemplate.whatIsNotClaimed) && (
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
												{selectedTemplate.risks && (
													<div className="p-3.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-1">
														<span className="text-[11px] font-bold uppercase tracking-wider text-rose-900 dark:text-rose-300">
															Key Risks & Constraints
														</span>
														<p className="text-xs text-rose-950 dark:text-rose-100 font-medium leading-relaxed">
															{selectedTemplate.risks}
														</p>
													</div>
												)}
												{selectedTemplate.whatIsNotClaimed && (
													<div className="p-3.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
														<span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
															SEBI Safe-Harbor (What is Not Claimed)
														</span>
														<p className="text-xs text-amber-950 dark:text-amber-100 font-medium leading-relaxed">
															{selectedTemplate.whatIsNotClaimed}
														</p>
													</div>
												)}
											</div>
										)}

										{points.length > 0 && (
											<div>
												<h4 className="text-sm font-medium text-foreground mb-2">
													Key Discussion Points
												</h4>
												<ul className="space-y-1.5">
													{points.map((point, idx) => (
														<li
															key={idx}
															className="text-muted-foreground text-xs sm:text-sm flex items-start gap-2"
														>
															<span className="text-emerald-500 mt-1 shrink-0">•</span>
															<span>{point}</span>
														</li>
													))}
												</ul>
											</div>
										)}

										{selectedTemplate.commonQuestions &&
											selectedTemplate.commonQuestions.length > 0 && (
												<div>
													<h4 className="text-sm font-medium text-foreground mb-2">
														Common Client Questions
													</h4>
													<ul className="space-y-1.5">
														{selectedTemplate.commonQuestions.map((q, idx) => (
															<li
																key={idx}
																className="text-muted-foreground text-xs sm:text-sm flex items-start gap-2"
															>
																<span className="text-blue-500 font-bold shrink-0">Q:</span>
																<span>{q}</span>
															</li>
														))}
													</ul>
												</div>
											)}
									</div>
								</ScrollArea>
							</>
						);
					})()}
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
							<span className="text-sm text-muted-foreground mb-2 block font-medium">
								Complex Text
							</span>
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
								<span className="text-sm text-emerald-400 mb-2 flex items-center gap-2 font-medium">
									<Check className="h-4 w-4" />
									Simplified Version
								</span>
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
