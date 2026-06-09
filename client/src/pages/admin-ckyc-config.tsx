import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
	Settings,
	Shield as LucideShield,
	AlertCircle,
	RefreshCw,
	BarChart3,
	CheckCircle,
	XCircle,
	Key,
	ArrowUpDown,
	Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CkycProvider {
	id: number;
	providerCode: string;
	providerName: string;
	providerDescription: string;
	priority: number;
	isEnabled: boolean;
	eligibilityRules: Record<string, unknown>;
	healthStatus: string;
	lastHealthCheck: string | null;
	createdAt: string;
	updatedAt: string;
}

interface CkycProvidersResponse {
	success: boolean;
	data: CkycProvider[];
	meta: {
		total: number;
		environment: string;
		truthscreenConfigured: boolean;
		sandboxConfigured: boolean;
		cashfreeConfigured: boolean;
		bseStarConfigured: boolean;
		kraConfigured: boolean;
		nsdlCkycConfigured: boolean;
		digilockerConfigured: boolean;
	};
}

export default function AdminCkycConfig() {
	const { toast } = useToast();
	const [editPriority, setEditPriority] = useState<{
		code: string;
		priority: number;
	} | null>(null);

	const { data, isLoading, refetch } = useQuery<CkycProvidersResponse>({
		queryKey: ["/api/admin/ckyc/providers"],
	});

	const toggleMutation = useMutation({
		mutationFn: async ({
			code,
			enabled,
		}: { code: string; enabled: boolean }) => {
			return apiRequest(`/api/admin/ckyc/providers/${code}/toggle`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled }),
			});
		},
		onSuccess: (_, { code, enabled }) => {
			toast({
				title: "Provider Updated",
				description: `${code} has been ${enabled ? "enabled" : "disabled"}`,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/ckyc/providers"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to toggle provider",
				variant: "destructive",
			});
		},
	});

	const priorityMutation = useMutation({
		mutationFn: async ({
			code,
			priority,
		}: { code: string; priority: number }) => {
			return apiRequest(`/api/admin/ckyc/providers/${code}/priority`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ priority }),
			});
		},
		onSuccess: () => {
			toast({
				title: "Priority Updated",
				description: "Provider priority has been updated",
			});
			setEditPriority(null);
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/ckyc/providers"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to update priority",
				variant: "destructive",
			});
		},
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const providers = (data?.data || []).sort((a, b) => a.priority - b.priority);
	const meta = data?.meta;
	const enabledCount = providers.filter((p) => p.isEnabled).length;

	const configStatusMap: Record<string, boolean> = {
		truthscreen: meta?.truthscreenConfigured || false,
		sandbox: meta?.sandboxConfigured || false,
		cashfree: meta?.cashfreeConfigured || false,
		bse_star: meta?.bseStarConfigured || false,
		kra: meta?.kraConfigured || false,
		nsdl_ckyc: meta?.nsdlCkycConfigured || false,
		digilocker: meta?.digilockerConfigured || false,
	};

	function getHealthBadge(status: string) {
		switch (status) {
			case "healthy":
				return <Badge className="bg-green-600">Healthy</Badge>;
			case "degraded":
				return <Badge className="bg-yellow-600">Degraded</Badge>;
			case "unhealthy":
				return <Badge variant="destructive">Unhealthy</Badge>;
			default:
				return <Badge variant="secondary">Unknown</Badge>;
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">
						CKYC Provider Configuration
					</h2>
					<p className="text-muted-foreground">
						Manage Central KYC (CERSAI) verification providers for regulated
						products - Mutual Funds, PMS, AIF
					</p>
				</div>
				<Button variant="outline" onClick={() => refetch()}>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardContent className="pt-6">
						<div className="text-center">
							<p className="text-sm text-muted-foreground">Total Providers</p>
							<p className="text-3xl font-bold">{providers.length}</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center">
							<p className="text-sm text-muted-foreground">Enabled</p>
							<p className="text-3xl font-bold text-green-600">
								{enabledCount}
							</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center">
							<p className="text-sm text-muted-foreground">Disabled</p>
							<p className="text-3xl font-bold text-red-600">
								{providers.length - enabledCount}
							</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center">
							<p className="text-sm text-muted-foreground">Environment</p>
							<p className="text-xl font-bold">
								{meta?.environment || "Unknown"}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="providers" className="space-y-4">
				<TabsList>
					<TabsTrigger value="providers">
						<LucideShield className="h-4 w-4 mr-2" />
						Provider Chain
					</TabsTrigger>
					<TabsTrigger value="config">
						<Key className="h-4 w-4 mr-2" />
						API Configuration
					</TabsTrigger>
				</TabsList>

				<TabsContent value="providers" className="space-y-4">
					<Alert>
						<ArrowUpDown className="h-4 w-4" />
						<AlertTitle>Priority-Based Fallback</AlertTitle>
						<AlertDescription>
							Providers are tried in priority order (1 = highest). If the
							primary provider fails, the system automatically falls back to the
							next enabled provider.
						</AlertDescription>
					</Alert>

					<div className="space-y-3">
						{providers.map((provider) => {
							const isApiConfigured =
								configStatusMap[provider.providerCode] ?? false;
							const eligibility = provider.eligibilityRules || {};
							const features: string[] = [];
							if (eligibility.requiresApiCredentials)
								features.push("API-Based");
							if (eligibility.requiresAadhaarConsent)
								features.push("Aadhaar Consent");
							if (eligibility.requiresCkycReference)
								features.push("CKYC Reference");
							if (eligibility.requiresXmlUpload) features.push("XML Upload");
							if (eligibility.requiresLiveSession)
								features.push("Live Session");
							const riskCategories =
								(eligibility.allowedRiskCategories as string[]) || [];

							return (
								<Card
									key={provider.providerCode}
									className={
										provider.isEnabled ? "ring-1 ring-green-200" : "opacity-75"
									}
								>
									<CardContent className="pt-6">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-4 flex-1">
												<div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted font-bold text-lg">
													{provider.priority}
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 flex-wrap">
														<h3 className="font-semibold">
															{provider.providerName}
														</h3>
														{getHealthBadge(provider.healthStatus)}
														{Boolean(eligibility.requiresApiCredentials) &&
															(isApiConfigured ? (
																<Badge
																	variant="outline"
																	className="text-green-600 border-green-600"
																>
																	<CheckCircle className="h-3 w-3 mr-1" />
																	API Ready
																</Badge>
															) : (
																<Badge
																	variant="outline"
																	className="text-yellow-600 border-yellow-600"
																>
																	<AlertCircle className="h-3 w-3 mr-1" />
																	API Not Configured
																</Badge>
															))}
													</div>
													<p className="text-sm text-muted-foreground mt-1">
														{provider.providerDescription}
													</p>
													<div className="flex flex-wrap gap-1.5 mt-2">
														{features.map((f, i) => (
															<Badge
																key={i}
																variant="secondary"
																className="text-xs"
															>
																<Zap className="h-3 w-3 mr-1" />
																{f}
															</Badge>
														))}
														{riskCategories.map((r, i) => (
															<Badge
																key={`risk-${i}`}
																variant="outline"
																className="text-xs capitalize"
															>
																{r} risk
															</Badge>
														))}
													</div>
												</div>
											</div>

											<div className="flex items-center gap-4 ml-4">
												<div className="flex items-center gap-2">
													<Label
														htmlFor={`priority-${provider.providerCode}`}
														className="text-xs text-muted-foreground"
													>
														Priority
													</Label>
													<Input
														id={`priority-${provider.providerCode}`}
														type="number"
														min="1"
														max="100"
														className="w-16 h-8 text-center"
														defaultValue={provider.priority}
														onBlur={(e) => {
															const newPriority = Number.parseInt(
																e.target.value,
															);
															if (
																newPriority &&
																newPriority !== provider.priority
															) {
																priorityMutation.mutate({
																	code: provider.providerCode,
																	priority: newPriority,
																});
															}
														}}
													/>
												</div>
												<div className="flex items-center gap-2">
													<Label
														htmlFor={`toggle-${provider.providerCode}`}
														className="text-xs text-muted-foreground"
													>
														{provider.isEnabled ? "On" : "Off"}
													</Label>
													<Switch
														id={`toggle-${provider.providerCode}`}
														checked={provider.isEnabled}
														onCheckedChange={(checked) =>
															toggleMutation.mutate({
																code: provider.providerCode,
																enabled: checked,
															})
														}
														disabled={toggleMutation.isPending}
													/>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</TabsContent>

				<TabsContent value="config" className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						{[
							{
								label: "TruthScreen",
								key: "truthscreenConfigured",
								vars: ["TRUTHSCREEN_USERNAME", "TRUTHSCREEN_PASSWORD"],
							},
							{
								label: "Sandbox.co.in",
								key: "sandboxConfigured",
								vars: ["SANDBOX_API_KEY", "SANDBOX_API_SECRET"],
							},
							{
								label: "Cashfree",
								key: "cashfreeConfigured",
								vars: ["CASHFREE_APP_ID", "CASHFREE_SECRET_KEY"],
							},
							{
								label: "BSE Star MFD",
								key: "bseStarConfigured",
								vars: ["BSE_STAR_API_KEY", "BSE_STAR_USER_ID"],
							},
							{
								label: "KRA (KYC Registration Agency)",
								key: "kraConfigured",
								vars: ["KRA_API_KEY"],
							},
							{
								label: "NSDL CKYC",
								key: "nsdlCkycConfigured",
								vars: ["CKYC_API_KEY", "CKYC_API_SECRET"],
							},
							{
								label: "DigiLocker",
								key: "digilockerConfigured",
								vars: ["DIGILOCKER_CLIENT_ID"],
							},
						].map((config) => {
							const isConfigured =
								(meta?.[config.key as keyof typeof meta] as boolean) || false;
							return (
								<Card key={config.key}>
									<CardHeader className="pb-3">
										<CardTitle className="text-base flex items-center gap-2">
											<Key className="h-4 w-4" />
											{config.label}
											{isConfigured ? (
												<Badge className="bg-green-600 ml-auto">
													<CheckCircle className="h-3 w-3 mr-1" />
													Connected
												</Badge>
											) : (
												<Badge variant="destructive" className="ml-auto">
													<XCircle className="h-3 w-3 mr-1" />
													Missing
												</Badge>
											)}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-1.5">
											{config.vars.map((v) => (
												<div
													key={v}
													className="flex items-center gap-2 text-sm"
												>
													{isConfigured ? (
														<CheckCircle className="h-3 w-3 text-green-500" />
													) : (
														<XCircle className="h-3 w-3 text-red-500" />
													)}
													<code className="font-mono text-xs">{v}</code>
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
