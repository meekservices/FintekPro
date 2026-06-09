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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
	DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	Bell,
	Plus,
	Trash2,
	AlertTriangle,
	TrendingUp,
	TrendingDown,
	Activity,
	DollarSign,
	Percent,
	Clock,
	Mail,
	MessageSquare,
	Smartphone,
} from "lucide-react";

interface AlertCondition {
	type: string;
	value: number;
	unit?: string;
	operator?: string;
}

interface AlertFormData {
	name: string;
	symbol: string;
	conditions: AlertCondition[];
	conditionLogic: "AND" | "OR";
	notifyEmail: boolean;
	notifySms: boolean;
	notifyPush: boolean;
}

interface CompoundAlert {
	id: string;
	name: string;
	symbol: string;
	conditions: AlertCondition[];
	conditionLogic: "AND" | "OR";
	isActive: boolean;
	notifyEmail: boolean;
	notifySms: boolean;
	notifyPush: boolean;
	triggeredCount: number;
	lastTriggered?: string;
}

const CONDITION_TYPES = [
	{ value: "price_above", label: "Price Above", icon: TrendingUp },
	{ value: "price_below", label: "Price Below", icon: TrendingDown },
	{ value: "percent_change", label: "% Change", icon: Percent },
	{ value: "volume_spike", label: "Volume Spike", icon: Activity },
	{ value: "52w_high", label: "Near 52W High", icon: TrendingUp },
	{ value: "52w_low", label: "Near 52W Low", icon: TrendingDown },
];

