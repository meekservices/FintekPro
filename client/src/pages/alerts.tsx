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
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	Bell,
	BellOff,
	Plus,
	TrendingUp,
	TrendingDown,
	Wallet,
	ShoppingCart,
	Edit,
	Trash2,
	Eye,
	X,
	Check,
} from "lucide-react";
import { format } from "date-fns";
import type { UserAlert, AlertHistory, AlertTemplate } from "@shared/schema";

// Zod schemas for alert creation
const marketPriceAlertSchema = z.object({
	alertName: z.string().min(1, "Alert name is required"),
	symbol: z.string().min(1, "Symbol is required"),
	targetValue: z.string().min(1, "Target price is required"),
	operator: z.enum(["above", "below"]),
	notificationChannels: z
		.array(z.string())
		.min(1, "Select at least one notification channel"),
});

const marketChangeAlertSchema = z.object({
	alertName: z.string().min(1, "Alert name is required"),
	symbol: z.string().min(1, "Symbol is required"),
	threshold: z.string().min(1, "Percentage change is required"),
	operator: z.enum(["increase", "decrease"]),
	timeframe: z.string().min(1, "Timeframe is required"),
	notificationChannels: z
		.array(z.string())
		.min(1, "Select at least one notification channel"),
});

const spendingBudgetAlertSchema = z.object({
	alertName: z.string().min(1, "Alert name is required"),
	category: z.string().min(1, "Category is required"),
	targetValue: z.string().min(1, "Budget amount is required"),
	threshold: z.string().min(1, "Threshold percentage is required"),
	timeframe: z.string().min(1, "Period is required"),
	notificationChannels: z
		.array(z.string())
		.min(1, "Select at least one notification channel"),
});

const portfolioValueAlertSchema = z.object({
	alertName: z.string().min(1, "Alert name is required"),
	threshold: z.string().min(1, "Percentage is required"),
	operator: z.enum(["gain", "loss"]),
	notificationChannels: z
		.array(z.string())
		.min(1, "Select at least one notification channel"),
});

type AlertType =
	| "market_price"
	| "market_change"
	| "spending_budget"
	| "portfolio_value";

