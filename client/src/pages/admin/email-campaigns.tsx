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
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
	Mail,
	Plus,
	Send,
	Eye,
	MousePointerClick,
	Calendar,
	RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface EmailCampaign {
	id: string;
	name: string;
	emailSubject: string;
	emailFromName: string;
	emailReplyTo: string | null;
	emailHtmlContent: string;
	status: string;
	sentCount: number;
	deliveredCount: number;
	openedCount: number;
	clickedCount: number;
	recipientCount: number;
	createdAt: string;
	scheduledAt: string | null;
}

export default function EmailCampaigns() {
	const { toast } = useToast();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [selectedCampaign, setSelectedCampaign] =
		useState<EmailCampaign | null>(null);

	const { data: campaigns, isLoading } = useQuery<EmailCampaign[]>({
		queryKey: ["/api/admin/marketing/campaigns"],
		queryFn: async () => {
			const response = await fetch("/api/admin/marketing/campaigns?type=email");
			if (!response.ok) throw new Error("Failed to fetch campaigns");
			return response.json();
		},
	});

	const createCampaignMutation = useMutation({
		mutationFn: async (data: any) => {
			return apiRequest("/api/admin/marketing/campaigns", "POST", data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/marketing/campaigns"],
			});
			setIsCreateOpen(false);
			toast({ title: "Campaign created successfully" });
		},
		onError: () => {
			toast({
				title: "Failed to create campaign",
				variant: "destructive",
			});
		},
	});

	const sendCampaignMutation = useMutation({
		mutationFn: async ({
			campaignId,
			sendNow,
		}: { campaignId: string; sendNow: boolean }) => {
			const response = await fetch(
				`/api/admin/marketing/campaigns/${campaignId}/send-email`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sendNow }),
				},
			);
			if (!response.ok) throw new Error("Failed to send campaign");
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/marketing/campaigns"],
			});
			toast({ title: "Campaign sent successfully" });
		},
		onError: () => {
			toast({
				title: "Failed to send campaign",
				variant: "destructive",
			});
		},
	});

	const syncAnalyticsMutation = useMutation({
		mutationFn: async (campaignId: string) => {
			return apiRequest(
				`/api/admin/marketing/campaigns/${campaignId}/sync-analytics`,
				"POST",
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/marketing/campaigns"],
			});
			toast({ title: "Analytics synced successfully" });
		},
	});

	const handleCreateCampaign = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		createCampaignMutation.mutate({
			name: formData.get("name"),
			description: formData.get("description"),
			campaignType: "email",
			emailSubject: formData.get("emailSubject"),
			emailFromName: formData.get("emailFromName"),
			emailReplyTo: formData.get("emailReplyTo"),
			emailHtmlContent: formData.get("emailHtmlContent"),
			emailTextContent: formData.get("emailTextContent"),
		});
	};

	if (isLoading) {
		return <LoadingState variant="list" />;
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
					<p className="text-muted-foreground">
						Create and manage email campaigns via Zoho Campaigns
					</p>
				</div>
				<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
					<DialogTrigger asChild>
						<Button data-testid="button-create-campaign">
							<Plus className="mr-2 h-4 w-4" />
							Create Campaign
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Create Email Campaign</DialogTitle>
							<DialogDescription>
								Design your email campaign. Content will be sent via Zoho
								Campaigns.
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleCreateCampaign} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Campaign Name</Label>
								<Input
									id="name"
									name="name"
									placeholder="Q4 2025 Investment Newsletter"
									required
									data-testid="input-campaign-name"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									id="description"
									name="description"
									placeholder="Brief description of the campaign"
									data-testid="input-description"
								/>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="emailFromName">From Name</Label>
									<Input
										id="emailFromName"
										name="emailFromName"
										placeholder="FintekPro Team"
										required
										data-testid="input-from-name"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="emailReplyTo">Reply-To Email</Label>
									<Input
										id="emailReplyTo"
										name="emailReplyTo"
										type="email"
										placeholder="support@fintekpro.in"
										data-testid="input-reply-to"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="emailSubject">Email Subject</Label>
								<Input
									id="emailSubject"
									name="emailSubject"
									placeholder="Maximize Your Returns with Our Investment Strategies"
									required
									data-testid="input-subject"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="emailHtmlContent">HTML Content</Label>
								<Textarea
									id="emailHtmlContent"
									name="emailHtmlContent"
									placeholder="<html><body><h1>Hello!</h1><p>Your email content here...</p></body></html>"
									rows={10}
									required
									data-testid="input-html-content"
									className="font-mono text-sm"
								/>
								<p className="text-xs text-muted-foreground">
									Use HTML for rich formatting. Variables: {"{{firstName}}"},{" "}
									{"{{email}}"}
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="emailTextContent">Plain Text (Optional)</Label>
								<Textarea
									id="emailTextContent"
									name="emailTextContent"
									placeholder="Plain text fallback version of your email"
									rows={4}
									data-testid="input-text-content"
								/>
							</div>

							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsCreateOpen(false)}
									data-testid="button-cancel"
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={createCampaignMutation.isPending}
									data-testid="button-submit-campaign"
								>
									{createCampaignMutation.isPending
										? "Creating..."
										: "Create Campaign"}
								</Button>
							</div>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{/* Campaign Stats */}
			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Total Campaigns
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold"
							data-testid="text-total-campaigns"
						>
							{campaigns?.length || 0}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Total Sent</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold" data-testid="text-total-sent">
							{campaigns?.reduce((sum, c) => sum + c.sentCount, 0) || 0}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold"
							data-testid="text-avg-open-rate"
						>
							{campaigns && campaigns.length > 0
								? (
										(campaigns.reduce(
											(sum, c) =>
												sum +
												(c.sentCount > 0 ? c.openedCount / c.sentCount : 0),
											0,
										) /
											campaigns.length) *
										100
									).toFixed(1)
								: 0}
							%
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Avg Click Rate
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold"
							data-testid="text-avg-click-rate"
						>
							{campaigns && campaigns.length > 0
								? (
										(campaigns.reduce(
											(sum, c) =>
												sum +
												(c.sentCount > 0 ? c.clickedCount / c.sentCount : 0),
											0,
										) /
											campaigns.length) *
										100
									).toFixed(1)
								: 0}
							%
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Campaigns List */}
			<Card>
				<CardHeader>
					<CardTitle>All Email Campaigns</CardTitle>
					<CardDescription>
						Manage and track your email marketing campaigns
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!campaigns || campaigns.length === 0 ? (
						<div className="text-center py-12">
							<Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<p className="text-muted-foreground mb-4">
								No email campaigns yet
							</p>
							<Button
								onClick={() => setIsCreateOpen(true)}
								data-testid="button-create-first"
							>
								<Plus className="mr-2 h-4 w-4" />
								Create Your First Campaign
							</Button>
						</div>
					) : (
						<div className="space-y-4">
							{campaigns.map((campaign) => (
								<div
									key={campaign.id}
									className="border rounded-lg p-4 hover:bg-accent transition-colors"
									data-testid={`campaign-${campaign.id}`}
								>
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2 mb-2">
												<h3
													className="font-semibold"
													data-testid={`text-campaign-name-${campaign.id}`}
												>
													{campaign.name}
												</h3>
												<Badge
													variant={
														campaign.status === "sent"
															? "default"
															: campaign.status === "sending"
																? "secondary"
																: campaign.status === "scheduled"
																	? "outline"
																	: "secondary"
													}
												>
													{campaign.status}
												</Badge>
											</div>
											<p className="text-sm text-muted-foreground mb-2">
												Subject: {campaign.emailSubject}
											</p>
											<p className="text-sm text-muted-foreground">
												From: {campaign.emailFromName} • Recipients:{" "}
												{campaign.recipientCount}
											</p>
										</div>

										<div className="flex items-center gap-2">
											{campaign.status === "draft" && (
												<Button
													size="sm"
													onClick={() =>
														sendCampaignMutation.mutate({
															campaignId: campaign.id,
															sendNow: true,
														})
													}
													disabled={sendCampaignMutation.isPending}
													data-testid={`button-send-${campaign.id}`}
												>
													<Send className="mr-2 h-4 w-4" />
													Send Now
												</Button>
											)}
											{(campaign.status === "sent" ||
												campaign.status === "sending") && (
												<Button
													size="sm"
													variant="outline"
													onClick={() =>
														syncAnalyticsMutation.mutate(campaign.id)
													}
													disabled={syncAnalyticsMutation.isPending}
													data-testid={`button-sync-${campaign.id}`}
												>
													<RefreshCw className="mr-2 h-4 w-4" />
													Sync Analytics
												</Button>
											)}
										</div>
									</div>

									{/* Performance Metrics */}
									{campaign.sentCount > 0 && (
										<div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t">
											<div className="text-center">
												<Send className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
												<p className="text-lg font-semibold">
													{campaign.sentCount}
												</p>
												<p className="text-xs text-muted-foreground">Sent</p>
											</div>
											<div className="text-center">
												<Mail className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
												<p className="text-lg font-semibold">
													{campaign.deliveredCount}
												</p>
												<p className="text-xs text-muted-foreground">
													Delivered
												</p>
											</div>
											<div className="text-center">
												<Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
												<p className="text-lg font-semibold">
													{campaign.openedCount}
													<span className="text-xs text-muted-foreground ml-1">
														(
														{campaign.sentCount > 0
															? (
																	(campaign.openedCount / campaign.sentCount) *
																	100
																).toFixed(1)
															: 0}
														%)
													</span>
												</p>
												<p className="text-xs text-muted-foreground">Opened</p>
											</div>
											<div className="text-center">
												<MousePointerClick className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
												<p className="text-lg font-semibold">
													{campaign.clickedCount}
													<span className="text-xs text-muted-foreground ml-1">
														(
														{campaign.sentCount > 0
															? (
																	(campaign.clickedCount / campaign.sentCount) *
																	100
																).toFixed(1)
															: 0}
														%)
													</span>
												</p>
												<p className="text-xs text-muted-foreground">Clicked</p>
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
