import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Key,
	Check,
	X,
	AlertCircle,
	Settings,
	RefreshCw,
	Loader2,
	ExternalLink,
	Play,
	Zap,
	Shield as LucideShield,
	Cloud,
	Database,
	MessageSquare,
	BarChart,
	CreditCard,
	Bot,
	Mail,
	Phone,
	Info,
	Clock,
	Activity,
	Link2,
	FileText,
	CheckCircle2,
	XCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface ServiceConfig {
	id: string;
	name: string;
	description: string;
	category: string;
	envVars: string[];
	environmentVar: string | null;
	status: "configured" | "missing";
	environment: "sandbox" | "production";
	testEndpoint: string;
	docs: string | null;
}

interface ApiConfigData {
	services: ServiceConfig[];
	categories: Record<string, { name: string; services: ServiceConfig[] }>;
	summary: {
		total: number;
		configured: number;
		missing: number;
		sandbox: number;
		production: number;
	};
	lastChecked: string;
}

interface TestResult {
	success: boolean;
	message: string;
	details?: any;
	latency?: number;
}

const categoryIcons: Record<string, any> = {
	payments: CreditCard,
	verification: LucideShield,
	ai: Bot,
	communication: MessageSquare,
	marketing: Mail,
	"market-data": BarChart,
	data: Database,
};

