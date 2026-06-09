import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	LayoutDashboard,
	GripVertical,
	Eye,
	EyeOff,
	Save,
	RotateCcw,
	PieChart,
	TrendingUp,
	Target,
	Bell,
	Newspaper,
	Activity,
	Wallet,
	Zap,
} from "lucide-react";

interface WidgetConfig {
	id: string;
	enabled: boolean;
	position: number;
	size: "small" | "medium" | "large";
}

const WIDGET_INFO: Record<
	string,
	{ label: string; description: string; icon: any }
> = {
	portfolio: {
		label: "Portfolio Overview",
		description: "Your holdings and asset allocation",
		icon: PieChart,
	},
	market_movers: {
		label: "Market Movers",
		description: "Top gainers and losers",
		icon: TrendingUp,
	},
	quick_actions: {
		label: "Quick Actions",
		description: "Frequently used actions",
		icon: Zap,
	},
	kyc_progress: {
		label: "KYC Progress",
		description: "Verification status",
		icon: Activity,
	},
	market_news: {
		label: "Market News",
		description: "Latest financial news",
		icon: Newspaper,
	},
	trending: {
		label: "Trending Investments",
		description: "Popular stocks and funds",
		icon: TrendingUp,
	},
	goals_progress: {
		label: "Goals Progress",
		description: "Financial goals tracker",
		icon: Target,
	},
	alerts: {
		label: "Active Alerts",
		description: "Price and event alerts",
		icon: Bell,
	},
	watchlist: {
		label: "Watchlist",
		description: "Your tracked investments",
		icon: Eye,
	},
	balance: {
		label: "Account Balance",
		description: "Cash and available funds",
		icon: Wallet,
	},
};

const SIZES = [
	{ value: "small", label: "Small" },
	{ value: "medium", label: "Medium" },
	{ value: "large", label: "Large" },
];

export default function DashboardCustomize() {
	const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
	const [hasChanges, setHasChanges] = useState(false);
	const { toast } = useToast();

	const { data, isLoading } = useQuery<{
		success: boolean;
		widgets: WidgetConfig[];
	}>({
		queryKey: ["/api/features/dashboard/widgets"],
	});

	useEffect(() => {
		if (data?.widgets) {
			setWidgets(data.widgets);
		}
	}, [data]);

	const saveMutation = useMutation({
		mutationFn: async (widgets: WidgetConfig[]) => {
			return apiRequest("/api/features/dashboard/widgets", {
				method: "PUT",
				body: JSON.stringify({ widgets }),
			});
		},
		onSuccess: () => {
			toast({
				title: "Saved",
				description: "Your dashboard layout has been saved.",
			});
			setHasChanges(false);
			queryClient.invalidateQueries({
				queryKey: ["/api/features/dashboard/widgets"],
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to save layout.",
				variant: "destructive",
			});
		},
	});

	const toggleWidget = (id: string) => {
		setWidgets(
			widgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)),
		);
		setHasChanges(true);
	};

	const updateSize = (id: string, size: "small" | "medium" | "large") => {
		setWidgets(widgets.map((w) => (w.id === id ? { ...w, size } : w)));
		setHasChanges(true);
	};

	const moveWidget = (id: string, direction: "up" | "down") => {
		const index = widgets.findIndex((w) => w.id === id);
		if (
			(direction === "up" && index === 0) ||
			(direction === "down" && index === widgets.length - 1)
		)
			return;

		const newWidgets = [...widgets];
		const targetIndex = direction === "up" ? index - 1 : index + 1;
		[newWidgets[index], newWidgets[targetIndex]] = [
			newWidgets[targetIndex],
			newWidgets[index],
		];
		newWidgets.forEach((w, i) => (w.position = i));

		setWidgets(newWidgets);
		setHasChanges(true);
	};

	const resetToDefault = () => {
		if (data?.widgets) {
			setWidgets(data.widgets);
			setHasChanges(false);
		}
	};

	const handleSave = () => {
		saveMutation.mutate(widgets);
	};

	const enabledCount = widgets.filter((w) => w.enabled).length;

	return (
		<div className="container max-w-4xl mx-auto py-8 px-4">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-3">
						<LayoutDashboard className="h-8 w-8 text-primary" />
						Customize Dashboard
					</h1>
					<p className="text-muted-foreground mt-2">
						Arrange and configure your dashboard widgets
					</p>
				</div>

				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={resetToDefault}
						disabled={!hasChanges}
					>
						<RotateCcw className="h-4 w-4 mr-2" />
						Reset
					</Button>
					<Button
						onClick={handleSave}
						disabled={!hasChanges || saveMutation.isPending}
						data-testid="save-layout-btn"
					>
						<Save className="h-4 w-4 mr-2" />
						{saveMutation.isPending ? "Saving..." : "Save Layout"}
					</Button>
				</div>
			</div>

			<Card className="mb-6">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-lg">Widget Summary</CardTitle>
						<Badge variant="outline">
							{enabledCount} of {widgets.length} enabled
						</Badge>
					</div>
				</CardHeader>
			</Card>

			{isLoading ? (
				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<Card key={i} className="animate-pulse">
							<CardContent className="py-6">
								<div className="h-12 bg-muted rounded" />
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<div className="space-y-3">
					{widgets
						.sort((a, b) => a.position - b.position)
						.map((widget, index) => {
							const info = WIDGET_INFO[widget.id] || {
								label: widget.id,
								description: "",
								icon: Activity,
							};
							const Icon = info.icon;

							return (
								<Card
									key={widget.id}
									className={`transition-opacity ${!widget.enabled ? "opacity-60" : ""}`}
									data-testid={`widget-card-${widget.id}`}
								>
									<CardContent className="py-4">
										<div className="flex items-center gap-4">
											<div className="cursor-grab text-muted-foreground">
												<GripVertical className="h-5 w-5" />
											</div>

											<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
												<Icon className="h-5 w-5 text-primary" />
											</div>

											<div className="flex-1">
												<p className="font-medium">{info.label}</p>
												<p className="text-sm text-muted-foreground">
													{info.description}
												</p>
											</div>

											<div className="flex items-center gap-4">
												<Select
													value={widget.size}
													onValueChange={(v: "small" | "medium" | "large") =>
														updateSize(widget.id, v)
													}
												>
													<SelectTrigger className="w-28">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{SIZES.map((size) => (
															<SelectItem key={size.value} value={size.value}>
																{size.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>

												<div className="flex items-center gap-2">
													<Switch
														checked={widget.enabled}
														onCheckedChange={() => toggleWidget(widget.id)}
														data-testid={`toggle-${widget.id}`}
													/>
													{widget.enabled ? (
														<Eye className="h-4 w-4 text-primary" />
													) : (
														<EyeOff className="h-4 w-4 text-muted-foreground" />
													)}
												</div>

												<div className="flex flex-col gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6"
														onClick={() => moveWidget(widget.id, "up")}
														disabled={index === 0}
													>
														↑
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6"
														onClick={() => moveWidget(widget.id, "down")}
														disabled={index === widgets.length - 1}
													>
														↓
													</Button>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
				</div>
			)}
		</div>
	);
}
