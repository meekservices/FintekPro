import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Brain,
	ShieldCheck,
	ShieldAlert,
	AlertTriangle,
	CheckCircle2,
	RefreshCw,
	Eye,
	UserCheck,
	Sparkles,
	BookOpen,
	ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AiGovernanceInspectorPage() {
	const { toast } = useToast();
	const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

	const { data: eventsResponse, refetch: refetchEvents, isLoading: eventsLoading } = useQuery<{
		success: boolean;
		data: any[];
	}>({
		queryKey: ["/api/admin/ai/governance-events"],
		refetchInterval: 15000,
	});

	const { data: promptsResponse, refetch: refetchPrompts, isLoading: promptsLoading } = useQuery<{
		prompts: any[];
		total: number;
	}>({
		queryKey: ["/api/admin/ai/prompts"],
		refetchInterval: 60000,
	});

	const downgradeMutation = useMutation({
		mutationFn: async ({ eventId, reason }: { eventId: string; reason: string }) => {
			const res = await apiRequest("POST", "/api/admin/ai/downgrade-advice", {
				eventId,
				reason,
			});
			return res.json();
		},
		onSuccess: (data) => {
			if (data.success) {
				toast({
					title: "Advisory Downgraded to Human RIA",
					description: "Recommendation has been quarantined and routed to a human advisor for review.",
				});
				setSelectedEvent(null);
				refetchEvents();
			}
		},
	});

	const events = eventsResponse?.data || [];
	const prompts = promptsResponse?.prompts || [];

	const approvedCount = events.filter((e) => e.governanceDecision === "APPROVED").length;
	const modifiedCount = events.filter((e) => e.governanceDecision === "MODIFIED").length;
	const blockedCount = events.filter((e) => e.governanceDecision === "BLOCKED").length;

	return (
		<AdminLayout>
			<div className="p-6 space-y-6 max-w-7xl mx-auto">
				{/* Header */}
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
							<Brain className="h-6 w-6 text-primary" />
							AI Advisory Governance & Lineage Inspector
						</h1>
						<p className="text-sm text-muted-foreground">
							FASP-AI v1.0 & SEBI RIA Compliance: Real-time interception, suitability matching, and deterministic language scanning.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								refetchEvents();
								refetchPrompts();
							}}
							className="gap-1.5"
						>
							<RefreshCw className="h-4 w-4" />
							Refresh
						</Button>
					</div>
				</div>

				{/* FASP-AI Non-Negotiable Mandate Banner */}
				<Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
					<CardContent className="p-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
							<div className="text-xs text-muted-foreground">
								<strong className="text-foreground">FASP-AI Core Mandate:</strong> AI is strictly a <strong>Decision Support System (DSS)</strong>. It is prohibited from autonomous trade execution or tax filings. Confidence threshold for autonomous advice presentation is <strong>≥ 0.75</strong>; all sub-threshold outputs are automatically downgraded.
							</div>
						</div>
						<Badge variant="outline" className="border-blue-400 text-blue-700 dark:text-blue-300 font-semibold whitespace-nowrap ml-4">
							SEBI RIA Reg 17
						</Badge>
					</CardContent>
				</Card>

				{/* Governance KPI Strip */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Intercepted Advice Cycles</CardDescription>
							<CardTitle className="text-2xl font-bold text-foreground">
								{events.length}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-muted-foreground">
							100% intercepted by AAGE prior to client view
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Approved (Compliant)</CardDescription>
							<CardTitle className="text-2xl font-bold text-emerald-600">
								{approvedCount}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-muted-foreground">
							Suitability matched & clean language
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Modified (Auto-Scrubbed)</CardDescription>
							<CardTitle className="text-2xl font-bold text-amber-600">
								{modifiedCount}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-muted-foreground">
							Deterministic claims converted to disclaimers
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Blocked (Unsuitable Risk)</CardDescription>
							<CardTitle className="text-2xl font-bold text-red-600">
								{blockedCount}
							</CardTitle>
						</CardHeader>
						<CardContent className="text-xs text-muted-foreground">
							Risk mismatch or low confidence score
						</CardContent>
					</Card>
				</div>

				<Tabs defaultValue="decisions" className="space-y-4">
					<TabsList>
						<TabsTrigger value="decisions" className="gap-1.5">
							<Brain className="h-4 w-4" />
							Advisory Interception Stream
						</TabsTrigger>
						<TabsTrigger value="prompts" className="gap-1.5">
							<BookOpen className="h-4 w-4" />
							Prompt Inventory & Review
						</TabsTrigger>
					</TabsList>

					{/* Decisions Tab */}
					<TabsContent value="decisions" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Real-Time AI Advisory Decision Ledger</CardTitle>
								<CardDescription>
									Detailed lineage of inputs, confidence scores, suitability checks, and governance decisions.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{eventsLoading ? (
									<div className="py-8 text-center text-muted-foreground">Loading AI governance feed...</div>
								) : events.length === 0 ? (
									<div className="py-8 text-center text-muted-foreground">No recent AI advisory events intercepted.</div>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Time</TableHead>
												<TableHead>Client vs Asset Risk</TableHead>
												<TableHead>Query & Recommendation</TableHead>
												<TableHead>Confidence</TableHead>
												<TableHead>Language Scan</TableHead>
												<TableHead>Decision</TableHead>
												<TableHead className="text-right">Action</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{events.map((event: any) => (
												<TableRow key={event.id}>
													<TableCell className="text-xs text-muted-foreground whitespace-nowrap">
														{new Date(event.timestamp).toLocaleTimeString()}
													</TableCell>
													<TableCell>
														<div className="text-xs">
															<span className="text-muted-foreground">Client: </span>
															<strong className="capitalize">{event.clientRisk}</strong>
														</div>
														<div className="text-xs">
															<span className="text-muted-foreground">Asset: </span>
															<span className={event.clientRisk === event.recommendedAssetRisk ? "text-emerald-600 font-semibold capitalize" : "text-red-500 font-semibold capitalize"}>
																{event.recommendedAssetRisk}
															</span>
														</div>
													</TableCell>
													<TableCell className="max-w-md">
														<div className="text-xs font-semibold text-foreground line-clamp-1">{event.query}</div>
														<div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{event.recommendation}</div>
														<div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
															Factors: {event.factorsConsidered?.join(" • ")}
														</div>
													</TableCell>
													<TableCell>
														<Badge
															className={
																event.confidenceScore >= 0.75
																	? "bg-emerald-500 text-white font-mono"
																	: "bg-red-500 text-white font-mono"
															}
														>
															{(event.confidenceScore * 100).toFixed(0)}%
														</Badge>
													</TableCell>
													<TableCell>
														<Badge
															variant="outline"
															className={
																event.deterministicLanguageScan === "CLEAN"
																	? "text-emerald-600 border-emerald-300 text-xs"
																	: "text-red-600 border-red-300 text-xs font-bold"
															}
														>
															{event.deterministicLanguageScan}
														</Badge>
													</TableCell>
													<TableCell>
														<Badge
															className={
																event.governanceDecision === "APPROVED"
																	? "bg-emerald-600 text-white text-xs font-bold"
																	: event.governanceDecision === "MODIFIED"
																		? "bg-amber-600 text-white text-xs font-bold"
																		: "bg-red-600 text-white text-xs font-bold"
															}
														>
															{event.governanceDecision}
														</Badge>
													</TableCell>
													<TableCell className="text-right">
														<Button
															variant="outline"
															size="sm"
															onClick={() => setSelectedEvent(event)}
															className="text-xs h-7"
														>
															Inspect
														</Button>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					{/* Prompts Tab */}
					<TabsContent value="prompts" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">AI Prompt Inventory & SEBI Review Matrix</CardTitle>
								<CardDescription>
									Review cycle compliance. Prompts must be reviewed quarterly (&lt; 90 days).
								</CardDescription>
							</CardHeader>
							<CardContent>
								{promptsLoading ? (
									<div className="py-8 text-center text-muted-foreground">Loading prompt inventory...</div>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Prompt Name</TableHead>
												<TableHead>Version</TableHead>
												<TableHead>Regulatory Category</TableHead>
												<TableHead>Last Reviewed</TableHead>
												<TableHead>Days Since Review</TableHead>
												<TableHead>Freshness</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{prompts.map((p: any) => (
												<TableRow key={p.name}>
													<TableCell className="font-semibold text-xs">{p.name}</TableCell>
													<TableCell className="font-mono text-xs">{p.version}</TableCell>
													<TableCell className="text-xs text-muted-foreground capitalize">
														{p.regulatoryCategory || "general"}
													</TableCell>
													<TableCell className="text-xs text-muted-foreground">
														{new Date(p.lastReviewedAt).toLocaleDateString()} by {p.reviewedBy}
													</TableCell>
													<TableCell className="text-xs font-medium">{p.daysSinceReview} days</TableCell>
													<TableCell>
														<Badge
															className={
																p.freshness === "green"
																	? "bg-emerald-500 text-white"
																	: p.freshness === "amber"
																		? "bg-amber-500 text-white"
																		: "bg-red-500 text-white"
															}
														>
															{p.freshness.toUpperCase()}
														</Badge>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				{/* Event Inspection & Downgrade Modal */}
				<Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
					<DialogContent className="max-w-xl">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Brain className="h-5 w-5 text-primary" />
								AI Advisory Forensic Inspection
							</DialogTitle>
							<DialogDescription>
								Inspection ID: {selectedEvent?.id} | Model: {selectedEvent?.modelVersion}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-2 text-xs">
							<div className="p-3 rounded-lg border bg-muted/30 space-y-1">
								<div><strong>Query:</strong> {selectedEvent?.query}</div>
								<div><strong>AI Output:</strong> {selectedEvent?.recommendation}</div>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="p-2.5 border rounded-md">
									<div className="text-muted-foreground">Suitability Match</div>
									<div className="font-bold text-sm mt-0.5">
										Client: {selectedEvent?.clientRisk} → Asset: {selectedEvent?.recommendedAssetRisk}
									</div>
								</div>
								<div className="p-2.5 border rounded-md">
									<div className="text-muted-foreground">Confidence Score</div>
									<div className="font-bold text-sm mt-0.5">
										{(selectedEvent?.confidenceScore * 100).toFixed(0)}% (Threshold: 75%)
									</div>
								</div>
							</div>

							<div className="p-3 border rounded-md bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200">
								<strong>AAGE Regulatory Audit Note:</strong>
								<p className="mt-1">{selectedEvent?.regulatoryNotes}</p>
							</div>
						</div>
						<DialogFooter className="gap-2 sm:gap-0">
							<Button variant="outline" onClick={() => setSelectedEvent(null)}>
								Close
							</Button>
							<Button
								variant="destructive"
								disabled={downgradeMutation.isPending}
								onClick={() =>
									downgradeMutation.mutate({
										eventId: selectedEvent.id,
										reason: "Manually quarantined by Administrator from AI Governance Inspector",
									})
								}
							>
								{downgradeMutation.isPending ? "Downgrading..." : "Downgrade to Human RIA"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</AdminLayout>
	);
}
