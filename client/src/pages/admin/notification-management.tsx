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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Bell,
	Mail,
	Phone,
	MessageSquare,
	Plus,
	Edit,
	Trash2,
	RefreshCw,
	CheckCircle,
	XCircle,
	Settings,
	Send,
	Clock,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface NotificationChannel {
	id: string;
	name: string;
	type: "email" | "sms" | "whatsapp" | "push";
	enabled: boolean;
	config: Record<string, any>;
}

interface NotificationTemplate {
	id: string;
	name: string;
	channel: string;
	subject?: string;
	body: string;
	variables: string[];
	active: boolean;
}

interface NotificationRule {
	id: string;
	event: string;
	channels: string[];
	template: string;
	enabled: boolean;
	conditions?: Record<string, any>;
}

interface NotificationData {
	channels: NotificationChannel[];
	templates: NotificationTemplate[];
	rules: NotificationRule[];
	stats: {
		sent24h: number;
		delivered: number;
		failed: number;
	};
}

const channelIcons: Record<string, any> = {
	email: Mail,
	sms: Phone,
	whatsapp: MessageSquare,
	push: Bell,
};

export default function NotificationManagement() {
	const { toast } = useToast();
	const [selectedTemplate, setSelectedTemplate] =
		useState<NotificationTemplate | null>(null);

	const { data, isLoading, refetch, isFetching } = useQuery<NotificationData>({
		queryKey: ["/api/admin/notifications/config"],
	});

	const toggleChannelMutation = useMutation({
		mutationFn: async ({
			channelId,
			enabled,
		}: { channelId: string; enabled: boolean }) => {
			return await apiRequest(
				`/api/admin/notifications/channels/${channelId}/toggle`,
				{
					method: "POST",
					body: JSON.stringify({ enabled }),
					headers: { "Content-Type": "application/json" },
				},
			);
		},
		onSuccess: () => {
			toast({
				title: "Channel Updated",
				description: "Notification channel settings saved",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/notifications/config"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const getChannelStatusColor = (enabled: boolean) => {
		return enabled
			? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
			: "bg-muted text-white";
	};

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Notification Management
					</h1>
					<p className="text-sm text-muted-foreground">
						Configure email, SMS, WhatsApp alerts and notification templates
					</p>
				</div>
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
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Send className="w-4 h-4 text-blue-600" />
							Sent (24h)
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-blue-600">
							{data?.stats?.sent24h || 0}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<CheckCircle className="w-4 h-4 text-emerald-600" />
							Delivered
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-emerald-600">
							{data?.stats?.delivered || 0}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<XCircle className="w-4 h-4 text-red-600" />
							Failed
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-red-600">
							{data?.stats?.failed || 0}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Clock className="w-4 h-4 text-amber-600" />
							Active Templates
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-amber-600">
							{data?.templates?.filter((t) => t.active).length || 0}
						</p>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="channels" className="w-full">
				<TabsList>
					<TabsTrigger value="channels" data-testid="tab-channels">
						Channels
					</TabsTrigger>
					<TabsTrigger value="templates" data-testid="tab-templates">
						Templates
					</TabsTrigger>
					<TabsTrigger value="rules" data-testid="tab-rules">
						Routing Rules
					</TabsTrigger>
				</TabsList>

				<TabsContent value="channels" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Notification Channels</CardTitle>
							<CardDescription>
								Configure and enable notification delivery channels
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{(data?.channels || []).map((channel) => {
									const IconComponent = channelIcons[channel.type] || Bell;
									return (
										<div
											key={channel.id}
											className="p-4 border rounded-lg"
											data-testid={`channel-${channel.id}`}
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div
														className={`p-2 rounded-lg ${channel.enabled ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"}`}
													>
														<IconComponent
															className={`w-5 h-5 ${channel.enabled ? "text-blue-600" : "text-muted-foreground"}`}
														/>
													</div>
													<div>
														<p className="font-medium">{channel.name}</p>
														<p className="text-sm text-muted-foreground capitalize">
															{channel.type}
														</p>
													</div>
												</div>
												<div className="flex items-center gap-3">
													<Badge
														className={getChannelStatusColor(channel.enabled)}
													>
														{channel.enabled ? "Active" : "Disabled"}
													</Badge>
													<Switch
														checked={channel.enabled}
														onCheckedChange={(enabled) =>
															toggleChannelMutation.mutate({
																channelId: channel.id,
																enabled,
															})
														}
													/>
												</div>
											</div>
											<div className="mt-3 flex gap-2">
												<Button size="sm" variant="outline">
													<Settings className="w-4 h-4 mr-1" />
													Configure
												</Button>
												<Button size="sm" variant="outline">
													<Send className="w-4 h-4 mr-1" />
													Test
												</Button>
											</div>
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="templates" className="mt-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle>Notification Templates</CardTitle>
								<CardDescription>
									Manage message templates for different channels
								</CardDescription>
							</div>
							<Button data-testid="button-add-template">
								<Plus className="w-4 h-4 mr-2" />
								Add Template
							</Button>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{(data?.templates || []).map((template) => (
									<div
										key={template.id}
										className="flex items-center justify-between p-4 border rounded-lg"
										data-testid={`template-${template.id}`}
									>
										<div className="flex items-center gap-4">
											<div>
												<p className="font-medium">{template.name}</p>
												<div className="flex items-center gap-2 mt-1">
													<Badge variant="outline">{template.channel}</Badge>
													{template.variables.map((v) => (
														<Badge
															key={v}
															variant="secondary"
															className="text-xs"
														>
															{`{{${v}}}`}
														</Badge>
													))}
												</div>
											</div>
										</div>
										<div className="flex items-center gap-2">
											<Badge
												className={
													template.active
														? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
														: "bg-muted"
												}
											>
												{template.active ? "Active" : "Inactive"}
											</Badge>
											<Button size="sm" variant="ghost">
												<Edit className="w-4 h-4" />
											</Button>
											<Button size="sm" variant="ghost">
												<Trash2 className="w-4 h-4 text-red-600" />
											</Button>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="rules" className="mt-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle>Notification Rules</CardTitle>
								<CardDescription>
									Define when and how notifications are sent
								</CardDescription>
							</div>
							<Button data-testid="button-add-rule">
								<Plus className="w-4 h-4 mr-2" />
								Add Rule
							</Button>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{(data?.rules || []).map((rule) => (
									<div
										key={rule.id}
										className="flex items-center justify-between p-4 border rounded-lg"
										data-testid={`rule-${rule.id}`}
									>
										<div>
											<p className="font-medium">{rule.event}</p>
											<div className="flex items-center gap-2 mt-1">
												<span className="text-sm text-muted-foreground">
													Channels:
												</span>
												{rule.channels.map((ch) => (
													<Badge key={ch} variant="outline">
														{ch}
													</Badge>
												))}
											</div>
										</div>
										<div className="flex items-center gap-2">
											<Switch checked={rule.enabled} />
											<Button size="sm" variant="ghost">
												<Edit className="w-4 h-4" />
											</Button>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