export default function CompoundAlerts() {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [formData, setFormData] = useState<AlertFormData>({
		name: "",
		symbol: "",
		conditions: [{ type: "price_above", value: 0, operator: ">" }],
		conditionLogic: "AND",
		notifyEmail: true,
		notifySms: false,
		notifyPush: true,
	});
	const { toast } = useToast();

	const { data, isLoading } = useQuery<{
		success: boolean;
		alerts: CompoundAlert[];
	}>({
		queryKey: ["/api/features/alerts/compound"],
	});

	const createMutation = useMutation({
		mutationFn: async (data: AlertFormData) => {
			return apiRequest("/api/features/alerts/compound", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			toast({
				title: "Alert Created",
				description: "Your compound alert has been set up.",
			});
			setIsDialogOpen(false);
			setFormData({
				name: "",
				symbol: "",
				conditions: [{ type: "price_above", value: 0, operator: ">" }],
				conditionLogic: "AND",
				notifyEmail: true,
				notifySms: false,
				notifyPush: true,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/features/alerts/compound"],
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to create alert.",
				variant: "destructive",
			});
		},
	});

	const alerts = data?.alerts || [];

	const addCondition = () => {
		setFormData({
			...formData,
			conditions: [
				...formData.conditions,
				{ type: "price_above", value: 0, operator: ">" },
			],
		});
	};

	const removeCondition = (index: number) => {
		setFormData({
			...formData,
			conditions: formData.conditions.filter((_, i) => i !== index),
		});
	};

	const updateCondition = (
		index: number,
		field: keyof AlertCondition,
		value: string | number,
	) => {
		const updated = [...formData.conditions];
		updated[index] = { ...updated[index], [field]: value };
		setFormData({ ...formData, conditions: updated });
	};

	const handleSubmit = () => {
		if (
			!formData.name ||
			!formData.symbol ||
			formData.conditions.length === 0
		) {
			toast({
				title: "Missing Fields",
				description: "Please fill all required fields.",
				variant: "destructive",
			});
			return;
		}
		createMutation.mutate(formData);
	};

	return (
		<div className="container max-w-6xl mx-auto py-8 px-4">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-3">
						<Bell className="h-8 w-8 text-primary" />
						Compound Alerts
					</h1>
					<p className="text-muted-foreground mt-2">
						Create smart alerts with multiple conditions for precise
						notifications
					</p>
				</div>

				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button data-testid="create-alert-btn">
							<Plus className="h-4 w-4 mr-2" />
							New Alert
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Create Compound Alert</DialogTitle>
							<DialogDescription>
								Set up multi-condition alerts for smarter notifications
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Alert Name</Label>
									<Input
										placeholder="My Price Alert"
										value={formData.name}
										onChange={(e) =>
											setFormData({ ...formData, name: e.target.value })
										}
										data-testid="alert-name-input"
									/>
								</div>
								<div className="space-y-2">
									<Label>Symbol</Label>
									<Input
										placeholder="RELIANCE"
										value={formData.symbol}
										onChange={(e) =>
											setFormData({
												...formData,
												symbol: e.target.value.toUpperCase(),
											})
										}
										data-testid="alert-symbol-input"
									/>
								</div>
							</div>

							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<Label>Conditions</Label>
									<Select
										value={formData.conditionLogic}
										onValueChange={(v: "AND" | "OR") =>
											setFormData({ ...formData, conditionLogic: v })
										}
									>
										<SelectTrigger
											className="w-24"
											data-testid="condition-logic-select"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="AND">AND</SelectItem>
											<SelectItem value="OR">OR</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{formData.conditions.map((condition, index) => (
									<div
										key={index}
										className="flex gap-2 items-end p-3 border rounded-lg bg-muted/30"
									>
										<div className="flex-1 space-y-2">
											<Label className="text-xs">Condition Type</Label>
											<Select
												value={condition.type}
												onValueChange={(v) => updateCondition(index, "type", v)}
											>
												<SelectTrigger
													data-testid={`condition-type-select-${index}`}
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{CONDITION_TYPES.map((type) => (
														<SelectItem key={type.value} value={type.value}>
															<div className="flex items-center gap-2">
																<type.icon className="h-4 w-4" />
																{type.label}
															</div>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="w-24 space-y-2">
											<Label className="text-xs">Value</Label>
											<Input
												type="number"
												value={condition.value}
												onChange={(e) =>
													updateCondition(
														index,
														"value",
														Number.parseFloat(e.target.value) || 0,
													)
												}
												data-testid={`condition-value-input-${index}`}
											/>
										</div>
										{formData.conditions.length > 1 && (
											<Button
												variant="ghost"
												size="icon"
												onClick={() => removeCondition(index)}
												className="text-destructive"
												data-testid={`remove-condition-btn-${index}`}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
									</div>
								))}

								<Button
									variant="outline"
									size="sm"
									onClick={addCondition}
									className="w-full"
									data-testid="add-condition-btn"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Condition
								</Button>
							</div>

							<div className="space-y-3">
								<Label>Notification Channels</Label>
								<div className="flex gap-4">
									<div className="flex items-center gap-2">
										<Switch
											checked={formData.notifyEmail}
											onCheckedChange={(v) =>
												setFormData({ ...formData, notifyEmail: v })
											}
											data-testid="notify-email-switch"
										/>
										<Mail className="h-4 w-4" />
										<span className="text-sm">Email</span>
									</div>
									<div className="flex items-center gap-2">
										<Switch
											checked={formData.notifySms}
											onCheckedChange={(v) =>
												setFormData({ ...formData, notifySms: v })
											}
											data-testid="notify-sms-switch"
										/>
										<MessageSquare className="h-4 w-4" />
										<span className="text-sm">SMS</span>
									</div>
									<div className="flex items-center gap-2">
										<Switch
											checked={formData.notifyPush}
											onCheckedChange={(v) =>
												setFormData({ ...formData, notifyPush: v })
											}
											data-testid="notify-push-switch"
										/>
										<Smartphone className="h-4 w-4" />
										<span className="text-sm">Push</span>
									</div>
								</div>
							</div>

							<Button
								className="w-full"
								onClick={handleSubmit}
								disabled={createMutation.isPending}
								data-testid="submit-alert-btn"
							>
								{createMutation.isPending ? "Creating..." : "Create Alert"}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{isLoading ? (
				<div className="grid md:grid-cols-2 gap-4">
					{[1, 2].map((i) => (
						<Card key={i} className="animate-pulse">
							<CardHeader>
								<div className="h-6 bg-muted rounded w-3/4" />
							</CardHeader>
							<CardContent>
								<div className="h-20 bg-muted rounded" />
							</CardContent>
						</Card>
					))}
				</div>
			) : alerts.length === 0 ? (
				<Card className="text-center py-12">
					<CardContent>
						<AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">No Alerts Set</h3>
						<p className="text-muted-foreground mb-4">
							Create compound alerts to get notified when multiple conditions
							are met.
						</p>
						<Button onClick={() => setIsDialogOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Create Your First Alert
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid md:grid-cols-2 gap-4">
					{alerts.map((alert) => (
						<Card key={alert.id} data-testid={`alert-card-${alert.id}`}>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<div>
										<CardTitle className="text-lg">{alert.name}</CardTitle>
										<CardDescription className="font-mono">
											{alert.symbol}
										</CardDescription>
									</div>
									<Badge variant={alert.isActive ? "default" : "secondary"}>
										{alert.isActive ? "Active" : "Paused"}
									</Badge>
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									<div className="flex flex-wrap gap-2">
										{alert.conditions.map((cond, i) => (
											<Badge key={i} variant="outline" className="text-xs">
												{
													CONDITION_TYPES.find((t) => t.value === cond.type)
														?.label
												}
												: {cond.value}
											</Badge>
										))}
										<Badge variant="secondary" className="text-xs">
											{alert.conditionLogic}
										</Badge>
									</div>

									<div className="flex items-center gap-3 text-sm text-muted-foreground">
										{alert.notifyEmail && <Mail className="h-4 w-4" />}
										{alert.notifySms && <MessageSquare className="h-4 w-4" />}
										{alert.notifyPush && <Smartphone className="h-4 w-4" />}
										<span className="ml-auto">
											Triggered: {alert.triggeredCount}x
										</span>
									</div>
								</div>

								<div className="flex gap-2 mt-4">
									<Button variant="outline" size="sm" className="flex-1">
										Edit
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className="text-destructive"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
