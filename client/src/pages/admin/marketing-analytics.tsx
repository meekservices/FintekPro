import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	BarChart,
	Bar,
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import {
	Mail,
	MessageSquare,
	TrendingUp,
	Users,
	Eye,
	MousePointerClick,
} from "lucide-react";
import { LoadingState } from "@/components/LoadingState";

interface CampaignAnalytics {
	id: string;
	campaignId: string;
	campaignName: string;
	campaignType: string;
	recipientCount: number;
	sentCount: number;
	deliveredCount: number;
	openedCount: number;
	clickedCount: number;
	unsubscribedCount: number;
	bounceCount: number;
	conversionCount: number;
	revenue?: string;
	recordedAt: string;
}

export default function MarketingAnalytics() {
	const [selectedPeriod, setSelectedPeriod] = useState("30d");

	const { data: analytics, isLoading } = useQuery<CampaignAnalytics[]>({
		queryKey: ["/api/admin/marketing/analytics", selectedPeriod],
	});

	if (isLoading) {
		return <LoadingState variant="stats" />;
	}

	// Calculate aggregate metrics
	const emailCampaigns =
		analytics?.filter((a) => a.campaignType === "email") || [];
	const whatsappCampaigns =
		analytics?.filter((a) => a.campaignType === "whatsapp") || [];

	const totalMetrics = {
		email: {
			campaigns: new Set(emailCampaigns.map((a) => a.campaignId)).size,
			sent: emailCampaigns.reduce((sum, a) => sum + a.sentCount, 0),
			delivered: emailCampaigns.reduce((sum, a) => sum + a.deliveredCount, 0),
			opened: emailCampaigns.reduce((sum, a) => sum + a.openedCount, 0),
			clicked: emailCampaigns.reduce((sum, a) => sum + a.clickedCount, 0),
			conversions: emailCampaigns.reduce(
				(sum, a) => sum + a.conversionCount,
				0,
			),
		},
		whatsapp: {
			campaigns: new Set(whatsappCampaigns.map((a) => a.campaignId)).size,
			sent: whatsappCampaigns.reduce((sum, a) => sum + a.sentCount, 0),
			delivered: whatsappCampaigns.reduce(
				(sum, a) => sum + a.deliveredCount,
				0,
			),
			opened: whatsappCampaigns.reduce((sum, a) => sum + a.openedCount, 0),
			clicked: whatsappCampaigns.reduce((sum, a) => sum + a.clickedCount, 0),
			conversions: whatsappCampaigns.reduce(
				(sum, a) => sum + a.conversionCount,
				0,
			),
		},
	};

	// Calculate rates
	const emailOpenRate =
		totalMetrics.email.sent > 0
			? ((totalMetrics.email.opened / totalMetrics.email.sent) * 100).toFixed(1)
			: "0";
	const emailClickRate =
		totalMetrics.email.sent > 0
			? ((totalMetrics.email.clicked / totalMetrics.email.sent) * 100).toFixed(
					1,
				)
			: "0";
	const whatsappReadRate =
		totalMetrics.whatsapp.sent > 0
			? (
					(totalMetrics.whatsapp.opened / totalMetrics.whatsapp.sent) *
					100
				).toFixed(1)
			: "0";
	const whatsappDeliveryRate =
		totalMetrics.whatsapp.sent > 0
			? (
					(totalMetrics.whatsapp.delivered / totalMetrics.whatsapp.sent) *
					100
				).toFixed(1)
			: "0";

	// Prepare chart data - group by campaign
	const campaignPerformance = analytics?.reduce((acc, curr) => {
		const existing = acc.find((item) => item.campaignId === curr.campaignId);
		if (existing) {
			existing.sent += curr.sentCount;
			existing.opened += curr.openedCount;
			existing.clicked += curr.clickedCount;
		} else {
			acc.push({
				campaignId: curr.campaignId,
				name: curr.campaignName,
				type: curr.campaignType,
				sent: curr.sentCount,
				opened: curr.openedCount,
				clicked: curr.clickedCount,
				conversions: curr.conversionCount,
			});
		}
		return acc;
	}, [] as any[]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Marketing Analytics
				</h1>
				<p className="text-muted-foreground">
					Cross-channel campaign performance and ROI tracking
				</p>
			</div>

			{/* Channel Comparison */}
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-lg">Email Campaigns</CardTitle>
							<Mail className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm text-muted-foreground">Total Campaigns</p>
								<p
									className="text-2xl font-bold"
									data-testid="text-email-campaigns"
								>
									{totalMetrics.email.campaigns}
								</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Emails Sent</p>
								<p className="text-2xl font-bold" data-testid="text-email-sent">
									{totalMetrics.email.sent.toLocaleString()}
								</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Open Rate</p>
								<p
									className="text-2xl font-bold text-blue-600"
									data-testid="text-email-open-rate"
								>
									{emailOpenRate}%
								</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Click Rate</p>
								<p
									className="text-2xl font-bold text-green-600"
									data-testid="text-email-click-rate"
								>
									{emailClickRate}%
								</p>
							</div>
						</div>
						<div className="pt-4 border-t">
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">
									Conversions
								</span>
								<span className="font-semibold">
									{totalMetrics.email.conversions}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-lg">WhatsApp Campaigns</CardTitle>
							<MessageSquare className="h-5 w-5 text-muted-foreground" />
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm text-muted-foreground">Total Campaigns</p>
								<p
									className="text-2xl font-bold"
									data-testid="text-whatsapp-campaigns"
								>
									{totalMetrics.whatsapp.campaigns}
								</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Messages Sent</p>
								<p
									className="text-2xl font-bold"
									data-testid="text-whatsapp-sent"
								>
									{totalMetrics.whatsapp.sent.toLocaleString()}
								</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Delivery Rate</p>
								<p
									className="text-2xl font-bold text-green-600"
									data-testid="text-whatsapp-delivery-rate"
								>
									{whatsappDeliveryRate}%
								</p>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Read Rate</p>
								<p
									className="text-2xl font-bold text-blue-600"
									data-testid="text-whatsapp-read-rate"
								>
									{whatsappReadRate}%
								</p>
							</div>
						</div>
						<div className="pt-4 border-t">
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">
									Conversions
								</span>
								<span className="font-semibold">
									{totalMetrics.whatsapp.conversions}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Top Performers */}
			<Card>
				<CardHeader>
					<CardTitle>Campaign Performance Comparison</CardTitle>
					<CardDescription>
						Engagement metrics across all campaigns
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="overview">
						<TabsList>
							<TabsTrigger value="overview" data-testid="tab-overview">
								Overview
							</TabsTrigger>
							<TabsTrigger value="email" data-testid="tab-email-only">
								Email Only
							</TabsTrigger>
							<TabsTrigger value="whatsapp" data-testid="tab-whatsapp-only">
								WhatsApp Only
							</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="mt-6">
							{campaignPerformance && campaignPerformance.length > 0 ? (
								<ResponsiveContainer width="100%" height={300}>
									<BarChart data={campaignPerformance}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="name" />
										<YAxis />
										<Tooltip />
										<Legend />
										<Bar dataKey="sent" fill="#8884d8" name="Sent" />
										<Bar dataKey="opened" fill="#82ca9d" name="Opened" />
										<Bar dataKey="clicked" fill="#ffc658" name="Clicked" />
									</BarChart>
								</ResponsiveContainer>
							) : (
								<div className="text-center py-12 text-muted-foreground">
									No campaign data available
								</div>
							)}
						</TabsContent>

						<TabsContent value="email" className="mt-6">
							{campaignPerformance &&
							campaignPerformance.filter((c) => c.type === "email").length >
								0 ? (
								<ResponsiveContainer width="100%" height={300}>
									<LineChart
										data={campaignPerformance.filter((c) => c.type === "email")}
									>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="name" />
										<YAxis />
										<Tooltip />
										<Legend />
										<Line
											type="monotone"
											dataKey="opened"
											stroke="#82ca9d"
											name="Opened"
										/>
										<Line
											type="monotone"
											dataKey="clicked"
											stroke="#ffc658"
											name="Clicked"
										/>
									</LineChart>
								</ResponsiveContainer>
							) : (
								<div className="text-center py-12 text-muted-foreground">
									No email campaign data available
								</div>
							)}
						</TabsContent>

						<TabsContent value="whatsapp" className="mt-6">
							{campaignPerformance &&
							campaignPerformance.filter((c) => c.type === "whatsapp").length >
								0 ? (
								<ResponsiveContainer width="100%" height={300}>
									<LineChart
										data={campaignPerformance.filter(
											(c) => c.type === "whatsapp",
										)}
									>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="name" />
										<YAxis />
										<Tooltip />
										<Legend />
										<Line
											type="monotone"
											dataKey="sent"
											stroke="#8884d8"
											name="Sent"
										/>
										<Line
											type="monotone"
											dataKey="opened"
											stroke="#82ca9d"
											name="Read"
										/>
									</LineChart>
								</ResponsiveContainer>
							) : (
								<div className="text-center py-12 text-muted-foreground">
									No WhatsApp campaign data available
								</div>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{/* Key Metrics */}
			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<CardTitle className="text-sm font-medium">Total Reach</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold" data-testid="text-total-reach">
							{(
								totalMetrics.email.sent + totalMetrics.whatsapp.sent
							).toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Messages sent across all channels
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<CardTitle className="text-sm font-medium">Engagement</CardTitle>
							<Eye className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold"
							data-testid="text-total-engagement"
						>
							{(
								totalMetrics.email.opened + totalMetrics.whatsapp.opened
							).toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Total opens/reads
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<CardTitle className="text-sm font-medium">Clicks</CardTitle>
							<MousePointerClick className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold" data-testid="text-total-clicks">
							{(
								totalMetrics.email.clicked + totalMetrics.whatsapp.clicked
							).toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Link clicks across campaigns
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<CardTitle className="text-sm font-medium">Conversions</CardTitle>
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold text-green-600"
							data-testid="text-total-conversions"
						>
							{(
								totalMetrics.email.conversions +
								totalMetrics.whatsapp.conversions
							).toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Successful conversions
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