function AIProviderToggle() {
	const { toast } = useToast();

	const { data: providerData, isLoading } = useQuery<any>({
		queryKey: ["/api/admin/ai-provider"],
		refetchInterval: 10000,
	});

	const switchMutation = useMutation({
		mutationFn: async (provider: string) => {
			return await apiRequest("/api/admin/ai-provider/switch", {
				method: "POST",
				body: JSON.stringify({ provider }),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: (data: any) => {
			toast({ title: "AI Provider Switched", description: data.message });
			queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-provider"] });
		},
		onError: (error: any) => {
			toast({
				title: "Switch Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const current = providerData?.provider?.current || "openai";
	const openaiAvailable = providerData?.provider?.openaiAvailable ?? false;
	const geminiAvailable = providerData?.provider?.geminiAvailable ?? false;

	return (
		<Card className="bg-card border-border">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-purple-500/20 rounded-lg">
							<Bot className="h-5 w-5 text-purple-400" />
						</div>
						<div>
							<CardTitle className="text-lg">AI Provider</CardTitle>
							<CardDescription>
								Switch between OpenAI and Gemini across all AI services
							</CardDescription>
						</div>
					</div>
					{isLoading ? (
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					) : (
						<Badge
							variant="outline"
							className={
								current === "openai"
									? "bg-green-500/20 text-green-500 border-green-500/50"
									: "bg-blue-500/20 text-blue-400 border-blue-500/50"
							}
						>
							{current === "openai" ? "OpenAI (GPT-5)" : "Gemini 2.5 Flash"}
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex items-center gap-3">
					<Button
						variant={current === "openai" ? "default" : "outline"}
						className={
							current === "openai"
								? "bg-green-600 hover:bg-green-700 flex-1"
								: "flex-1"
						}
						disabled={
							!openaiAvailable ||
							switchMutation.isPending ||
							current === "openai"
						}
						onClick={() => switchMutation.mutate("openai")}
					>
						{switchMutation.isPending && current !== "openai" ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Zap className="h-4 w-4 mr-2" />
						)}
						OpenAI
						{current === "openai" && <CheckCircle2 className="h-4 w-4 ml-2" />}
					</Button>
					<Button
						variant={current === "gemini" ? "default" : "outline"}
						className={
							current === "gemini"
								? "bg-blue-600 hover:bg-blue-700 flex-1"
								: "flex-1"
						}
						disabled={
							!geminiAvailable ||
							switchMutation.isPending ||
							current === "gemini"
						}
						onClick={() => switchMutation.mutate("gemini")}
					>
						{switchMutation.isPending && current !== "gemini" ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Bot className="h-4 w-4 mr-2" />
						)}
						Gemini
						{current === "gemini" && <CheckCircle2 className="h-4 w-4 ml-2" />}
					</Button>
				</div>
				<div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
					<span className="flex items-center gap-1">
						<span
							className={`w-2 h-2 rounded-full ${openaiAvailable ? "bg-green-500" : "bg-red-500"}`}
						/>
						OpenAI {openaiAvailable ? "Available" : "Unavailable"}
					</span>
					<span className="flex items-center gap-1">
						<span
							className={`w-2 h-2 rounded-full ${geminiAvailable ? "bg-green-500" : "bg-red-500"}`}
						/>
						Gemini {geminiAvailable ? "Available" : "Unavailable"}
					</span>
					<span>Model: {providerData?.provider?.model || "N/A"}</span>
				</div>
			</CardContent>
		</Card>
	);
}

export default function APIConfiguration() {
	const { toast } = useToast();
	const [selectedCategory, setSelectedCategory] = useState<string>("all");
	const [testingService, setTestingService] = useState<string | null>(null);
	const [testResults, setTestResults] = useState<Record<string, TestResult>>(
		{},
	);
	const [switchingEnv, setSwitchingEnv] = useState<string | null>(null);
	const [showEnvDialog, setShowEnvDialog] = useState(false);
	const [envDialogService, setEnvDialogService] =
		useState<ServiceConfig | null>(null);
	const [showDetailsDialog, setShowDetailsDialog] = useState(false);
	const [selectedService, setSelectedService] = useState<ServiceConfig | null>(
		null,
	);

	const {
		data: configData,
		isLoading,
		error,
		refetch,
	} = useQuery<{ success: boolean; data: ApiConfigData }>({
		queryKey: ["/api/admin/api-config"],
		refetchInterval: 30000,
	});

	const testConnectionMutation = useMutation({
		mutationFn: async (serviceId: string) => {
			const response = await apiRequest(
				`/api/admin/api-config/test/${serviceId}`,
				{
					method: "POST",
				},
			);
			return response;
		},
		onSuccess: (data: any, serviceId) => {
			setTestResults((prev) => ({
				...prev,
				[serviceId]: data.data,
			}));

			if (data.data.success) {
				toast({
					title: "Connection Successful",
					description: `${data.data.message} (${data.data.latency}ms)`,
				});
			} else {
				toast({
					title: "Connection Failed",
					description: data.data.message,
					variant: "destructive",
				});
			}
		},
		onError: (error: any, serviceId) => {
			setTestResults((prev) => ({
				...prev,
				[serviceId]: { success: false, message: error.message },
			}));
			toast({
				title: "Test Failed",
				description: error.message,
				variant: "destructive",
			});
		},
		onSettled: () => {
			setTestingService(null);
		},
	});

	const switchEnvironmentMutation = useMutation({
		mutationFn: async ({
			serviceId,
			environment,
		}: { serviceId: string; environment: string }) => {
			return await apiRequest(
				`/api/admin/api-config/environment/${serviceId}`,
				{
					method: "POST",
					body: JSON.stringify({ environment }),
					headers: { "Content-Type": "application/json" },
				},
			);
		},
		onSuccess: (data: any) => {
			toast({
				title: "Environment Switched",
				description: data.message,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/admin/api-config"] });
		},
		onError: (error: any) => {
			toast({
				title: "Switch Failed",
				description: error.message,
				variant: "destructive",
			});
		},
		onSettled: () => {
			setSwitchingEnv(null);
			setShowEnvDialog(false);
			setEnvDialogService(null);
		},
	});

	const handleTestConnection = (serviceId: string) => {
		setTestingService(serviceId);
		testConnectionMutation.mutate(serviceId);
	};

	const handleSwitchEnvironment = (service: ServiceConfig) => {
		setEnvDialogService(service);
		setShowEnvDialog(true);
	};

	const confirmSwitchEnvironment = () => {
		if (!envDialogService) return;

		const newEnv =
			envDialogService.environment === "sandbox" ? "production" : "sandbox";
		setSwitchingEnv(envDialogService.id);
		switchEnvironmentMutation.mutate({
			serviceId: envDialogService.id,
			environment: newEnv,
		});
	};

	const handleViewDetails = (service: ServiceConfig) => {
		setSelectedService(service);
		setShowDetailsDialog(true);
	};

	const getServiceFeatures = (serviceId: string): string[] => {
		const features: Record<string, string[]> = {
			cashfree: [
				"Payment Collection",
				"Payouts",
				"Verification Suite",
				"PAN Verification",
				"Bank Account Verification",
				"Virtual Accounts",
			],
			sandbox: [
				"PAN Verification",
				"ITR Filing",
				"Bank Statement Analysis",
				"GST Verification",
				"EPFO Verification",
			],
			phonepe: ["UPI Payments", "QR Payments", "Subscriptions", "Refunds"],
			gemini: [
				"AI Chat Assistant",
				"Expense Categorization",
				"Financial Insights",
				"Document Analysis",
			],
			twilio: [
				"SMS OTP",
				"Bulk SMS",
				"WhatsApp Business API",
				"Two-Factor Authentication",
				"Notification Delivery",
			],
			email: [
				"Email OTP",
				"Transaction Alerts",
				"Marketing Emails",
				"Report Delivery",
			],
			credhive: [
				"Company Search",
				"Financial Data",
				"Director Information",
				"Compliance Check",
			],
			zoho: [
				"Email Campaigns",
				"Lead Nurturing",
				"Automation Workflows",
				"Analytics",
			],
			alphavantage: [
				"Stock Prices",
				"Historical Data",
				"Technical Indicators",
				"Forex Rates",
			],
			openai: ["GPT-4 Chat", "Text Generation", "Code Assistance", "Analysis"],
		};
		return features[serviceId] || ["API Integration", "Data Processing"];
	};

	const getServiceUseCases = (serviceId: string): string[] => {
		const useCases: Record<string, string[]> = {
			cashfree: [
				"Collect payments from customers",
				"Verify PAN for KYC compliance",
				"Process refunds and payouts",
			],
			sandbox: [
				"Verify user PAN details",
				"Fetch ITR data for loan eligibility",
				"Verify bank account ownership",
			],
			phonepe: [
				"Accept UPI payments",
				"Generate dynamic QR codes",
				"Process recurring payments",
			],
			gemini: [
				"Power AI chat assistant",
				"Auto-categorize expenses",
				"Generate financial insights",
			],
			twilio: [
				"Send OTP for authentication",
				"Send WhatsApp notifications",
				"Customer support via WhatsApp",
				"Deliver transaction notifications",
				"Enable 2FA for security",
			],
			email: [
				"Send verification emails",
				"Deliver statements and reports",
				"Password reset flows",
			],
			credhive: [
				"Verify company existence",
				"Fetch financial statements",
				"Director due diligence",
			],
			zoho: [
				"Run email marketing campaigns",
				"Nurture leads automatically",
				"Track campaign performance",
			],
			alphavantage: [
				"Display real-time stock prices",
				"Show historical charts",
				"Calculate technical indicators",
			],
			openai: [
				"Advanced AI conversations",
				"Code generation help",
				"Document summarization",
			],
		};
		return useCases[serviceId] || ["Data integration", "API connectivity"];
	};

	const getStatusIcon = (status: ServiceConfig["status"]) => {
		switch (status) {
			case "configured":
				return <Check className="h-4 w-4 text-green-500" />;
			case "missing":
				return <X className="h-4 w-4 text-red-500" />;
		}
	};

	const getStatusBadge = (status: ServiceConfig["status"]) => {
		const variants = {
			configured: "bg-green-500/20 text-green-500 border-green-500/50",
			missing: "bg-red-500/20 text-red-500 border-red-500/50",
		};

		return (
			<Badge variant="outline" className={variants[status]}>
				{status === "configured" ? "Configured" : "Missing"}
			</Badge>
		);
	};

	const getEnvironmentBadge = (env: string) => {
		return (
			<Badge
				variant="outline"
				className={
					env === "production"
						? "bg-purple-500/20 text-purple-500 border-purple-500/50"
						: "bg-blue-500/20 text-blue-500 border-blue-500/50"
				}
			>
				{env}
			</Badge>
		);
	};

	const getCategoryIcon = (category: string) => {
		const Icon = categoryIcons[category] || Cloud;
		return <Icon className="h-5 w-5" />;
	};

	const filteredServices =
		configData?.data?.services?.filter(
			(service) =>
				selectedCategory === "all" || service.category === selectedCategory,
		) || [];

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div>
					<Skeleton className="h-9 w-64 bg-muted" />
					<Skeleton className="h-5 w-96 mt-2 bg-muted" />
				</div>
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-24 bg-muted" />
					))}
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<Skeleton key={i} className="h-64 bg-muted" />
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-64">
				<Card className="bg-card border-border p-6">
					<div className="flex items-center gap-3 text-red-500">
						<AlertCircle className="h-6 w-6" />
						<span>Failed to load API configuration</span>
					</div>
					<Button onClick={() => refetch()} className="mt-4" variant="outline">
						<RefreshCw className="h-4 w-4 mr-2" />
						Retry
					</Button>
				</Card>
			</div>
		);
	}

	const summary = configData?.data?.summary;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-foreground">
						API Configuration
					</h1>
					<p className="text-muted-foreground mt-1">
						Manage API keys and service environments • Last updated:{" "}
						{configData?.data?.lastChecked
							? new Date(configData.data.lastChecked).toLocaleTimeString()
							: "N/A"}
					</p>
				</div>
				<Button
					variant="outline"
					onClick={() => refetch()}
					className="border-border text-muted-foreground hover:bg-muted"
				>
					<RefreshCw className="h-4 w-4 mr-2" />
					Refresh
				</Button>
			</div>

			{summary && (
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-blue-500/20 rounded-lg">
									<Cloud className="h-5 w-5 text-blue-400" />
								</div>
								<div>
									<p className="text-2xl font-bold text-foreground">
										{summary.total}
									</p>
									<p className="text-xs text-muted-foreground">
										Total Services
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-green-500/20 rounded-lg">
									<Check className="h-5 w-5 text-green-400" />
								</div>
								<div>
									<p className="text-2xl font-bold text-green-400">
										{summary.configured}
									</p>
									<p className="text-xs text-muted-foreground">Configured</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-red-500/20 rounded-lg">
									<X className="h-5 w-5 text-red-400" />
								</div>
								<div>
									<p className="text-2xl font-bold text-red-400">
										{summary.missing}
									</p>
									<p className="text-xs text-muted-foreground">Missing</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-blue-500/20 rounded-lg">
									<Zap className="h-5 w-5 text-blue-400" />
								</div>
								<div>
									<p className="text-2xl font-bold text-blue-400">
										{summary.sandbox}
									</p>
									<p className="text-xs text-muted-foreground">Sandbox</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card border-border">
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-purple-500/20 rounded-lg">
									<LucideShield className="h-5 w-5 text-purple-400" />
								</div>
								<div>
									<p className="text-2xl font-bold text-purple-400">
										{summary.production}
									</p>
									<p className="text-xs text-muted-foreground">Production</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{summary && (
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Health:</span>
					<Progress
						value={(summary.configured / summary.total) * 100}
						className="flex-1 h-2"
					/>
					<span className="text-sm text-muted-foreground">
						{Math.round((summary.configured / summary.total) * 100)}%
					</span>
				</div>
			)}

			<AIProviderToggle />

			<Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
				<ScrollableTabsList className="bg-card border-border">
					<TabsTrigger value="all" className="data-[state=active]:bg-muted">
						All Services
					</TabsTrigger>
					<TabsTrigger
						value="payments"
						className="data-[state=active]:bg-muted"
					>
						<CreditCard className="h-4 w-4 mr-2" />
						Payments
					</TabsTrigger>
					<TabsTrigger
						value="verification"
						className="data-[state=active]:bg-muted"
					>
						<LucideShield className="h-4 w-4 mr-2" />
						Verification
					</TabsTrigger>
					<TabsTrigger value="ai" className="data-[state=active]:bg-muted">
						<Bot className="h-4 w-4 mr-2" />
						AI
					</TabsTrigger>
					<TabsTrigger
						value="communication"
						className="data-[state=active]:bg-muted"
					>
						<MessageSquare className="h-4 w-4 mr-2" />
						Communication
					</TabsTrigger>
					<TabsTrigger
						value="marketing"
						className="data-[state=active]:bg-muted"
					>
						<Mail className="h-4 w-4 mr-2" />
						Marketing
					</TabsTrigger>
					<TabsTrigger
						value="market-data"
						className="data-[state=active]:bg-muted"
					>
						<BarChart className="h-4 w-4 mr-2" />
						Market Data
					</TabsTrigger>
					<TabsTrigger value="data" className="data-[state=active]:bg-muted">
						<Database className="h-4 w-4 mr-2" />
						Data
					</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value={selectedCategory} className="mt-6">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{filteredServices.map((service) => (
							<Card key={service.id} className="bg-card border-border">
								<CardHeader>
									<div className="flex items-start justify-between">
										<div className="flex items-center gap-3">
											<div
												className={`p-2 rounded-lg ${
													service.status === "configured"
														? "bg-green-500/20"
														: "bg-red-500/20"
												}`}
											>
												{getCategoryIcon(service.category)}
											</div>
											<div>
												<CardTitle className="text-foreground flex items-center gap-2">
													{service.name}
													{testResults[service.id] &&
														(testResults[service.id].success ? (
															<Check className="h-4 w-4 text-green-500" />
														) : (
															<AlertCircle className="h-4 w-4 text-yellow-500" />
														))}
												</CardTitle>
												<CardDescription className="text-muted-foreground">
													{service.description}
												</CardDescription>
											</div>
										</div>
										{getStatusIcon(service.status)}
									</div>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">
											Environment
										</span>
										{getEnvironmentBadge(service.environment)}
									</div>

									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">
											Status
										</span>
										{getStatusBadge(service.status)}
									</div>

									{testResults[service.id] && (
										<div className="p-3 rounded-lg bg-muted border border-border">
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground">
													Last Test
												</span>
												{testResults[service.id].latency && (
													<span className="text-xs text-muted-foreground">
														{testResults[service.id].latency}ms
													</span>
												)}
											</div>
											<p
												className={`text-sm mt-1 ${
													testResults[service.id].success
														? "text-green-400"
														: "text-yellow-400"
												}`}
											>
												{testResults[service.id].message}
											</p>
										</div>
									)}

									<div className="space-y-2">
										<span className="text-sm text-muted-foreground">
											Required Keys
										</span>
										<div className="flex flex-wrap gap-1">
											{(service.envVars || []).map((envVar) => (
												<Badge
													key={envVar}
													variant="outline"
													className="text-xs font-mono bg-muted text-muted-foreground border-border"
												>
													{envVar}
												</Badge>
											))}
										</div>
									</div>

									<div className="flex gap-2 pt-2">
										<Button
											size="sm"
											variant="outline"
											className="flex-1 border-border text-muted-foreground hover:bg-muted"
											onClick={() => handleTestConnection(service.id)}
											disabled={
												testingService === service.id ||
												service.status === "missing"
											}
										>
											{testingService === service.id ? (
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											) : (
												<Play className="h-4 w-4 mr-2" />
											)}
											Test
										</Button>

										{service.environmentVar && (
											<Button
												size="sm"
												className={`flex-1 ${
													service.environment === "sandbox"
														? "bg-purple-600 hover:bg-purple-700"
														: "bg-blue-600 hover:bg-blue-700"
												}`}
												onClick={() => handleSwitchEnvironment(service)}
												disabled={
													switchingEnv === service.id ||
													service.status === "missing"
												}
											>
												{switchingEnv === service.id ? (
													<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												) : (
													<Settings className="h-4 w-4 mr-2" />
												)}
												{service.environment === "sandbox"
													? "Go Live"
													: "Use Sandbox"}
											</Button>
										)}

										<Button
											size="sm"
											variant="ghost"
											className="text-muted-foreground hover:text-foreground"
											onClick={() => handleViewDetails(service)}
											data-testid={`button-details-${service.id}`}
										>
											<Info className="h-4 w-4" />
										</Button>

										{service.docs && (
											<Button
												size="sm"
												variant="ghost"
												className="text-muted-foreground hover:text-foreground"
												onClick={() => window.open(service.docs!, "_blank")}
											>
												<ExternalLink className="h-4 w-4" />
											</Button>
										)}
									</div>
								</CardContent>
							</Card>
						))}
					</div>

					{filteredServices.length === 0 && (
						<Card className="bg-card border-border">
							<CardContent className="p-12 text-center">
								<Cloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
								<h3 className="text-lg font-medium text-muted-foreground">
									No services in this category
								</h3>
								<p className="text-muted-foreground mt-1">
									Select a different category to view services
								</p>
							</CardContent>
						</Card>
					)}
				</TabsContent>
			</Tabs>

			<Dialog open={showEnvDialog} onOpenChange={setShowEnvDialog}>
				<DialogContent className="bg-card border-border">
					<DialogHeader>
						<DialogTitle className="text-foreground">
							Switch to{" "}
							{envDialogService?.environment === "sandbox"
								? "Production"
								: "Sandbox"}
							?
						</DialogTitle>
						<DialogDescription className="text-muted-foreground">
							{envDialogService?.environment === "sandbox" ? (
								<>
									<strong className="text-yellow-500">Warning:</strong>{" "}
									Switching to production mode will use real API credentials and
									may incur charges. Ensure your production credentials are
									properly configured.
								</>
							) : (
								<>
									Switching to sandbox mode will use test credentials. This is
									safe for development and testing purposes.
								</>
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<div className="flex items-center justify-between p-3 bg-muted rounded-lg">
							<span className="text-muted-foreground">Service</span>
							<span className="text-foreground font-medium">
								{envDialogService?.name}
							</span>
						</div>
						<div className="flex items-center justify-between p-3 bg-muted rounded-lg mt-2">
							<span className="text-muted-foreground">Current Environment</span>
							{envDialogService &&
								getEnvironmentBadge(envDialogService.environment)}
						</div>
						<div className="flex items-center justify-between p-3 bg-muted rounded-lg mt-2">
							<span className="text-muted-foreground">New Environment</span>
							{getEnvironmentBadge(
								envDialogService?.environment === "sandbox"
									? "production"
									: "sandbox",
							)}
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowEnvDialog(false)}
							className="border-border"
						>
							Cancel
						</Button>
						<Button
							onClick={confirmSwitchEnvironment}
							className={
								envDialogService?.environment === "sandbox"
									? "bg-purple-600 hover:bg-purple-700"
									: "bg-blue-600 hover:bg-blue-700"
							}
							disabled={switchEnvironmentMutation.isPending}
						>
							{switchEnvironmentMutation.isPending ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : null}
							Confirm Switch
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Service Details Dialog */}
			<Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
				<DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<div className="flex items-center gap-3">
							<div
								className={`p-3 rounded-lg ${
									selectedService?.status === "configured"
										? "bg-green-500/20"
										: "bg-red-500/20"
								}`}
							>
								{selectedService && getCategoryIcon(selectedService.category)}
							</div>
							<div>
								<DialogTitle className="text-foreground text-xl flex items-center gap-2">
									{selectedService?.name}
									{selectedService?.status === "configured" ? (
										<CheckCircle2 className="h-5 w-5 text-green-500" />
									) : (
										<XCircle className="h-5 w-5 text-red-500" />
									)}
								</DialogTitle>
								<DialogDescription className="text-muted-foreground">
									{selectedService?.description}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					{selectedService && (
						<div className="space-y-6 py-4">
							{/* Status Overview */}
							<div className="grid grid-cols-2 gap-4">
								<div className="p-4 bg-muted rounded-lg">
									<div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
										<Activity className="h-4 w-4" />
										Status
									</div>
									<div className="flex items-center gap-2">
										{getStatusBadge(selectedService.status)}
									</div>
								</div>
								<div className="p-4 bg-muted rounded-lg">
									<div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
										<Cloud className="h-4 w-4" />
										Environment
									</div>
									<div className="flex items-center gap-2">
										{getEnvironmentBadge(selectedService.environment)}
									</div>
								</div>
							</div>

							{/* Test Results */}
							{testResults[selectedService.id] && (
								<div className="p-4 bg-muted rounded-lg">
									<div className="flex items-center justify-between mb-2">
										<div className="flex items-center gap-2 text-muted-foreground text-sm">
											<Clock className="h-4 w-4" />
											Last Connection Test
										</div>
										{testResults[selectedService.id].latency && (
											<Badge variant="outline" className="text-xs bg-muted">
												{testResults[selectedService.id].latency}ms
											</Badge>
										)}
									</div>
									<div
										className={`flex items-center gap-2 ${
											testResults[selectedService.id].success
												? "text-green-400"
												: "text-yellow-400"
										}`}
									>
										{testResults[selectedService.id].success ? (
											<CheckCircle2 className="h-4 w-4" />
										) : (
											<AlertCircle className="h-4 w-4" />
										)}
										<span>{testResults[selectedService.id].message}</span>
									</div>
								</div>
							)}

							<Separator className="bg-muted" />

							{/* Required Environment Variables */}
							<div>
								<h4 className="text-foreground font-medium mb-3 flex items-center gap-2">
									<Key className="h-4 w-4 text-muted-foreground" />
									Required Environment Variables
								</h4>
								<div className="space-y-2">
									{(selectedService.envVars || []).map((envVar) => (
										<div
											key={envVar}
											className="flex items-center justify-between p-3 bg-muted rounded-lg"
										>
											<code className="text-sm font-mono text-blue-400">
												{envVar}
											</code>
											<Badge
												variant="outline"
												className={
													selectedService.status === "configured"
														? "text-green-400 border-green-400/50"
														: "text-red-400 border-red-400/50"
												}
											>
												{selectedService.status === "configured"
													? "Set"
													: "Missing"}
											</Badge>
										</div>
									))}
								</div>
							</div>

							<Separator className="bg-muted" />

							{/* Features */}
							<div>
								<h4 className="text-foreground font-medium mb-3 flex items-center gap-2">
									<Zap className="h-4 w-4 text-muted-foreground" />
									Available Features
								</h4>
								<div className="flex flex-wrap gap-2">
									{getServiceFeatures(selectedService.id).map(
										(feature, idx) => (
											<Badge
												key={idx}
												variant="secondary"
												className="bg-muted text-muted-foreground border-border"
											>
												{feature}
											</Badge>
										),
									)}
								</div>
							</div>

							<Separator className="bg-muted" />

							{/* Use Cases */}
							<div>
								<h4 className="text-foreground font-medium mb-3 flex items-center gap-2">
									<FileText className="h-4 w-4 text-muted-foreground" />
									Use Cases in FintekPro
								</h4>
								<ul className="space-y-2">
									{getServiceUseCases(selectedService.id).map(
										(useCase, idx) => (
											<li
												key={idx}
												className="flex items-start gap-2 text-muted-foreground text-sm"
											>
												<Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
												{useCase}
											</li>
										),
									)}
								</ul>
							</div>

							{/* Documentation Link */}
							{selectedService.docs && (
								<>
									<Separator className="bg-muted" />
									<div className="flex items-center justify-between p-4 bg-muted rounded-lg">
										<div className="flex items-center gap-2 text-muted-foreground">
											<Link2 className="h-4 w-4" />
											<span>Official Documentation</span>
										</div>
										<Button
											size="sm"
											variant="outline"
											className="border-border"
											onClick={() =>
												window.open(selectedService.docs!, "_blank")
											}
										>
											<ExternalLink className="h-4 w-4 mr-2" />
											View Docs
										</Button>
									</div>
								</>
							)}
						</div>
					)}

					<DialogFooter className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => setShowDetailsDialog(false)}
							className="border-border"
						>
							Close
						</Button>
						{selectedService && (
							<Button
								onClick={() => {
									setShowDetailsDialog(false);
									handleTestConnection(selectedService.id);
								}}
								disabled={
									testingService === selectedService.id ||
									selectedService.status === "missing"
								}
								className="bg-blue-600 hover:bg-blue-700"
							>
								{testingService === selectedService.id ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<Play className="h-4 w-4 mr-2" />
								)}
								Test Connection
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
