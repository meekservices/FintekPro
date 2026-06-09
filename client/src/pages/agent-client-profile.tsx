import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRoute } from "wouter";
import {
	User,
	Phone,
	Mail,
	MapPin,
	Calendar,
	Clock,
	FileText,
	IndianRupee,
	TrendingUp,
	TrendingDown,
	Shield as LucideShield,
	AlertTriangle,
	CheckCircle,
	XCircle,
	Target,
	PiggyBank,
	Briefcase,
	GraduationCap,
	Home,
	Plane,
	Heart,
	Plus,
	Edit,
	MessageSquare,
	Video,
	PhoneCall,
	ArrowLeft,
	Star,
	Activity,
	Bell,
	ExternalLink,
	ChevronRight,
	Loader2,
	RefreshCw,
	Brain,
	Sparkles,
	AlertCircle,
	Lightbulb,
} from "lucide-react";
import { Link } from "wouter";

interface ClientProfile {
	id: string;
	name: string;
	email: string;
	phone: string;
	address: string;
	pan: string;
	dateOfBirth: string;
	occupation: string;
	annualIncome: number;
	riskProfile: "conservative" | "moderate" | "aggressive";
	kycStatus: "pending" | "verified" | "expired";
	kycExpiry: string;
	totalPortfolio: number;
	portfolioGrowth: number;
	investedSince: string;
	lastContact: string;
	nextReview: string;
	preferredContact: string;
	notes: string;
	tags: string[];
}

interface ActivityItem {
	id: string;
	type:
		| "call"
		| "meeting"
		| "email"
		| "investment"
		| "withdrawal"
		| "document"
		| "alert"
		| "kyc";
	title: string;
	description: string;
	date: string;
	amount?: number;
	status?: string;
}

interface FinancialGoal {
	id: string;
	name: string;
	targetAmount: number;
	currentAmount: number;
	targetDate: string;
	priority: "high" | "medium" | "low";
	category:
		| "retirement"
		| "education"
		| "house"
		| "travel"
		| "emergency"
		| "other";
}

interface MeetingNote {
	id: string;
	date: string;
	type: "call" | "meeting" | "video";
	summary: string;
	actionItems: string[];
	nextSteps: string;
}

interface Holding {
	id: string;
	name: string;
	type: string;
	invested: number;
	current: number;
	returns: number;
	returnsPercent: number;
}

const GOAL_ICONS = {
	retirement: PiggyBank,
	education: GraduationCap,
	house: Home,
	travel: Plane,
	emergency: LucideShield,
	other: Target,
};

interface AIRecommendation {
	id: string;
	title: string;
	priority: "high" | "medium" | "low";
	recommendation: string;
	reasoning: string;
	expectedImpact: string;
	actionRequired: string;
	timeframe: string;
	riskLevel: "low" | "medium" | "high";
}

interface AutoFetchResult {
	success: boolean;
	workflowId: string;
	status: string;
	summary: {
		totalDataSources: number;
		successfulSources: number;
		failedSources: number;
		totalRecordsFetched: number;
		totalHoldingsValue: number;
		durationMs: number;
	};
	sourceResults: any[];
	aiAnalysis?: {
		recommendations: AIRecommendation[];
		proposal: any;
		generatedAt: string;
	};
}

