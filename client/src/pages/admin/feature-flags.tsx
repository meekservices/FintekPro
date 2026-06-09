import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Flag,
	FlaskConical,
	Users,
	TrendingUp,
	Plus,
	Edit,
	Trash2,
	RefreshCw,
	Search,
	Filter,
	BarChart3,
	CheckCircle,
	XCircle,
	Pause,
	Play,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FeatureFlag {
	id: string;
	name: string;
	key: string;
	description: string;
	enabled: boolean;
	rolloutPercentage: number;
	targetAudience: string[];
	createdAt: string;
	updatedAt: string;
}

interface ABTest {
	id: string;
	name: string;
	status: "running" | "paused" | "completed";
	variants: { name: string; percentage: number; conversions: number }[];
	metric: string;
	startDate: string;
	endDate?: string;
	sampleSize: number;
	winner?: string;
}

interface FeatureFlagsData {
	flags: FeatureFlag[];
	abTests: ABTest[];
	stats: {
		activeFlags: number;
		runningTests: number;
		totalUsers: number;
	};
}

export default function FeatureFlags() {
	const { toast } = useToast();
	const [searchTerm, setSearchTerm] = useState("");

	const { data, isLoading, refetch, isFetching } = useQuery<FeatureFlagsData>({
		queryKey: ["/api/admin/feature-flags"],
	});

	const toggleFlagMutation = useMutation({
		mutationFn: async ({
			flagId,
			enabled,
		}: { flagId: string; enabled: boolean }) => {
			return await apiRequest(`/api/admin/feature-flags/${flagId}/toggle`, {
				method: "POST",
				body: JSON.stringify({ enabled }),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			toast({
				title: "Flag Updated",
				description: "Feature flag has been updated",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const filteredFlags = (data?.flags || []).filter(
		(flag) =>
			flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			flag.key.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const getTestStatusColor = (status: string) => {
		switch (status) {
			case "running":
				return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200";
			case "paused":
				return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200";
			case "completed":
				return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
			default:
				return "bg-muted text-foreground";
		}
	};

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Feature Flags & A/B Testing
					</h1>
					<p className="text-sm text-muted-foreground">
						Control feature rollouts and run experiments
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={() => refetch()}
						disabled={isFetching}
						variant="outline"
						data-testid="button-refresh"
					>
						<RefreshCw
							className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
					<Button data-testid="button-add-flag">
						<Plus className="w-4 h-4 mr-2" />
						New Flag
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Flag className="w-4 h-4 text-blue-600" />
							Active Flags
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-blue-600">
							{data?.stats?.activeFlags || 0}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<FlaskConical className="w-4 h-4 text-purple-600" />
							Running Tests
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-purple-600">
							{data?.stats?.runningTests || 0}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Users className="w-4 h-4 text-emerald-600" />
							Users in Tests
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-emerald-600">
							{data?.stats?.totalUsers || 0}
						</p>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="flags" className="w-full">
				<TabsList>
					<TabsTrigger value="flags" data-testid="tab-flags">
						Feature Flags
					</TabsTrigger>
					<TabsTrigger value="tests" data-testid="tab-tests">
						A/B Tests
					</TabsTrigger>
				</TabsList>

				<TabsContent value="flags" className="mt-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Feature Flags</CardTitle>
									<CardDescription>
										Toggle features on/off and control rollout percentage
									</CardDescription>
								</div>
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
									<Input
										placeholder="Search flags..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="pl-9 w-[200px]"
										data-testid="input-search"
									/>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{filteredFlags.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<Flag className="w-12 h-12 mx-auto mb-3 opacity-50" />
										<p>No feature flags found</p>
									</div>
								) : (
									filteredFlags.map((flag) => (
										<div
											key={flag.id}
											className="p-4 border rounded-lg"
											data-testid={`flag-${flag.id}`}
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-4">
													<Switch
														checked={flag.enabled}
														onCheckedChange={(enabled) =>
															toggleFlagMutation.mutate({
																flagId: flag.id,
																enabled,
															})
														}
													/>
													<div>
														<p className="font-medium">{flag.name}</p>
														<code className="text-xs bg-muted px-2 py-0.5 rounded">
															{flag.key}
														</code>
													</div>
												</div>
												<div className="flex items-center gap-4">
													<div className="text-right">
														<p className="text-sm font-medium">
															{flag.rolloutPercentage}%
														</p>
														<p className="text-xs text-muted-foreground">
															Rollout
														</p>
													</div>
													<div className="w-24">
														<Progress value={flag.rolloutPercentage} />
													</div>
													<Button size="sm" variant="ghost">
														<Edit className="w-4 h-4" />
													</Button>
												</div>
											</div>
											<p className="mt-2 text-sm text-muted-foreground">
												{flag.description}
											</p>
											{flag.targetAudience.length > 0 && (
												<div className="mt-2 flex items-center gap-2">
													<span className="text-xs text-muted-foreground">
														Audience:
													</span>
													{flag.targetAudience.map((audience) => (
														<Badge
															key={audience}
															variant="outline"
															className="text-xs"
														>
															{audience}
														</Badge>
													))}
												</div>
											)}
										</div>
									))
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="tests" className="mt-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle>A/B Tests</CardTitle>
								<CardDescription>
									Active experiments and their results
								</CardDescription>
							</div>
							<Button data-testid="button-new-test">
								<Plus className="w-4 h-4 mr-2" />
								New Test
							</Button>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{(data?.abTests || []).length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
										<p>No A/B tests configured</p>
									</div>
								) : (
									(data?.abTests || []).map((test) => (
										<div
											key={test.id}
											className="p-4 border rounded-lg"
											data-testid={`test-${test.id}`}
										>
											<div className="flex items-center justify-between mb-4">
												<div className="flex items-center gap-3">
													<span className="font-medium">{test.name}</span>
													<Badge className={getTestStatusColor(test.status)}>
														{test.status === "running" && (
															<Play className="w-3 h-3 mr-1" />
														)}
														{test.status === "paused" && (
															<Pause className="w-3 h-3 mr-1" />
														)}
														{test.status === "completed" && (
															<CheckCircle className="w-3 h-3 mr-1" />
														)}
														{test.status}
													</Badge>
													{test.winner && (
														<Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200">
															Winner: {test.winner}
														</Badge>
													)}
												</div>
												<div className="flex items-center gap-2">
													{test.status === "running" && (
														<Button size="sm" variant="outline">
															<Pause className="w-4 h-4 mr-1" />
															Pause
														</Button>
													)}
													{test.status === "paused" && (
														<Button size="sm" variant="outline">
															<Play className="w-4 h-4 mr-1" />
															Resume
														</Button>
													)}
													<Button size="sm" variant="ghost">
														<BarChart3 className="w-4 h-4" />
													</Button>
												</div>
											</div>

											<div className="grid grid-cols-3 gap-4">
												{test.variants.map((variant) => (
													<div
														key={variant.name}
														className={`p-3 border rounded-lg ${test.winner === variant.name ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : ""}`}
													>
														<div className="flex items-center justify-between mb-2">
															<span className="font-medium">
																{variant.name}
															</span>
															<span className="text-sm text-muted-foreground">
																{variant.percentage}%
															</span>
														</div>
														<p className="text-lg font-bold">
															{variant.conversions}
														</p>
														<p className="text-xs text-muted-foreground">
															conversions
														</p>
													</div>
												))}
											</div>

											<div className="mt-4 text-sm text-muted-foreground">
												<span>Metric: {test.metric}</span>
												<span className="mx-2">|</span>
												<span>
													Sample: {test.sampleSize.toLocaleString()} users
												</span>
											</div>
										</div>
									))
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