export default function AlertsPage() {
	const { toast } = useToast();
	const [createAlertOpen, setCreateAlertOpen] = useState(false);
	const [selectedAlertType, setSelectedAlertType] =
		useState<AlertType>("market_price");
	const [activeTab, setActiveTab] = useState("my-alerts");

	// Fetch alerts
	const { data: alerts = [], isLoading: alertsLoading } = useQuery<UserAlert[]>(
		{
			queryKey: ["/api/alerts"],
		},
	);

	// Fetch alert history
	const { data: alertHistory = [], isLoading: historyLoading } = useQuery<
		AlertHistory[]
	>({
		queryKey: ["/api/alerts/history"],
	});

	// Fetch alert templates
	const { data: templates = [], isLoading: templatesLoading } = useQuery<
		AlertTemplate[]
	>({
		queryKey: ["/api/alerts/templates"],
	});

	// Delete alert mutation
	const deleteAlertMutation = useMutation({
		mutationFn: async (alertId: string) => {
			await apiRequest("DELETE", `/api/alerts/${alertId}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
			toast({ title: "Alert deleted successfully" });
		},
		onError: () => {
			toast({ title: "Failed to delete alert", variant: "destructive" });
		},
	});

	// Toggle alert mutation
	const toggleAlertMutation = useMutation({
		mutationFn: async (alertId: string) => {
			return await apiRequest("POST", `/api/alerts/${alertId}/toggle`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
			toast({ title: "Alert status updated" });
		},
	});

	// Mark history as viewed mutation
	const markViewedMutation = useMutation({
		mutationFn: async (historyId: string) => {
			return await apiRequest(
				"POST",
				`/api/alerts/history/${historyId}/viewed`,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/alerts/history"] });
		},
	});

	// Dismiss alert mutation
	const dismissAlertMutation = useMutation({
		mutationFn: async (historyId: string) => {
			return await apiRequest(
				"POST",
				`/api/alerts/history/${historyId}/dismiss`,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/alerts/history"] });
			toast({ title: "Alert dismissed" });
		},
	});

	// Use template mutation
	const useTemplateMutation = useMutation({
		mutationFn: async (templateId: string) => {
			return await apiRequest("POST", "/api/alerts/from-template", {
				body: { templateId },
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
			toast({ title: "Alert created from template" });
		},
	});

	// Calculate statistics
	const activeAlerts = alerts.filter((a: any) => a.isActive).length;
	const recentTriggers = alertHistory.filter((h: any) => {
		const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		return new Date(h.triggeredAt) > dayAgo;
	}).length;

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold" data-testid="heading-alerts">
						Alerts
					</h1>
					<p className="text-muted-foreground">
						Manage your market and portfolio alerts
					</p>
				</div>
				<Dialog open={createAlertOpen} onOpenChange={setCreateAlertOpen}>
					<DialogTrigger asChild>
						<Button data-testid="button-create-alert">
							<Plus className="mr-2 h-4 w-4" />
							Create Alert
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-2xl">
						<DialogHeader>
							<DialogTitle>Create New Alert</DialogTitle>
							<DialogDescription>
								Set up a custom alert to monitor your investments
							</DialogDescription>
						</DialogHeader>
						<CreateAlertDialog
							selectedType={selectedAlertType}
							onTypeChange={setSelectedAlertType}
							onClose={() => setCreateAlertOpen(false)}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{/* Dashboard Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
						<Bell className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold"
							data-testid="stat-active-alerts"
						>
							{activeAlerts}
						</div>
						<p className="text-xs text-muted-foreground">
							Currently monitoring
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Recent Triggers
						</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold"
							data-testid="stat-recent-triggers"
						>
							{recentTriggers}
						</div>
						<p className="text-xs text-muted-foreground">Last 24 hours</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
						<Wallet className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold" data-testid="stat-total-alerts">
							{alerts.length}
						</div>
						<p className="text-xs text-muted-foreground">All time</p>
					</CardContent>
				</Card>
			</div>

			{/* Tabs */}
			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-4"
			>
				<ScrollableTabsList>
					<TabsTrigger value="my-alerts" data-testid="tab-my-alerts">
						My Alerts
					</TabsTrigger>
					<TabsTrigger value="history" data-testid="tab-history">
						Alert History
					</TabsTrigger>
					<TabsTrigger value="templates" data-testid="tab-templates">
						Templates
					</TabsTrigger>
					<TabsTrigger value="settings" data-testid="tab-settings">
						Settings
					</TabsTrigger>
				</ScrollableTabsList>

				{/* My Alerts Tab */}
				<TabsContent value="my-alerts" className="space-y-4">
					{alertsLoading ? (
						<div>Loading alerts...</div>
					) : alerts.length === 0 ? (
						<Card>
							<CardContent className="flex flex-col items-center justify-center py-12">
								<Bell className="h-12 w-12 text-muted-foreground mb-4" />
								<p className="text-lg font-medium">No alerts yet</p>
								<p className="text-sm text-muted-foreground mb-4">
									Create your first alert to get started
								</p>
								<Button
									onClick={() => setCreateAlertOpen(true)}
									data-testid="button-create-first-alert"
								>
									<Plus className="mr-2 h-4 w-4" />
									Create Alert
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-4 md:grid-cols-2">
							{alerts.map((alert: any) => (
								<AlertCard
									key={alert.id}
									alert={alert}
									onToggle={() => toggleAlertMutation.mutate(alert.id)}
									onDelete={() => deleteAlertMutation.mutate(alert.id)}
								/>
							))}
						</div>
					)}
				</TabsContent>

				{/* Alert History Tab */}
				<TabsContent value="history">
					<Card>
						<CardHeader>
							<CardTitle>Alert History</CardTitle>
							<CardDescription>View all triggered alerts</CardDescription>
						</CardHeader>
						<CardContent>
							{historyLoading ? (
								<div>Loading history...</div>
							) : alertHistory.length === 0 ? (
								<p className="text-center py-8 text-muted-foreground">
									No alert history yet
								</p>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Alert Name</TableHead>
											<TableHead>Triggered At</TableHead>
											<TableHead>Trigger Value</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{alertHistory.map((history: any) => (
											<TableRow
												key={history.id}
												data-testid={`row-history-${history.id}`}
											>
												<TableCell>
													{history.alertSnapshot?.alertName || "Unknown"}
												</TableCell>
												<TableCell>
													{format(new Date(history.triggeredAt), "PPp")}
												</TableCell>
												<TableCell>
													<pre className="text-xs">
														{JSON.stringify(history.triggerValue, null, 2)}
													</pre>
												</TableCell>
												<TableCell>
													<div className="flex gap-2">
														{history.isRead && (
															<Badge variant="outline">Read</Badge>
														)}
														{history.isDismissed && (
															<Badge variant="secondary">Dismissed</Badge>
														)}
													</div>
												</TableCell>
												<TableCell>
													<div className="flex gap-2">
														{!history.isRead && (
															<Button
																size="sm"
																variant="ghost"
																onClick={() =>
																	markViewedMutation.mutate(history.id)
																}
																data-testid={`button-mark-viewed-${history.id}`}
															>
																<Eye className="h-4 w-4" />
															</Button>
														)}
														{!history.isDismissed && (
															<Button
																size="sm"
																variant="ghost"
																onClick={() =>
																	dismissAlertMutation.mutate(history.id)
																}
																data-testid={`button-dismiss-${history.id}`}
															>
																<X className="h-4 w-4" />
															</Button>
														)}
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Templates Tab */}
				<TabsContent value="templates">
					<Card>
						<CardHeader>
							<CardTitle>Alert Templates</CardTitle>
							<CardDescription>
								Quick setup with popular alert templates
							</CardDescription>
						</CardHeader>
						<CardContent>
							{templatesLoading ? (
								<div>Loading templates...</div>
							) : templates.length === 0 ? (
								<p className="text-center py-8 text-muted-foreground">
									No templates available
								</p>
							) : (
								<div className="grid gap-4 md:grid-cols-2">
									{templates.map((template: any) => (
										<Card
											key={template.id}
											data-testid={`card-template-${template.id}`}
										>
											<CardHeader>
												<CardTitle className="text-base">
													{template.templateName}
												</CardTitle>
												<CardDescription>
													{template.description}
												</CardDescription>
											</CardHeader>
											<CardContent>
												<div className="flex items-center justify-between">
													<div className="flex gap-2">
														<Badge>{template.category}</Badge>
														{template.isPopular && (
															<Badge variant="secondary">Popular</Badge>
														)}
													</div>
													<Button
														size="sm"
														onClick={() =>
															useTemplateMutation.mutate(template.id)
														}
														data-testid={`button-use-template-${template.id}`}
													>
														Use Template
													</Button>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Settings Tab */}
				<TabsContent value="settings">
					<Card>
						<CardHeader>
							<CardTitle>Notification Settings</CardTitle>
							<CardDescription>
								Configure how you receive alert notifications
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">Email Notifications</p>
									<p className="text-sm text-muted-foreground">
										Receive alerts via email
									</p>
								</div>
								<Switch data-testid="switch-email-notifications" />
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">SMS Notifications</p>
									<p className="text-sm text-muted-foreground">
										Receive alerts via SMS
									</p>
								</div>
								<Switch data-testid="switch-sms-notifications" />
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">Push Notifications</p>
									<p className="text-sm text-muted-foreground">
										Receive browser push notifications
									</p>
								</div>
								<Switch data-testid="switch-push-notifications" />
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">In-App Notifications</p>
									<p className="text-sm text-muted-foreground">
										Show notifications in the app
									</p>
								</div>
								<Switch
									defaultChecked
									data-testid="switch-inapp-notifications"
								/>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

// Alert Card Component
function AlertCard({
	alert,
	onToggle,
	onDelete,
}: { alert: any; onToggle: () => void; onDelete: () => void }) {
	const getAlertIcon = (type: string) => {
		switch (type) {
			case "market_price":
			case "market_change":
				return <TrendingUp className="h-5 w-5" />;
			case "spending_budget":
				return <ShoppingCart className="h-5 w-5" />;
			case "portfolio_value":
				return <Wallet className="h-5 w-5" />;
			default:
				return <Bell className="h-5 w-5" />;
		}
	};

	return (
		<Card data-testid={`card-alert-${alert.id}`}>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						{getAlertIcon(alert.alertType)}
						<div>
							<CardTitle className="text-base">{alert.alertName}</CardTitle>
							<CardDescription className="text-xs mt-1">
								{alert.symbol && `${alert.symbol} • `}
								{alert.category}
							</CardDescription>
						</div>
					</div>
					<Badge
						variant={alert.isActive ? "default" : "secondary"}
						data-testid={`badge-status-${alert.id}`}
					>
						{alert.isActive ? "Active" : "Inactive"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					<div className="text-sm">
						<p className="text-muted-foreground">Condition:</p>
						<p className="font-medium">
							{alert.operator === "above" && `Price above ${alert.targetValue}`}
							{alert.operator === "below" && `Price below ${alert.targetValue}`}
							{alert.operator === "increase" &&
								`${alert.threshold}% increase in ${alert.timeframe}`}
							{alert.operator === "decrease" &&
								`${alert.threshold}% decrease in ${alert.timeframe}`}
							{alert.operator === "gain" && `${alert.threshold}% gain`}
							{alert.operator === "loss" && `${alert.threshold}% loss`}
						</p>
					</div>

					{alert.lastTriggeredAt && (
						<div className="text-sm">
							<p className="text-muted-foreground">Last triggered:</p>
							<p className="font-medium">
								{format(new Date(alert.lastTriggeredAt), "PPp")}
							</p>
						</div>
					)}

					<div className="text-sm">
						<p className="text-muted-foreground">
							Trigger count: {alert.triggerCount || 0}
						</p>
					</div>

					<div className="flex gap-2 pt-2">
						<Button
							size="sm"
							variant="outline"
							onClick={onToggle}
							data-testid={`button-toggle-${alert.id}`}
						>
							{alert.isActive ? (
								<BellOff className="h-4 w-4 mr-1" />
							) : (
								<Bell className="h-4 w-4 mr-1" />
							)}
							{alert.isActive ? "Deactivate" : "Activate"}
						</Button>
						<Button
							size="sm"
							variant="outline"
							data-testid={`button-edit-${alert.id}`}
						>
							<Edit className="h-4 w-4" />
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={onDelete}
							data-testid={`button-delete-${alert.id}`}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// Create Alert Dialog Component
function CreateAlertDialog({
	selectedType,
	onTypeChange,
	onClose,
}: {
	selectedType: AlertType;
	onTypeChange: (type: AlertType) => void;
	onClose: () => void;
}) {
	const { toast } = useToast();

	const createAlertMutation = useMutation({
		mutationFn: async (data: any) => {
			return await apiRequest("POST", "/api/alerts", {
				body: data,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
			toast({ title: "Alert created successfully" });
			onClose();
		},
		onError: () => {
			toast({ title: "Failed to create alert", variant: "destructive" });
		},
	});

	const renderAlertForm = () => {
		switch (selectedType) {
			case "market_price":
				return (
					<MarketPriceAlertForm
						onSubmit={(data) =>
							createAlertMutation.mutate({
								...data,
								alertType: "market_price",
								category: "market",
							})
						}
					/>
				);
			case "market_change":
				return (
					<MarketChangeAlertForm
						onSubmit={(data) =>
							createAlertMutation.mutate({
								...data,
								alertType: "market_change",
								category: "market",
							})
						}
					/>
				);
			case "spending_budget":
				return (
					<SpendingBudgetAlertForm
						onSubmit={(data) =>
							createAlertMutation.mutate({
								...data,
								alertType: "spending_budget",
								category: "spending",
							})
						}
					/>
				);
			case "portfolio_value":
				return (
					<PortfolioValueAlertForm
						onSubmit={(data) =>
							createAlertMutation.mutate({
								...data,
								alertType: "portfolio_value",
								category: "portfolio",
							})
						}
					/>
				);
		}
	};

	return (
		<div className="space-y-4">
			<div>
				<label className="text-sm font-medium">Alert Type</label>
				<Select
					value={selectedType}
					onValueChange={(value) => onTypeChange(value as AlertType)}
				>
					<SelectTrigger data-testid="select-alert-type">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="market_price">Market Price Alert</SelectItem>
						<SelectItem value="market_change">Market Change Alert</SelectItem>
						<SelectItem value="spending_budget">
							Spending Budget Alert
						</SelectItem>
						<SelectItem value="portfolio_value">
							Portfolio Value Alert
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
			{renderAlertForm()}
		</div>
	);
}

// Market Price Alert Form
function MarketPriceAlertForm({ onSubmit }: { onSubmit: (data: any) => void }) {
	const form = useForm({
		resolver: zodResolver(marketPriceAlertSchema),
		defaultValues: {
			alertName: "",
			symbol: "",
			targetValue: "",
			operator: "above" as const,
			notificationChannels: ["in_app"],
		},
	});

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="alertName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Alert Name</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., RELIANCE price alert"
									{...field}
									data-testid="input-alert-name"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="symbol"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Symbol</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., RELIANCE"
									{...field}
									data-testid="input-symbol"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="targetValue"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Target Price</FormLabel>
							<FormControl>
								<Input
									type="number"
									placeholder="e.g., 2500"
									{...field}
									data-testid="input-target-value"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="operator"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Direction</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger data-testid="select-operator">
										<SelectValue />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="above">Above</SelectItem>
									<SelectItem value="below">Below</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>
				<NotificationChannelSelector control={form.control} />
				<DialogFooter>
					<Button type="submit" data-testid="button-submit-alert">
						Create Alert
					</Button>
				</DialogFooter>
			</form>
		</Form>
	);
}

// Market Change Alert Form
function MarketChangeAlertForm({
	onSubmit,
}: { onSubmit: (data: any) => void }) {
	const form = useForm({
		resolver: zodResolver(marketChangeAlertSchema),
		defaultValues: {
			alertName: "",
			symbol: "",
			threshold: "",
			operator: "increase" as const,
			timeframe: "1d",
			notificationChannels: ["in_app"],
		},
	});

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="alertName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Alert Name</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., TCS 5% move alert"
									{...field}
									data-testid="input-alert-name"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="symbol"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Symbol</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., TCS"
									{...field}
									data-testid="input-symbol"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="threshold"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Percentage Change</FormLabel>
							<FormControl>
								<Input
									type="number"
									placeholder="e.g., 5"
									{...field}
									data-testid="input-threshold"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="operator"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Direction</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger data-testid="select-operator">
										<SelectValue />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="increase">Increase</SelectItem>
									<SelectItem value="decrease">Decrease</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="timeframe"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Timeframe</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger data-testid="select-timeframe">
										<SelectValue />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="1h">1 Hour</SelectItem>
									<SelectItem value="1d">1 Day</SelectItem>
									<SelectItem value="1w">1 Week</SelectItem>
									<SelectItem value="1m">1 Month</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>
				<NotificationChannelSelector control={form.control} />
				<DialogFooter>
					<Button type="submit" data-testid="button-submit-alert">
						Create Alert
					</Button>
				</DialogFooter>
			</form>
		</Form>
	);
}

// Spending Budget Alert Form
function SpendingBudgetAlertForm({
	onSubmit,
}: { onSubmit: (data: any) => void }) {
	const form = useForm({
		resolver: zodResolver(spendingBudgetAlertSchema),
		defaultValues: {
			alertName: "",
			category: "",
			targetValue: "",
			threshold: "80",
			timeframe: "monthly",
			notificationChannels: ["in_app"],
		},
	});

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="alertName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Alert Name</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., Grocery budget alert"
									{...field}
									data-testid="input-alert-name"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="category"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Category</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., Groceries"
									{...field}
									data-testid="input-category"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="targetValue"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Budget Amount</FormLabel>
							<FormControl>
								<Input
									type="number"
									placeholder="e.g., 10000"
									{...field}
									data-testid="input-target-value"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="threshold"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Alert at (%)</FormLabel>
							<FormControl>
								<Input
									type="number"
									placeholder="e.g., 80"
									{...field}
									data-testid="input-threshold"
								/>
							</FormControl>
							<FormDescription>
								Alert when spending reaches this percentage of budget
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="timeframe"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Period</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger data-testid="select-timeframe">
										<SelectValue />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="daily">Daily</SelectItem>
									<SelectItem value="weekly">Weekly</SelectItem>
									<SelectItem value="monthly">Monthly</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>
				<NotificationChannelSelector control={form.control} />
				<DialogFooter>
					<Button type="submit" data-testid="button-submit-alert">
						Create Alert
					</Button>
				</DialogFooter>
			</form>
		</Form>
	);
}

// Portfolio Value Alert Form
function PortfolioValueAlertForm({
	onSubmit,
}: { onSubmit: (data: any) => void }) {
	const form = useForm({
		resolver: zodResolver(portfolioValueAlertSchema),
		defaultValues: {
			alertName: "",
			threshold: "",
			operator: "gain" as const,
			notificationChannels: ["in_app"],
		},
	});

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="alertName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Alert Name</FormLabel>
							<FormControl>
								<Input
									placeholder="e.g., Portfolio 10% gain alert"
									{...field}
									data-testid="input-alert-name"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="threshold"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Percentage</FormLabel>
							<FormControl>
								<Input
									type="number"
									placeholder="e.g., 10"
									{...field}
									data-testid="input-threshold"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="operator"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Type</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger data-testid="select-operator">
										<SelectValue />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="gain">Gain</SelectItem>
									<SelectItem value="loss">Loss</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>
				<NotificationChannelSelector control={form.control} />
				<DialogFooter>
					<Button type="submit" data-testid="button-submit-alert">
						Create Alert
					</Button>
				</DialogFooter>
			</form>
		</Form>
	);
}

// Notification Channel Selector Component
function NotificationChannelSelector({ control }: { control: any }) {
	return (
		<FormField
			control={control}
			name="notificationChannels"
			render={() => (
				<FormItem>
					<div className="mb-4">
						<FormLabel>Notification Channels</FormLabel>
						<FormDescription>
							Select how you want to be notified
						</FormDescription>
					</div>
					{["in_app", "email", "sms", "push"].map((channel) => (
						<FormField
							key={channel}
							control={control}
							name="notificationChannels"
							render={({ field }) => {
								return (
									<FormItem
										key={channel}
										className="flex flex-row items-start space-x-3 space-y-0"
									>
										<FormControl>
											<Checkbox
												checked={field.value?.includes(channel)}
												onCheckedChange={(checked) => {
													return checked
														? field.onChange([...field.value, channel])
														: field.onChange(
																field.value?.filter(
																	(value: string) => value !== channel,
																),
															);
												}}
												data-testid={`checkbox-channel-${channel}`}
											/>
										</FormControl>
										<FormLabel className="font-normal capitalize">
											{channel.replace("_", " ")}
										</FormLabel>
									</FormItem>
								);
							}}
						/>
					))}
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