export default function AgentClientProfile() {
	const [, params] = useRoute("/clients/:id");
	const clientId = params?.id || "1";
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState("overview");
	const [showAddNote, setShowAddNote] = useState(false);
	const [newNote, setNewNote] = useState({
		type: "call",
		summary: "",
		actionItems: "",
		nextSteps: "",
	});
	const [autoFetchResult, setAutoFetchResult] =
		useState<AutoFetchResult | null>(null);
	const [showAIAnalysis, setShowAIAnalysis] = useState(false);

	// Auto-fetch portfolio mutation
	const autoFetchMutation = useMutation({
		mutationFn: async () => {
			const response = await apiRequest(
				`/api/agent/client/${clientId}/auto-fetch-portfolio`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ includeAIAnalysis: true }),
				},
			);
			return response as AutoFetchResult;
		},
		onSuccess: (data) => {
			setAutoFetchResult(data);
			if (data.aiAnalysis) {
				setShowAIAnalysis(true);
			}
			toast({
				title: "Portfolio Data Fetched",
				description: `Fetched ${data.summary.totalRecordsFetched} records from ${data.summary.successfulSources}/${data.summary.totalDataSources} sources`,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/client", clientId],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Auto-Fetch Failed",
				description: error.message || "Could not fetch portfolio data",
				variant: "destructive",
			});
		},
	});

	// Get existing portfolio analysis
	const { data: portfolioAnalysis, isLoading: isLoadingAnalysis } = useQuery<{
		success: boolean;
		hasHoldings: boolean;
		portfolioSummary?: any;
		holdings?: any[];
		aiAnalysis?: any;
	}>({
		queryKey: ["/api/agent/client", clientId, "portfolio-analysis"],
		enabled: !!clientId && clientId !== "1",
	});

	const { data: clientData, isLoading: clientLoading } =
		useQuery<ClientProfile>({
			queryKey: ["/api/agent/client", clientId],
		});

	const { data: activitiesData, isLoading: activitiesLoading } = useQuery<
		ActivityItem[]
	>({
		queryKey: ["/api/agent/client", clientId, "activities"],
	});

	const { data: goalsData, isLoading: goalsLoading } = useQuery<
		FinancialGoal[]
	>({
		queryKey: ["/api/agent/client", clientId, "goals"],
	});

	const { data: notesData, isLoading: notesLoading } = useQuery<MeetingNote[]>({
		queryKey: ["/api/agent/client", clientId, "notes"],
	});

	const { data: holdingsData, isLoading: holdingsLoading } = useQuery<
		Holding[]
	>({
		queryKey: ["/api/agent/client", clientId, "holdings"],
	});

	const isLoading = clientLoading;

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background p-6 flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
				<span className="ml-2 text-muted-foreground">
					Loading client profile...
				</span>
			</div>
		);
	}

	if (!clientData) {
		return (
			<div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
				<User className="h-16 w-16 text-muted-foreground mb-4" />
				<h3 className="text-xl font-semibold text-foreground mb-2">
					Client Not Found
				</h3>
				<p className="text-muted-foreground">
					The client profile you're looking for doesn't exist.
				</p>
				<Link href="/clients">
					<Button className="mt-4" variant="outline">
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Clients
					</Button>
				</Link>
			</div>
		);
	}

	const client = clientData;
	const activities = activitiesData || [];
	const goals = goalsData || [];
	const notes = notesData || [];
	const holdings = holdingsData || [];

	const formatCurrency = (value: number) => {
		if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
		if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
		return `₹${(value / 1000).toFixed(0)}K`;
	};

	const formatDate = (dateStr: string) =>
		new Date(dateStr).toLocaleDateString("en-IN", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});

	const getActivityIcon = (type: string) => {
		switch (type) {
			case "call":
				return PhoneCall;
			case "meeting":
				return User;
			case "email":
				return Mail;
			case "investment":
				return TrendingUp;
			case "withdrawal":
				return TrendingDown;
			case "document":
				return FileText;
			case "alert":
				return Bell;
			case "kyc":
				return LucideShield;
			default:
				return Activity;
		}
	};

	const getActivityColor = (type: string) => {
		switch (type) {
			case "call":
				return "bg-blue-500/20 text-blue-400";
			case "meeting":
				return "bg-purple-500/20 text-purple-400";
			case "email":
				return "bg-cyan-500/20 text-cyan-400";
			case "investment":
				return "bg-emerald-500/20 text-emerald-400";
			case "withdrawal":
				return "bg-red-500/20 text-red-400";
			case "document":
				return "bg-amber-500/20 text-amber-400";
			case "alert":
				return "bg-orange-500/20 text-orange-400";
			case "kyc":
				return "bg-indigo-500/20 text-indigo-400";
			default:
				return "bg-muted/20 text-muted-foreground";
		}
	};

	const getRiskColor = (risk: string) => {
		switch (risk) {
			case "conservative":
				return "bg-blue-500/20 text-blue-400";
			case "moderate":
				return "bg-amber-500/20 text-amber-400";
			case "aggressive":
				return "bg-red-500/20 text-red-400";
			default:
				return "bg-muted/20 text-muted-foreground";
		}
	};

	const getKycStatusColor = (status: string) => {
		switch (status) {
			case "verified":
				return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
			case "pending":
				return "bg-amber-500/20 text-amber-400 border-amber-500/30";
			case "expired":
				return "bg-red-500/20 text-red-400 border-red-500/30";
			default:
				return "bg-muted/20 text-muted-foreground border-border/30";
		}
	};

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center gap-4 mb-6">
					<Link href="/clients">
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground"
						>
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Clients
						</Button>
					</Link>
				</div>

				{/* Client Header Card */}
				<Card className="bg-card/50 border-border">
					<CardContent className="p-6">
						<div className="flex flex-col md:flex-row gap-6">
							<Avatar className="h-24 w-24 border-2 border-emerald-500">
								<AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-2xl">
									{(client.name || "U")
										.split(" ")
										.map((n) => n[0] || "")
										.join("")}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1">
								<div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
									<div>
										<h1
											className="text-2xl font-bold text-foreground flex items-center gap-2"
											data-testid="text-client-name"
										>
											{client.name}
											<Badge className={getRiskColor(client.riskProfile)}>
												{(client.riskProfile || "moderate")
													.charAt(0)
													.toUpperCase() +
													(client.riskProfile || "moderate").slice(1)}
											</Badge>
										</h1>
										<div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
											<span className="flex items-center gap-1">
												<Mail className="h-4 w-4" />
												{client.email}
											</span>
											<span className="flex items-center gap-1">
												<Phone className="h-4 w-4" />
												{client.phone}
											</span>
											<span className="flex items-center gap-1">
												<MapPin className="h-4 w-4" />
												{client.address}
											</span>
										</div>
										<div className="flex flex-wrap gap-2 mt-3">
											{client.tags.map((tag, i) => (
												<Badge
													key={i}
													variant="outline"
													className="text-xs border-border text-muted-foreground"
												>
													{tag}
												</Badge>
											))}
										</div>
									</div>
									<div className="flex gap-2">
										<Button
											size="sm"
											className="bg-emerald-600 hover:bg-emerald-700"
											data-testid="button-call-client"
										>
											<Phone className="h-4 w-4 mr-2" />
											Call
										</Button>
										<Button
											size="sm"
											variant="outline"
											className="border-border"
											data-testid="button-email-client"
										>
											<Mail className="h-4 w-4 mr-2" />
											Email
										</Button>
										<Button
											size="sm"
											variant="outline"
											className="border-border"
											data-testid="button-schedule-meeting"
										>
											<Video className="h-4 w-4 mr-2" />
											Meet
										</Button>
									</div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Key Metrics */}
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<p className="text-muted-foreground text-sm">Total Portfolio</p>
							<p
								className="text-xl font-bold text-foreground"
								data-testid="text-total-portfolio"
							>
								{formatCurrency(client.totalPortfolio)}
							</p>
							<p className="text-sm text-emerald-400 flex items-center gap-1">
								<TrendingUp className="h-3 w-3" />+{client.portfolioGrowth}%
							</p>
						</CardContent>
					</Card>
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<p className="text-muted-foreground text-sm">Invested Since</p>
							<p className="text-xl font-bold text-foreground">
								{(formatDate(client.investedSince) || "N/A").split(" ")[1] ||
									""}{" "}
								{(formatDate(client.investedSince) || "N/A").split(" ")[2] ||
									""}
							</p>
							<p className="text-sm text-muted-foreground">
								{Math.floor(
									(Date.now() - new Date(client.investedSince).getTime()) /
										(365 * 24 * 60 * 60 * 1000),
								)}{" "}
								years
							</p>
						</CardContent>
					</Card>
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<p className="text-muted-foreground text-sm">KYC Status</p>
							<Badge className={`mt-1 ${getKycStatusColor(client.kycStatus)}`}>
								{client.kycStatus === "verified" && (
									<CheckCircle className="h-3 w-3 mr-1" />
								)}
								{client.kycStatus === "pending" && (
									<Clock className="h-3 w-3 mr-1" />
								)}
								{client.kycStatus === "expired" && (
									<XCircle className="h-3 w-3 mr-1" />
								)}
								{(client.kycStatus || "pending").charAt(0).toUpperCase() +
									(client.kycStatus || "pending").slice(1)}
							</Badge>
							<p className="text-sm text-muted-foreground mt-1">
								Expires: {formatDate(client.kycExpiry)}
							</p>
						</CardContent>
					</Card>
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<p className="text-muted-foreground text-sm">Last Contact</p>
							<p className="text-xl font-bold text-foreground">
								{formatDate(client.lastContact)}
							</p>
							<p className="text-sm text-muted-foreground">
								{client.preferredContact}
							</p>
						</CardContent>
					</Card>
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<p className="text-muted-foreground text-sm">Next Review</p>
							<p className="text-xl font-bold text-foreground">
								{formatDate(client.nextReview)}
							</p>
							<p className="text-sm text-amber-400 flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								In{" "}
								{Math.ceil(
									(new Date(client.nextReview).getTime() - Date.now()) /
										(24 * 60 * 60 * 1000),
								)}{" "}
								days
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Main Content Tabs */}
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="space-y-4"
				>
					<TabsList className="bg-card border-border">
						<TabsTrigger
							value="overview"
							className="data-[state=active]:bg-emerald-600"
						>
							Overview
						</TabsTrigger>
						<TabsTrigger
							value="goals"
							className="data-[state=active]:bg-emerald-600"
						>
							Financial Goals
						</TabsTrigger>
						<TabsTrigger
							value="holdings"
							className="data-[state=active]:bg-emerald-600"
						>
							Holdings
						</TabsTrigger>
						<TabsTrigger
							value="notes"
							className="data-[state=active]:bg-emerald-600"
						>
							Meeting Notes
						</TabsTrigger>
						<TabsTrigger
							value="activity"
							className="data-[state=active]:bg-emerald-600"
						>
							Activity Timeline
						</TabsTrigger>
					</TabsList>

					{/* Overview Tab */}
					<TabsContent value="overview" className="space-y-6">
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							{/* Client Details */}
							<Card className="bg-card/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground flex items-center gap-2">
										<User className="h-5 w-5 text-emerald-400" />
										Client Details
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="flex justify-between">
										<span className="text-muted-foreground">PAN</span>
										<span className="text-foreground font-mono">
											{client.pan}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Date of Birth</span>
										<span className="text-foreground">
											{formatDate(client.dateOfBirth)}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Occupation</span>
										<span className="text-foreground">{client.occupation}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Annual Income</span>
										<span className="text-foreground">
											{formatCurrency(client.annualIncome)}
										</span>
									</div>
									<div className="pt-3 border-t border-border">
										<p className="text-muted-foreground text-sm mb-2">Notes</p>
										<p className="text-foreground text-sm">{client.notes}</p>
									</div>
								</CardContent>
							</Card>

							{/* Goals Summary */}
							<Card className="bg-card/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground flex items-center justify-between">
										<span className="flex items-center gap-2">
											<Target className="h-5 w-5 text-emerald-400" />
											Financial Goals
										</span>
										<Badge
											variant="outline"
											className="border-border text-muted-foreground"
										>
											{goals.length} goals
										</Badge>
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ScrollArea className="h-[280px]">
										<div className="space-y-4">
											{goals.map((goal) => {
												const Icon = GOAL_ICONS[goal.category];
												const progress =
													(goal.currentAmount / goal.targetAmount) * 100;
												return (
													<div
														key={goal.id}
														className="p-3 bg-background/50 rounded-lg"
													>
														<div className="flex items-center justify-between mb-2">
															<div className="flex items-center gap-2">
																<Icon className="h-4 w-4 text-emerald-400" />
																<span className="text-foreground text-sm font-medium">
																	{goal.name}
																</span>
															</div>
															<Badge
																className={
																	goal.priority === "high"
																		? "bg-red-500/20 text-red-400"
																		: goal.priority === "medium"
																			? "bg-amber-500/20 text-amber-400"
																			: "bg-blue-500/20 text-blue-400"
																}
															>
																{goal.priority}
															</Badge>
														</div>
														<Progress value={progress} className="h-2 mb-2" />
														<div className="flex justify-between text-xs text-muted-foreground">
															<span>
																{formatCurrency(goal.currentAmount)} /{" "}
																{formatCurrency(goal.targetAmount)}
															</span>
															<span>{progress.toFixed(0)}%</span>
														</div>
													</div>
												);
											})}
										</div>
									</ScrollArea>
								</CardContent>
							</Card>

							{/* Recent Activity */}
							<Card className="bg-card/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground flex items-center justify-between">
										<span className="flex items-center gap-2">
											<Activity className="h-5 w-5 text-emerald-400" />
											Recent Activity
										</span>
										<Button
											variant="ghost"
											size="sm"
											className="text-emerald-400 hover:text-emerald-300"
											onClick={() => setActiveTab("activity")}
										>
											View All
										</Button>
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ScrollArea className="h-[280px]">
										<div className="space-y-3">
											{activities.slice(0, 5).map((activity) => {
												const Icon = getActivityIcon(activity.type);
												return (
													<div
														key={activity.id}
														className="flex gap-3 p-2 rounded-lg hover:bg-background/50"
													>
														<div
															className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}
														>
															<Icon className="h-4 w-4" />
														</div>
														<div className="flex-1">
															<p className="text-foreground text-sm font-medium">
																{activity.title}
															</p>
															<p className="text-muted-foreground text-xs">
																{activity.description}
															</p>
															<p className="text-muted-foreground text-xs mt-1">
																{formatDate(activity.date)}
															</p>
														</div>
													</div>
												);
											})}
										</div>
									</ScrollArea>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					{/* Financial Goals Tab */}
					<TabsContent value="goals" className="space-y-4">
						<div className="flex justify-between items-center">
							<h2 className="text-xl font-bold text-foreground">
								Financial Goals
							</h2>
							<Button
								className="bg-emerald-600 hover:bg-emerald-700"
								data-testid="button-add-goal"
							>
								<Plus className="h-4 w-4 mr-2" />
								Add Goal
							</Button>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{goals.map((goal) => {
								const Icon = GOAL_ICONS[goal.category];
								const progress = (goal.currentAmount / goal.targetAmount) * 100;
								const isComplete = progress >= 100;
								return (
									<Card
										key={goal.id}
										className={`bg-card/50 border-border ${isComplete ? "border-emerald-500/50" : ""}`}
									>
										<CardHeader className="pb-2">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<div
														className={`p-2 rounded-lg ${isComplete ? "bg-emerald-500/20" : "bg-muted"}`}
													>
														<Icon
															className={`h-5 w-5 ${isComplete ? "text-emerald-400" : "text-muted-foreground"}`}
														/>
													</div>
													<CardTitle className="text-foreground text-lg">
														{goal.name}
													</CardTitle>
												</div>
												{isComplete && (
													<CheckCircle className="h-5 w-5 text-emerald-400" />
												)}
											</div>
										</CardHeader>
										<CardContent>
											<div className="mb-4">
												<div className="flex justify-between text-sm mb-2">
													<span className="text-muted-foreground">
														Progress
													</span>
													<span
														className={
															isComplete
																? "text-emerald-400"
																: "text-foreground"
														}
													>
														{progress.toFixed(0)}%
													</span>
												</div>
												<Progress
													value={Math.min(progress, 100)}
													className="h-3"
												/>
											</div>
											<div className="space-y-2 text-sm">
												<div className="flex justify-between">
													<span className="text-muted-foreground">Current</span>
													<span className="text-foreground font-medium">
														{formatCurrency(goal.currentAmount)}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Target</span>
													<span className="text-foreground font-medium">
														{formatCurrency(goal.targetAmount)}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">
														Target Date
													</span>
													<span className="text-foreground">
														{formatDate(goal.targetDate)}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">
														Priority
													</span>
													<Badge
														className={
															goal.priority === "high"
																? "bg-red-500/20 text-red-400"
																: goal.priority === "medium"
																	? "bg-amber-500/20 text-amber-400"
																	: "bg-blue-500/20 text-blue-400"
														}
													>
														{goal.priority.charAt(0).toUpperCase() +
															goal.priority.slice(1)}
													</Badge>
												</div>
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					</TabsContent>

					{/* Holdings Tab */}
					<TabsContent value="holdings" className="space-y-4">
						<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
							<h2 className="text-xl font-bold text-foreground">
								Portfolio Holdings
							</h2>
							<div className="flex gap-2">
								<Button
									onClick={() => autoFetchMutation.mutate()}
									disabled={autoFetchMutation.isPending}
									className="bg-blue-600 hover:bg-blue-700"
									data-testid="button-auto-fetch-portfolio"
								>
									{autoFetchMutation.isPending ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<RefreshCw className="h-4 w-4 mr-2" />
									)}
									{autoFetchMutation.isPending
										? "Fetching..."
										: "Auto-Fetch Portfolio"}
								</Button>
								<Button
									className="bg-emerald-600 hover:bg-emerald-700"
									data-testid="button-add-holding"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Investment
								</Button>
							</div>
						</div>

						{/* Auto-Fetch Status */}
						{autoFetchResult && (
							<Card className="bg-card/50 border-border">
								<CardContent className="p-4">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div
												className={`p-2 rounded-full ${autoFetchResult.status === "completed" ? "bg-emerald-500/20" : autoFetchResult.status === "partial_success" ? "bg-amber-500/20" : "bg-red-500/20"}`}
											>
												{autoFetchResult.status === "completed" ? (
													<CheckCircle className="h-5 w-5 text-emerald-400" />
												) : autoFetchResult.status === "partial_success" ? (
													<AlertCircle className="h-5 w-5 text-amber-400" />
												) : (
													<XCircle className="h-5 w-5 text-red-400" />
												)}
											</div>
											<div>
												<p className="text-foreground font-medium">
													{autoFetchResult.status === "completed"
														? "Portfolio Data Synced"
														: autoFetchResult.status === "partial_success"
															? "Partial Data Synced"
															: "Sync Failed"}
												</p>
												<p className="text-muted-foreground text-sm">
													{autoFetchResult.summary.totalRecordsFetched} records
													from {autoFetchResult.summary.successfulSources}/
													{autoFetchResult.summary.totalDataSources} sources
													{autoFetchResult.summary.totalHoldingsValue > 0 &&
														` • Total Value: ${formatCurrency(autoFetchResult.summary.totalHoldingsValue)}`}
												</p>
											</div>
										</div>
										{autoFetchResult.aiAnalysis && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => setShowAIAnalysis(!showAIAnalysis)}
												className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
												data-testid="button-toggle-ai-analysis"
											>
												<Brain className="h-4 w-4 mr-2" />
												{showAIAnalysis ? "Hide" : "View"} AI Analysis
											</Button>
										)}
									</div>
								</CardContent>
							</Card>
						)}

						{/* AI Analysis Panel */}
						{showAIAnalysis && autoFetchResult?.aiAnalysis && (
							<Card className="bg-gradient-to-br from-purple-900/30 to-slate-800/50 border-purple-500/30">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-foreground">
										<Sparkles className="h-5 w-5 text-purple-400" />
										AI Portfolio Analysis
									</CardTitle>
									<CardDescription className="text-muted-foreground">
										Generated on{" "}
										{new Date(
											autoFetchResult.aiAnalysis.generatedAt,
										).toLocaleString()}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{/* Recommendations */}
									{autoFetchResult.aiAnalysis.recommendations.length > 0 && (
										<div className="space-y-3">
											<h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
												<Lightbulb className="h-5 w-5 text-amber-400" />
												Rebalancing Recommendations
											</h3>
											<div className="grid gap-3">
												{autoFetchResult.aiAnalysis.recommendations
													.slice(0, 5)
													.map((rec) => (
														<Card
															key={rec.id}
															className="bg-card/50 border-border"
														>
															<CardContent className="p-4">
																<div className="flex items-start justify-between gap-4">
																	<div className="flex-1">
																		<div className="flex items-center gap-2 mb-2">
																			<Badge
																				className={
																					rec.priority === "high"
																						? "bg-red-500/20 text-red-400"
																						: rec.priority === "medium"
																							? "bg-amber-500/20 text-amber-400"
																							: "bg-blue-500/20 text-blue-400"
																				}
																			>
																				{rec.priority.toUpperCase()}
																			</Badge>
																			<Badge
																				variant="outline"
																				className="border-border text-muted-foreground"
																			>
																				{rec.timeframe}
																			</Badge>
																		</div>
																		<p className="text-foreground font-medium">
																			{rec.title}
																		</p>
																		<p className="text-muted-foreground text-sm mt-1">
																			{rec.recommendation}
																		</p>
																		<p className="text-muted-foreground text-sm mt-2 italic">
																			{rec.reasoning}
																		</p>
																	</div>
																	<Badge
																		className={
																			rec.riskLevel === "low"
																				? "bg-emerald-500/20 text-emerald-400"
																				: rec.riskLevel === "medium"
																					? "bg-amber-500/20 text-amber-400"
																					: "bg-red-500/20 text-red-400"
																		}
																	>
																		{rec.riskLevel} risk
																	</Badge>
																</div>
															</CardContent>
														</Card>
													))}
											</div>
										</div>
									)}

									{/* Investment Proposal Summary */}
									{autoFetchResult.aiAnalysis.proposal && (
										<div className="mt-6 pt-4 border-t border-border">
											<h3 className="text-lg font-semibold text-foreground mb-3">
												Investment Proposal Summary
											</h3>
											<p className="text-muted-foreground">
												{autoFetchResult.aiAnalysis.proposal.summary}
											</p>
											{autoFetchResult.aiAnalysis.proposal.riskAssessment && (
												<div className="mt-4 flex items-center gap-2">
													<span className="text-muted-foreground">
														Overall Risk:
													</span>
													<Badge
														className={
															autoFetchResult.aiAnalysis.proposal.riskAssessment
																.overallRisk === "low"
																? "bg-emerald-500/20 text-emerald-400"
																: autoFetchResult.aiAnalysis.proposal
																			.riskAssessment.overallRisk === "medium"
																	? "bg-amber-500/20 text-amber-400"
																	: "bg-red-500/20 text-red-400"
														}
													>
														{autoFetchResult.aiAnalysis.proposal.riskAssessment.overallRisk.toUpperCase()}
													</Badge>
												</div>
											)}
										</div>
									)}
								</CardContent>
							</Card>
						)}
						<Card className="bg-card/50 border-border">
							<CardContent className="p-0">
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b border-border">
												<th className="text-left p-4 text-muted-foreground text-sm font-medium">
													Investment
												</th>
												<th className="text-left p-4 text-muted-foreground text-sm font-medium">
													Type
												</th>
												<th className="text-right p-4 text-muted-foreground text-sm font-medium">
													Invested
												</th>
												<th className="text-right p-4 text-muted-foreground text-sm font-medium">
													Current
												</th>
												<th className="text-right p-4 text-muted-foreground text-sm font-medium">
													Returns
												</th>
												<th className="text-right p-4 text-muted-foreground text-sm font-medium">
													Returns %
												</th>
											</tr>
										</thead>
										<tbody>
											{holdings.map((holding) => (
												<tr
													key={holding.id}
													className="border-b border-border/50 hover:bg-background/50"
												>
													<td className="p-4">
														<span className="text-foreground font-medium">
															{holding.name}
														</span>
													</td>
													<td className="p-4">
														<Badge
															variant="outline"
															className="border-border text-muted-foreground"
														>
															{holding.type}
														</Badge>
													</td>
													<td className="p-4 text-right text-muted-foreground">
														{formatCurrency(holding.invested)}
													</td>
													<td className="p-4 text-right text-foreground font-medium">
														{formatCurrency(holding.current)}
													</td>
													<td className="p-4 text-right">
														<span
															className={
																holding.returns >= 0
																	? "text-emerald-400"
																	: "text-red-400"
															}
														>
															{holding.returns >= 0 ? "+" : ""}
															{formatCurrency(holding.returns)}
														</span>
													</td>
													<td className="p-4 text-right">
														<span
															className={`flex items-center justify-end gap-1 ${holding.returnsPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}
														>
															{holding.returnsPercent >= 0 ? (
																<TrendingUp className="h-3 w-3" />
															) : (
																<TrendingDown className="h-3 w-3" />
															)}
															{holding.returnsPercent >= 0 ? "+" : ""}
															{holding.returnsPercent.toFixed(1)}%
														</span>
													</td>
												</tr>
											))}
										</tbody>
										<tfoot>
											<tr className="bg-background/50">
												<td
													colSpan={2}
													className="p-4 text-foreground font-bold"
												>
													Total
												</td>
												<td className="p-4 text-right text-muted-foreground font-medium">
													{formatCurrency(
														(Array.isArray(holdings) ? holdings : []).reduce(
															(s, h) => s + h.invested,
															0,
														),
													)}
												</td>
												<td className="p-4 text-right text-foreground font-bold">
													{formatCurrency(
														(Array.isArray(holdings) ? holdings : []).reduce(
															(s, h) => s + h.current,
															0,
														),
													)}
												</td>
												<td className="p-4 text-right text-emerald-400 font-bold">
													+
													{formatCurrency(
														(Array.isArray(holdings) ? holdings : []).reduce(
															(s, h) => s + h.returns,
															0,
														),
													)}
												</td>
												<td className="p-4 text-right text-emerald-400 font-bold">
													+
													{(
														((Array.isArray(holdings) ? holdings : []).reduce(
															(s, h) => s + h.returns,
															0,
														) /
															((Array.isArray(holdings) ? holdings : []).reduce(
																(s, h) => s + h.invested,
																0,
															) || 1)) *
														100
													).toFixed(1)}
													%
												</td>
											</tr>
										</tfoot>
									</table>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Meeting Notes Tab */}
					<TabsContent value="notes" className="space-y-4">
						<div className="flex justify-between items-center">
							<h2 className="text-xl font-bold text-foreground">
								Meeting Notes
							</h2>
							<Dialog open={showAddNote} onOpenChange={setShowAddNote}>
								<DialogTrigger asChild>
									<Button
										className="bg-emerald-600 hover:bg-emerald-700"
										data-testid="button-add-note"
									>
										<Plus className="h-4 w-4 mr-2" />
										Add Note
									</Button>
								</DialogTrigger>
								<DialogContent className="bg-background border-border text-foreground max-w-lg">
									<DialogHeader>
										<DialogTitle>Add Meeting Note</DialogTitle>
										<DialogDescription className="text-muted-foreground">
											Record notes from your client interaction
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-4 mt-4">
										<div>
											<Label className="text-muted-foreground">
												Meeting Type
											</Label>
											<div className="flex gap-2 mt-2">
												{["call", "meeting", "video"].map((type) => (
													<Button
														key={type}
														variant={
															newNote.type === type ? "default" : "outline"
														}
														size="sm"
														onClick={() =>
															setNewNote({ ...newNote, type: type as any })
														}
														className={
															newNote.type === type
																? "bg-emerald-600"
																: "border-border"
														}
													>
														{type === "call" && (
															<PhoneCall className="h-4 w-4 mr-1" />
														)}
														{type === "meeting" && (
															<User className="h-4 w-4 mr-1" />
														)}
														{type === "video" && (
															<Video className="h-4 w-4 mr-1" />
														)}
														{type.charAt(0).toUpperCase() + type.slice(1)}
													</Button>
												))}
											</div>
										</div>
										<div>
											<Label
												htmlFor="summary"
												className="text-muted-foreground"
											>
												Summary
											</Label>
											<Textarea
												id="summary"
												value={newNote.summary}
												onChange={(e) =>
													setNewNote({ ...newNote, summary: e.target.value })
												}
												className="mt-1 bg-card border-border"
												placeholder="Key discussion points..."
												rows={3}
											/>
										</div>
										<div>
											<Label
												htmlFor="actions"
												className="text-muted-foreground"
											>
												Action Items (one per line)
											</Label>
											<Textarea
												id="actions"
												value={newNote.actionItems}
												onChange={(e) =>
													setNewNote({
														...newNote,
														actionItems: e.target.value,
													})
												}
												className="mt-1 bg-card border-border"
												placeholder="- Action 1&#10;- Action 2"
												rows={2}
											/>
										</div>
										<div>
											<Label htmlFor="next" className="text-muted-foreground">
												Next Steps
											</Label>
											<Input
												id="next"
												value={newNote.nextSteps}
												onChange={(e) =>
													setNewNote({ ...newNote, nextSteps: e.target.value })
												}
												className="mt-1 bg-card border-border"
												placeholder="Follow-up plan..."
											/>
										</div>
										<div className="flex justify-end gap-3 pt-4">
											<Button
												variant="outline"
												onClick={() => setShowAddNote(false)}
												className="border-border"
											>
												Cancel
											</Button>
											<Button className="bg-emerald-600 hover:bg-emerald-700">
												Save Note
											</Button>
										</div>
									</div>
								</DialogContent>
							</Dialog>
						</div>
						<div className="space-y-4">
							{notes.map((note) => (
								<Card key={note.id} className="bg-card/50 border-border">
									<CardContent className="p-4">
										<div className="flex items-start gap-4">
											<div
												className={`p-2 rounded-lg ${note.type === "call" ? "bg-blue-500/20" : note.type === "meeting" ? "bg-purple-500/20" : "bg-cyan-500/20"}`}
											>
												{note.type === "call" && (
													<PhoneCall className="h-5 w-5 text-blue-400" />
												)}
												{note.type === "meeting" && (
													<User className="h-5 w-5 text-purple-400" />
												)}
												{note.type === "video" && (
													<Video className="h-5 w-5 text-cyan-400" />
												)}
											</div>
											<div className="flex-1">
												<div className="flex items-center justify-between mb-2">
													<Badge
														variant="outline"
														className="border-border text-muted-foreground"
													>
														{note.type.charAt(0).toUpperCase() +
															note.type.slice(1)}
													</Badge>
													<span className="text-muted-foreground text-sm">
														{formatDate(note.date)}
													</span>
												</div>
												<p className="text-foreground mb-3">{note.summary}</p>
												{note.actionItems.length > 0 && (
													<div className="mb-3">
														<p className="text-muted-foreground text-sm mb-1">
															Action Items:
														</p>
														<ul className="list-disc list-inside text-sm text-muted-foreground">
															{note.actionItems.map((item, i) => (
																<li key={i}>{item}</li>
															))}
														</ul>
													</div>
												)}
												<div className="flex items-center gap-2 text-sm">
													<ChevronRight className="h-4 w-4 text-emerald-400" />
													<span className="text-muted-foreground">
														{note.nextSteps}
													</span>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</TabsContent>

					{/* Activity Timeline Tab */}
					<TabsContent value="activity" className="space-y-4">
						<h2 className="text-xl font-bold text-foreground">
							Activity Timeline
						</h2>
						<Card className="bg-card/50 border-border">
							<CardContent className="p-4">
								<div className="space-y-4">
									{activities.map((activity, index) => {
										const Icon = getActivityIcon(activity.type);
										return (
											<div key={activity.id} className="flex gap-4">
												<div className="flex flex-col items-center">
													<div
														className={`p-2 rounded-full ${getActivityColor(activity.type)}`}
													>
														<Icon className="h-4 w-4" />
													</div>
													{index < activities.length - 1 && (
														<div className="w-0.5 flex-1 bg-muted my-2" />
													)}
												</div>
												<div className="flex-1 pb-4">
													<div className="flex items-start justify-between">
														<div>
															<p className="text-foreground font-medium">
																{activity.title}
															</p>
															<p className="text-muted-foreground text-sm">
																{activity.description}
															</p>
															{activity.amount && (
																<p className="text-emerald-400 text-sm mt-1">
																	{formatCurrency(activity.amount)}
																</p>
															)}
														</div>
														<div className="text-right">
															<p className="text-muted-foreground text-sm">
																{formatDate(activity.date)}
															</p>
															{activity.status && (
																<Badge
																	className={`mt-1 ${activity.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : activity.status === "action_needed" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}
																>
																	{activity.status.replace("_", " ")}
																</Badge>
															)}
														</div>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
