import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	FlaskConical,
	Users,
	TrendingUp,
	AlertTriangle,
	Shield as LucideShield,
	Activity,
	Power,
	PowerOff,
	Settings,
	BarChart3,
	Clock,
	Target,
} from "lucide-react";

interface ExperimentMetrics {
	experimentId: string;
	groupA: GroupMetrics;
	groupB: GroupMetrics;
	statisticalSignificance?: number;
}

interface GroupMetrics {
	clientCount: number;
	recommendationAcceptanceRate: number;
	avgAllocationToGrowthAssets: number;
	avgTimeToDecision: number;
	aiExplanationEngagement: number;
}

interface ExperimentSummary {
	activeExperiment: any | null;
	totalAssignments: number;
	groupACount: number;
	groupBCount: number;
	safetyStatus: { safe: boolean; violations: string[] };
}

interface SafetyThresholds {
	maxDrawdown: number;
	maxComplaintRate: number;
	maxRestrictedAssetExposure: number;
}

export function ABTestingDashboard({ className = "" }: { className?: string }) {
	const { toast } = useToast();
	const [killSwitchDialogOpen, setKillSwitchDialogOpen] = useState(false);
	const [killSwitchReason, setKillSwitchReason] = useState("");

	const { data: summaryData, isLoading: summaryLoading } = useQuery<{
		success: boolean;
		summary: ExperimentSummary;
	}>({
		queryKey: ["/api/admin/ab-testing/summary"],
		queryFn: async () => {
			const response = await fetch("/api/admin/ab-testing/summary", {
				credentials: "include",
			});
			if (!response.ok) throw new Error("Failed to fetch summary");
			return response.json();
		},
	});

	const { data: metricsData, isLoading: metricsLoading } = useQuery<{
		success: boolean;
		metrics: ExperimentMetrics;
	}>({
		queryKey: ["/api/admin/ab-testing/metrics"],
		queryFn: async () => {
			const response = await fetch("/api/admin/ab-testing/metrics", {
				credentials: "include",
			});
			if (!response.ok) throw new Error("Failed to fetch metrics");
			return response.json();
		},
	});

	const { data: thresholdsData } = useQuery<{
		success: boolean;
		thresholds: SafetyThresholds;
	}>({
		queryKey: ["/api/admin/ab-testing/safety-thresholds"],
		queryFn: async () => {
			const response = await fetch("/api/admin/ab-testing/safety-thresholds", {
				credentials: "include",
			});
			if (!response.ok) throw new Error("Failed to fetch thresholds");
			return response.json();
		},
	});

	const { data: killSwitchData } = useQuery<{
		success: boolean;
		status: { active: boolean; reason?: string };
	}>({
		queryKey: ["/api/admin/recommendations/kill-switch"],
		queryFn: async () => {
			const response = await fetch("/api/admin/recommendations/kill-switch", {
				credentials: "include",
			});
			if (!response.ok) throw new Error("Failed to fetch kill switch status");
			return response.json();
		},
	});

	const killSwitchMutation = useMutation({
		mutationFn: async (data: {
			action: "activate" | "deactivate";
			reason?: string;
		}) => {
			const response = await apiRequest(
				"POST",
				"/api/admin/recommendations/kill-switch",
				data,
			);
			return response.json();
		},
		onSuccess: (data, variables) => {
			toast({
				title:
					variables.action === "activate"
						? "Kill Switch Activated"
						: "Kill Switch Deactivated",
				description:
					variables.action === "activate"
						? "Growth-Optimized mode has been disabled."
						: "Growth-Optimized mode is now available.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/recommendations/kill-switch"],
			});
			setKillSwitchDialogOpen(false);
			setKillSwitchReason("");
		},
		onError: (error: Error) => {
			toast({
				title: "Failed to Update Kill Switch",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const summary = summaryData?.summary;
	const metrics = metricsData?.metrics;
	const killSwitchActive = killSwitchData?.status?.active;

	const getSignificanceBadge = (significance?: number) => {
		if (!significance || significance < 80) {
			return <Badge variant="secondary">Not Significant</Badge>;
		}
		if (significance >= 95) {
			return (
				<Badge className="bg-green-500">
					Highly Significant ({significance}%)
				</Badge>
			);
		}
		if (significance >= 90) {
			return (
				<Badge className="bg-blue-500">Significant ({significance}%)</Badge>
			);
		}
		return <Badge variant="outline">Trending ({significance}%)</Badge>;
	};

	const MetricCard = ({
		title,
		groupA,
		groupB,
		format = "number",
	}: {
		title: string;
		groupA: number;
		groupB: number;
		format?: "number" | "percent" | "time";
	}) => {
		const formatValue = (val: number) => {
			if (format === "percent") return `${(val * 100).toFixed(1)}%`;
			if (format === "time") return `${val.toFixed(1)}s`;
			return val.toFixed(1);
		};

		const diff = groupB - groupA;
		const diffPercent = groupA > 0 ? ((diff / groupA) * 100).toFixed(1) : "N/A";

		return (
			<div className="p-4 border rounded-lg">
				<h4 className="text-sm font-medium text-muted-foreground mb-3">
					{title}
				</h4>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<p className="text-xs text-muted-foreground">Group A (Balanced)</p>
						<p className="text-lg font-semibold">{formatValue(groupA)}</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Group B (Growth)</p>
						<p className="text-lg font-semibold">{formatValue(groupB)}</p>
					</div>
				</div>
				<div className="mt-2 pt-2 border-t">
					<p className="text-xs text-muted-foreground">
						Difference: {diff > 0 ? "+" : ""}
						{formatValue(diff)} ({diffPercent}%)
					</p>
				</div>
			</div>
		);
	};

	if (summaryLoading) {
		return (
			<Card className={className}>
				<CardContent className="p-6">
					<div className="animate-pulse space-y-4">
						<div className="h-6 bg-muted rounded w-1/3" />
						<div className="grid grid-cols-4 gap-4">
							{[1, 2, 3, 4].map((i) => (
								<div key={i} className="h-24 bg-muted rounded" />
							))}
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className={`space-y-6 ${className}`}>
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold flex items-center gap-2">
						<FlaskConical className="h-6 w-6" />
						A/B Testing Dashboard
					</h2>
					<p className="text-muted-foreground">
						Monitor Growth-Optimized vs Balanced recommendations experiment
					</p>
				</div>

				<Dialog
					open={killSwitchDialogOpen}
					onOpenChange={setKillSwitchDialogOpen}
				>
					<DialogTrigger asChild>
						<Button
							variant={killSwitchActive ? "destructive" : "outline"}
							className="gap-2"
							data-testid="button-kill-switch"
						>
							{killSwitchActive ? (
								<>
									<PowerOff className="h-4 w-4" />
									Kill Switch Active
								</>
							) : (
								<>
									<Power className="h-4 w-4" />
									Safety Kill Switch
								</>
							)}
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{killSwitchActive
									? "Deactivate Kill Switch"
									: "Activate Kill Switch"}
							</DialogTitle>
							<DialogDescription>
								{killSwitchActive
									? "This will re-enable Growth-Optimized recommendations."
									: "This will immediately disable Growth-Optimized mode and roll back all clients to Balanced mode."}
							</DialogDescription>
						</DialogHeader>

						{!killSwitchActive && (
							<div className="space-y-2 py-4">
								<Label htmlFor="killReason">Reason for Activation</Label>
								<Textarea
									id="killReason"
									placeholder="Enter reason for activating kill switch..."
									value={killSwitchReason}
									onChange={(e) => setKillSwitchReason(e.target.value)}
									data-testid="input-kill-reason"
								/>
							</div>
						)}

						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setKillSwitchDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								variant={killSwitchActive ? "default" : "destructive"}
								onClick={() =>
									killSwitchMutation.mutate({
										action: killSwitchActive ? "deactivate" : "activate",
										reason: killSwitchReason,
									})
								}
								disabled={
									killSwitchMutation.isPending ||
									(!killSwitchActive && !killSwitchReason)
								}
								data-testid="button-confirm-kill-switch"
							>
								{killSwitchMutation.isPending
									? "Processing..."
									: killSwitchActive
										? "Deactivate"
										: "Activate Kill Switch"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{killSwitchActive && (
				<Alert variant="destructive" data-testid="kill-switch-active-alert">
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle>Kill Switch Active</AlertTitle>
					<AlertDescription>
						Growth-Optimized mode is currently disabled. Reason:{" "}
						{killSwitchData?.status?.reason}
					</AlertDescription>
				</Alert>
			)}

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<Users className="h-5 w-5 text-blue-500" />
							<div>
								<p className="text-sm text-muted-foreground">
									Total Assignments
								</p>
								<p className="text-2xl font-bold">
									{summary?.totalAssignments || 0}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<Target className="h-5 w-5 text-green-500" />
							<div>
								<p className="text-sm text-muted-foreground">
									Group A (Balanced)
								</p>
								<p className="text-2xl font-bold">
									{summary?.groupACount || 0}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5 text-orange-500" />
							<div>
								<p className="text-sm text-muted-foreground">
									Group B (Growth)
								</p>
								<p className="text-2xl font-bold">
									{summary?.groupBCount || 0}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<LucideShield className="h-5 w-5 text-emerald-500" />
							<div>
								<p className="text-sm text-muted-foreground">Safety Status</p>
								<Badge
									variant={
										summary?.safetyStatus?.safe ? "default" : "destructive"
									}
								>
									{summary?.safetyStatus?.safe ? "Safe" : "Violation"}
								</Badge>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="metrics" className="w-full">
				<TabsList>
					<TabsTrigger value="metrics">
						<BarChart3 className="h-4 w-4 mr-2" />
						Metrics
					</TabsTrigger>
					<TabsTrigger value="thresholds">
						<Settings className="h-4 w-4 mr-2" />
						Safety Thresholds
					</TabsTrigger>
				</TabsList>

				<TabsContent value="metrics" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Experiment Metrics</CardTitle>
									<CardDescription>
										Comparing Group A (Balanced) vs Group B (Growth-Optimized)
									</CardDescription>
								</div>
								{getSignificanceBadge(metrics?.statisticalSignificance)}
							</div>
						</CardHeader>
						<CardContent>
							{metricsLoading ? (
								<div className="animate-pulse h-48 bg-muted rounded" />
							) : (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<MetricCard
										title="Recommendation Acceptance Rate"
										groupA={metrics?.groupA?.recommendationAcceptanceRate || 0}
										groupB={metrics?.groupB?.recommendationAcceptanceRate || 0}
										format="percent"
									/>
									<MetricCard
										title="Avg Allocation to Growth Assets"
										groupA={metrics?.groupA?.avgAllocationToGrowthAssets || 0}
										groupB={metrics?.groupB?.avgAllocationToGrowthAssets || 0}
										format="percent"
									/>
									<MetricCard
										title="Avg Time to Decision"
										groupA={metrics?.groupA?.avgTimeToDecision || 0}
										groupB={metrics?.groupB?.avgTimeToDecision || 0}
										format="time"
									/>
									<MetricCard
										title="AI Explanation Engagement"
										groupA={metrics?.groupA?.aiExplanationEngagement || 0}
										groupB={metrics?.groupB?.aiExplanationEngagement || 0}
										format="percent"
									/>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="thresholds" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Safety Thresholds</CardTitle>
							<CardDescription>
								Thresholds that trigger automatic kill switch activation
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="p-4 border rounded-lg">
									<div className="flex justify-between items-center mb-2">
										<span className="font-medium">Max Drawdown</span>
										<Badge variant="outline">
											{thresholdsData?.thresholds?.maxDrawdown || 15}%
										</Badge>
									</div>
									<p className="text-sm text-muted-foreground">
										Kill switch activates if portfolio drawdown exceeds this
										threshold
									</p>
								</div>

								<div className="p-4 border rounded-lg">
									<div className="flex justify-between items-center mb-2">
										<span className="font-medium">Max Complaint Rate</span>
										<Badge variant="outline">
											{thresholdsData?.thresholds?.maxComplaintRate || 2}%
										</Badge>
									</div>
									<p className="text-sm text-muted-foreground">
										Kill switch activates if client complaint rate exceeds this
										threshold
									</p>
								</div>

								<div className="p-4 border rounded-lg">
									<div className="flex justify-between items-center mb-2">
										<span className="font-medium">
											Max Restricted Asset Exposure
										</span>
										<Badge variant="outline">
											{thresholdsData?.thresholds?.maxRestrictedAssetExposure ||
												30}
											%
										</Badge>
									</div>
									<p className="text-sm text-muted-foreground">
										Kill switch activates if exposure to restricted assets
										exceeds this threshold
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
