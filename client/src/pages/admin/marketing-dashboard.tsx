import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Mail,
	MessageSquare,
	Users,
	TrendingUp,
	BarChart3,
	Send,
	Eye,
	MousePointerClick,
	Star,
	CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";
import { LoadingState } from "@/components/LoadingState";

interface DashboardStats {
	campaigns: {
		total: number;
		active: number;
		completed: number;
	};
	leads: {
		total: number;
		hot: number;
		converted: number;
		conversionRate: string;
	};
	performance: {
		sent: number;
		delivered: number;
		opened: number;
		clicked: number;
		openRate: string;
		clickRate: string;
	};
}

interface Campaign {
	id: string;
	name: string;
	campaignType: string;
	status: string;
	sentCount: number;
	openedCount: number;
	clickedCount: number;
	updatedAt: string;
}

interface ProspectLead {
	id: string;
	companyName: string;
	leadQuality: string;
	leadScore: number;
	status: string;
	annualRevenue: string;
	credhiveScore: number;
	probe42Score: number;
	createdAt: string;
}

export default function MarketingDashboard() {
	const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
		queryKey: ["/api/admin/marketing/dashboard/stats"],
	});

	const { data: activity, isLoading: activityLoading } = useQuery<{
		recentCampaigns: Campaign[];
		recentLeads: ProspectLead[];
	}>({
		queryKey: ["/api/admin/marketing/dashboard/recent-activity"],
	});

	if (statsLoading || activityLoading) {
		return <LoadingState variant="stats" />;
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Marketing Dashboard
					</h1>
					<p className="text-muted-foreground">
						Manage SMS, WhatsApp, email campaigns, and B2B lead prospecting
					</p>
				</div>
				<div className="flex gap-2">
					<Link href="/admin/sms-campaigns">
						<Button data-testid="button-create-sms-campaign">
							<Send className="mr-2 h-4 w-4" />
							SMS Campaign
						</Button>
					</Link>
					<Link href="/admin/whatsapp-campaigns">
						<Button
							variant="outline"
							data-testid="button-create-whatsapp-campaign"
						>
							<MessageSquare className="mr-2 h-4 w-4" />
							WhatsApp Campaign
						</Button>
					</Link>
					<Link href="/admin/email-campaigns">
						<Button
							variant="outline"
							data-testid="button-create-email-campaign"
						>
							<Mail className="mr-2 h-4 w-4" />
							Email Campaign
						</Button>
					</Link>
				</div>
			</div>

			{/* Stats Overview */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card data-testid="card-total-campaigns">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Campaigns
						</CardTitle>
						<BarChart3 className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold"
							data-testid="text-campaigns-total"
						>
							{stats?.campaigns.total || 0}
						</div>
						<p className="text-xs text-muted-foreground">
							<span className="text-green-600 font-medium">
								{stats?.campaigns.active || 0} active
							</span>
							{" • "}
							{stats?.campaigns.completed || 0} completed
						</p>
					</CardContent>
				</Card>

				<Card data-testid="card-total-leads">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Prospect Leads
						</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold" data-testid="text-leads-total">
							{stats?.leads.total || 0}
						</div>
						<p className="text-xs text-muted-foreground">
							<span className="text-orange-600 font-medium">
								{stats?.leads.hot || 0} hot leads
							</span>
							{" • "}
							{stats?.leads.converted || 0} converted
						</p>
					</CardContent>
				</Card>

				<Card data-testid="card-open-rate">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Open Rate</CardTitle>
						<Eye className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold" data-testid="text-open-rate">
							{stats?.performance.openRate || "0.00"}%
						</div>
						<p className="text-xs text-muted-foreground">
							{stats?.performance.opened || 0} of {stats?.performance.sent || 0}{" "}
							sent
						</p>
					</CardContent>
				</Card>

				<Card data-testid="card-click-rate">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Click Rate</CardTitle>
						<MousePointerClick className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold" data-testid="text-click-rate">
							{stats?.performance.clickRate || "0.00"}%
						</div>
						<p className="text-xs text-muted-foreground">
							{stats?.performance.clicked || 0} clicks
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Quick Actions */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Link href="/admin/sms-campaigns">
					<Card
						className="cursor-pointer hover:border-primary transition-colors"
						data-testid="card-sms-campaigns"
					>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Send className="h-5 w-5 text-blue-600" />
								<CardTitle className="text-base">SMS Marketing</CardTitle>
							</div>
							<CardDescription>
								Bulk SMS campaigns via Twilio Messaging Service
							</CardDescription>
						</CardHeader>
					</Card>
				</Link>

				<Link href="/admin/whatsapp-campaigns">
					<Card
						className="cursor-pointer hover:border-primary transition-colors"
						data-testid="card-whatsapp-campaigns"
					>
						<CardHeader>
							<div className="flex items-center gap-2">
								<MessageSquare className="h-5 w-5 text-green-500" />
								<CardTitle className="text-base">WhatsApp Marketing</CardTitle>
							</div>
							<CardDescription>
								Template-based WhatsApp via Twilio Business API
							</CardDescription>
						</CardHeader>
					</Card>
				</Link>

				<Link href="/admin/email-campaigns">
					<Card
						className="cursor-pointer hover:border-primary transition-colors"
						data-testid="card-email-campaigns"
					>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Mail className="h-5 w-5 text-purple-500" />
								<CardTitle className="text-base">Email Campaigns</CardTitle>
							</div>
							<CardDescription>
								Create and manage email campaigns via Zoho Campaigns
							</CardDescription>
						</CardHeader>
					</Card>
				</Link>

				<Link href="/admin/lead-prospecting">
					<Card
						className="cursor-pointer hover:border-primary transition-colors"
						data-testid="card-lead-prospecting"
					>
						<CardHeader>
							<div className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5 text-orange-500" />
								<CardTitle className="text-base">Lead Prospecting</CardTitle>
							</div>
							<CardDescription>
								Search 2.8M Indian companies with Credhive data
							</CardDescription>
						</CardHeader>
					</Card>
				</Link>
			</div>

			{/* Recent Activity */}
			<Tabs defaultValue="campaigns" className="space-y-4">
				<TabsList>
					<TabsTrigger value="campaigns" data-testid="tab-campaigns">
						Recent Campaigns
					</TabsTrigger>
					<TabsTrigger value="leads" data-testid="tab-leads">
						Recent Leads
					</TabsTrigger>
				</TabsList>

				<TabsContent value="campaigns" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Recent Campaign Activity</CardTitle>
							<CardDescription>
								Latest email and WhatsApp campaigns
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!activity?.recentCampaigns ||
							activity.recentCampaigns.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No campaigns yet. Create your first campaign!</p>
								</div>
							) : (
								<div className="space-y-4">
									{activity.recentCampaigns.map((campaign) => (
										<div
											key={campaign.id}
											className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
											data-testid={`campaign-${campaign.id}`}
										>
											<div className="flex items-center gap-4">
												{campaign.campaignType === "email" ? (
													<Mail className="h-5 w-5 text-blue-500" />
												) : (
													<MessageSquare className="h-5 w-5 text-green-500" />
												)}
												<div>
													<p
														className="font-medium"
														data-testid={`text-campaign-name-${campaign.id}`}
													>
														{campaign.name}
													</p>
													<p className="text-sm text-muted-foreground">
														{campaign.campaignType.toUpperCase()} •{" "}
														{campaign.status}
													</p>
												</div>
											</div>
											<div className="text-right">
												<div className="flex items-center gap-4 text-sm">
													<div>
														<p className="font-medium">{campaign.sentCount}</p>
														<p className="text-muted-foreground">Sent</p>
													</div>
													<div>
														<p className="font-medium">
															{campaign.openedCount}
														</p>
														<p className="text-muted-foreground">Opened</p>
													</div>
													<div>
														<p className="font-medium">
															{campaign.clickedCount}
														</p>
														<p className="text-muted-foreground">Clicked</p>
													</div>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="leads" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Recent Prospect Leads</CardTitle>
							<CardDescription>Latest B2B leads from Credhive</CardDescription>
						</CardHeader>
						<CardContent>
							{!activity?.recentLeads || activity.recentLeads.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No leads yet. Start prospecting companies!</p>
								</div>
							) : (
								<div className="space-y-4">
									{activity.recentLeads.map((lead) => (
										<div
											key={lead.id}
											className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
											data-testid={`lead-${lead.id}`}
										>
											<div className="flex items-center gap-4">
												<div
													className={`p-2 rounded-full ${
														lead.leadQuality === "hot"
															? "bg-orange-100 dark:bg-orange-900/30"
															: lead.leadQuality === "warm"
																? "bg-yellow-100 dark:bg-yellow-900/30"
																: "bg-blue-100 dark:bg-blue-900/30"
													}`}
												>
													{lead.leadQuality === "hot" ? (
														<Star className="h-5 w-5 text-orange-500" />
													) : lead.leadQuality === "warm" ? (
														<TrendingUp className="h-5 w-5 text-yellow-500" />
													) : (
														<Users className="h-5 w-5 text-blue-500" />
													)}
												</div>
												<div>
													<p
														className="font-medium"
														data-testid={`text-lead-name-${lead.id}`}
													>
														{lead.companyName}
													</p>
													<p className="text-sm text-muted-foreground">
														Score: {lead.leadScore}/100 • Credhive:{" "}
														{(lead.credhiveScore || lead.probe42Score) ?? "N/A"}
														/5
													</p>
												</div>
											</div>
											<div className="text-right">
												<div className="flex items-center gap-2">
													<span
														className={`px-2 py-1 rounded-full text-xs font-medium ${
															lead.status === "converted"
																? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
																: lead.status === "contacted"
																	? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
																	: "bg-muted text-muted-foreground"
														}`}
													>
														{lead.status}
													</span>
													{lead.annualRevenue && (
														<p className="text-sm font-medium">
															₹
															{(
																Number.parseFloat(lead.annualRevenue) / 10000000
															).toFixed(2)}
															Cr
														</p>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
