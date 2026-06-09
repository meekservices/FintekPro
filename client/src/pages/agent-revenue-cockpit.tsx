import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Progress } from "@/components/ui/progress";
import {
	TrendingUp,
	TrendingDown,
	IndianRupee,
	Users,
	PieChart,
	Target,
	ArrowUpRight,
	ArrowDownRight,
	Calendar,
	Wallet,
	BarChart3,
	FileText,
	CheckCircle,
	Clock,
	XCircle,
	AlertTriangle,
	Award,
	Zap,
	Loader2,
} from "lucide-react";
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart as RechartsPie,
	Pie,
	Cell,
	BarChart,
	Bar,
	Legend,
	LineChart,
	Line,
} from "recharts";

interface RevenueMetrics {
	totalAUM: number;
	aumGrowth: number;
	totalRevenue: number;
	revenueGrowth: number;
	pendingCommissions: number;
	realizedCommissions: number;
	totalClients: number;
	activeClients: number;
	proposalsSent: number;
	proposalsConverted: number;
	conversionRate: number;
	avgDealSize: number;
}

interface ProductMix {
	name: string;
	value: number;
	color: string;
	commission: number;
}

interface MonthlyTrend {
	month: string;
	aum: number;
	revenue: number;
	clients: number;
}

interface CommissionBreakdown {
	product: string;
	pending: number;
	realized: number;
	total: number;
}

const COLORS = [
	"#10b981",
	"#3b82f6",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
];

export default function AgentRevenueCockpit() {
	const [timeRange, setTimeRange] = useState("6m");
	const [activeTab, setActiveTab] = useState("overview");

	const { data: metrics, isLoading: metricsLoading } = useQuery<RevenueMetrics>(
		{
			queryKey: ["/api/agent/revenue/metrics", timeRange],
		},
	);

	const { data: productMix, isLoading: productMixLoading } = useQuery<
		ProductMix[]
	>({
		queryKey: ["/api/agent/revenue/product-mix"],
	});

	const { data: monthlyTrends, isLoading: trendsLoading } = useQuery<
		MonthlyTrend[]
	>({
		queryKey: ["/api/agent/revenue/trends", timeRange],
	});

	const { data: commissions, isLoading: commissionsLoading } = useQuery<
		CommissionBreakdown[]
	>({
		queryKey: ["/api/agent/revenue/commissions"],
	});

	const formatCurrency = (value: number) => {
		if (value >= 10000000) {
			return `₹${(value / 10000000).toFixed(2)} Cr`;
		}
		if (value >= 100000) {
			return `₹${(value / 100000).toFixed(2)} L`;
		}
		if (value >= 1000) {
			return `₹${(value / 1000).toFixed(1)} K`;
		}
		return `₹${value.toFixed(0)}`;
	};

	const emptyMetrics: RevenueMetrics = {
		totalAUM: 0,
		aumGrowth: 0,
		totalRevenue: 0,
		revenueGrowth: 0,
		pendingCommissions: 0,
		realizedCommissions: 0,
		totalClients: 0,
		activeClients: 0,
		proposalsSent: 0,
		proposalsConverted: 0,
		conversionRate: 0,
		avgDealSize: 0,
	};

	const isLoading =
		metricsLoading || productMixLoading || trendsLoading || commissionsLoading;

	const displayMetrics = metrics || emptyMetrics;
	const displayProductMix = productMix || [];
	const displayTrends = monthlyTrends || [];

	const hasNoData =
		(!metrics || metrics.totalAUM === 0) &&
		(!productMix || productMix.length === 0) &&
		(!monthlyTrends || monthlyTrends.length === 0) &&
		(!commissions || commissions.length === 0);
	const displayCommissions = commissions || [];

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background p-6 flex items-center justify-center">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
					<p className="text-muted-foreground">Loading revenue data...</p>
				</div>
			</div>
		);
	}

	if (hasNoData) {
		return (
			<div className="min-h-screen bg-background p-6 flex items-center justify-center">
				<Card className="max-w-md bg-background border-border">
					<CardContent className="p-8 text-center">
						<BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-lg font-semibold text-foreground mb-2">
							No Revenue Data Available
						</h3>
						<p className="text-muted-foreground text-sm">
							Revenue metrics, product mix, and commission data will appear here
							once transactions are recorded.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
					<div>
						<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
							<BarChart3 className="h-7 w-7 text-emerald-500" />
							Revenue Cockpit
						</h1>
						<p className="text-muted-foreground mt-1">
							Track your AUM, commissions, and business performance
						</p>
					</div>
					<div className="flex items-center gap-3">
						<Select value={timeRange} onValueChange={setTimeRange}>
							<SelectTrigger
								className="w-36 bg-card border-border text-foreground"
								data-testid="select-time-range"
							>
								<SelectValue placeholder="Time Range" />
							</SelectTrigger>
							<SelectContent className="bg-card border-border">
								<SelectItem value="1m">Last Month</SelectItem>
								<SelectItem value="3m">3 Months</SelectItem>
								<SelectItem value="6m">6 Months</SelectItem>
								<SelectItem value="1y">1 Year</SelectItem>
							</SelectContent>
						</Select>
						<Button
							className="bg-emerald-600 hover:bg-emerald-700"
							data-testid="button-export-report"
						>
							<FileText className="h-4 w-4 mr-2" />
							Export Report
						</Button>
					</div>
				</div>

				{/* Key Metrics Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<Card className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border-emerald-700/50">
						<CardContent className="p-6">
							<div className="flex justify-between items-start">
								<div>
									<p className="text-emerald-300 text-sm font-medium">
										Total AUM
									</p>
									<p
										className="text-2xl font-bold text-foreground mt-1"
										data-testid="text-total-aum"
									>
										{formatCurrency(displayMetrics.totalAUM)}
									</p>
									<div className="flex items-center mt-2">
										{displayMetrics.aumGrowth >= 0 ? (
											<ArrowUpRight className="h-4 w-4 text-emerald-400" />
										) : (
											<ArrowDownRight className="h-4 w-4 text-red-400" />
										)}
										<span
											className={`text-sm ${displayMetrics.aumGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}
										>
											{Math.abs(displayMetrics.aumGrowth)}% this period
										</span>
									</div>
								</div>
								<div className="p-3 bg-emerald-500/20 rounded-lg">
									<Wallet className="h-6 w-6 text-emerald-400" />
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50">
						<CardContent className="p-6">
							<div className="flex justify-between items-start">
								<div>
									<p className="text-blue-300 text-sm font-medium">
										Total Revenue
									</p>
									<p
										className="text-2xl font-bold text-foreground mt-1"
										data-testid="text-total-revenue"
									>
										{formatCurrency(displayMetrics.totalRevenue)}
									</p>
									<div className="flex items-center mt-2">
										{displayMetrics.revenueGrowth >= 0 ? (
											<ArrowUpRight className="h-4 w-4 text-emerald-400" />
										) : (
											<ArrowDownRight className="h-4 w-4 text-red-400" />
										)}
										<span
											className={`text-sm ${displayMetrics.revenueGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}
										>
											{Math.abs(displayMetrics.revenueGrowth)}% vs last period
										</span>
									</div>
								</div>
								<div className="p-3 bg-blue-500/20 rounded-lg">
									<IndianRupee className="h-6 w-6 text-blue-400" />
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 border-amber-700/50">
						<CardContent className="p-6">
							<div className="flex justify-between items-start">
								<div>
									<p className="text-amber-300 text-sm font-medium">
										Conversion Rate
									</p>
									<p
										className="text-2xl font-bold text-foreground mt-1"
										data-testid="text-conversion-rate"
									>
										{displayMetrics.conversionRate}%
									</p>
									<p className="text-sm text-muted-foreground mt-2">
										{displayMetrics.proposalsConverted}/
										{displayMetrics.proposalsSent} proposals
									</p>
								</div>
								<div className="p-3 bg-amber-500/20 rounded-lg">
									<Target className="h-6 w-6 text-amber-400" />
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700/50">
						<CardContent className="p-6">
							<div className="flex justify-between items-start">
								<div>
									<p className="text-purple-300 text-sm font-medium">
										Active Clients
									</p>
									<p
										className="text-2xl font-bold text-foreground mt-1"
										data-testid="text-active-clients"
									>
										{displayMetrics.activeClients}
									</p>
									<p className="text-sm text-muted-foreground mt-2">
										of {displayMetrics.totalClients} total
									</p>
								</div>
								<div className="p-3 bg-purple-500/20 rounded-lg">
									<Users className="h-6 w-6 text-purple-400" />
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Tabs for Different Views */}
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className="space-y-6"
				>
					<ScrollableTabsList className="bg-card/50 border border-border p-1 rounded-lg">
						<TabsTrigger
							value="overview"
							className="data-[state=active]:bg-emerald-600"
							data-testid="tab-overview"
						>
							Overview
						</TabsTrigger>
						<TabsTrigger
							value="commissions"
							className="data-[state=active]:bg-emerald-600"
							data-testid="tab-commissions"
						>
							Commissions
						</TabsTrigger>
						<TabsTrigger
							value="products"
							className="data-[state=active]:bg-emerald-600"
							data-testid="tab-products"
						>
							Product Mix
						</TabsTrigger>
						<TabsTrigger
							value="performance"
							className="data-[state=active]:bg-emerald-600"
							data-testid="tab-performance"
						>
							Performance
						</TabsTrigger>
					</ScrollableTabsList>

					{/* Overview Tab */}
					<TabsContent value="overview" className="space-y-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* AUM & Revenue Trend Chart */}
							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground flex items-center gap-2">
										<TrendingUp className="h-5 w-5 text-emerald-500" />
										AUM & Revenue Trends
									</CardTitle>
									<CardDescription className="text-muted-foreground">
										Monthly growth over the selected period
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="h-72">
										<ResponsiveContainer width="100%" height="100%">
											<AreaChart data={displayTrends}>
												<defs>
													<linearGradient
														id="colorAum"
														x1="0"
														y1="0"
														x2="0"
														y2="1"
													>
														<stop
															offset="5%"
															stopColor="#10b981"
															stopOpacity={0.3}
														/>
														<stop
															offset="95%"
															stopColor="#10b981"
															stopOpacity={0}
														/>
													</linearGradient>
													<linearGradient
														id="colorRevenue"
														x1="0"
														y1="0"
														x2="0"
														y2="1"
													>
														<stop
															offset="5%"
															stopColor="#3b82f6"
															stopOpacity={0.3}
														/>
														<stop
															offset="95%"
															stopColor="#3b82f6"
															stopOpacity={0}
														/>
													</linearGradient>
												</defs>
												<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
												<XAxis dataKey="month" stroke="#9ca3af" />
												<YAxis
													yAxisId="left"
													stroke="#9ca3af"
													tickFormatter={(value) =>
														`₹${(value / 10000000).toFixed(0)}Cr`
													}
												/>
												<YAxis
													yAxisId="right"
													orientation="right"
													stroke="#9ca3af"
													tickFormatter={(value) =>
														`₹${(value / 100000).toFixed(0)}L`
													}
												/>
												<Tooltip
													contentStyle={{
														backgroundColor: "#1e293b",
														border: "1px solid #475569",
													}}
													labelStyle={{ color: "#fff" }}
													formatter={(value: number, name: string) => [
														formatCurrency(value),
														name === "aum" ? "AUM" : "Revenue",
													]}
												/>
												<Area
													yAxisId="left"
													type="monotone"
													dataKey="aum"
													stroke="#10b981"
													fillOpacity={1}
													fill="url(#colorAum)"
													name="AUM"
												/>
												<Area
													yAxisId="right"
													type="monotone"
													dataKey="revenue"
													stroke="#3b82f6"
													fillOpacity={1}
													fill="url(#colorRevenue)"
													name="Revenue"
												/>
											</AreaChart>
										</ResponsiveContainer>
									</div>
								</CardContent>
							</Card>

							{/* Product Mix Pie Chart */}
							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground flex items-center gap-2">
										<PieChart className="h-5 w-5 text-blue-500" />
										Product Mix
									</CardTitle>
									<CardDescription className="text-muted-foreground">
										AUM distribution by product category
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="h-72 flex items-center">
										<ResponsiveContainer width="60%" height="100%">
											<RechartsPie>
												<Pie
													data={displayProductMix}
													cx="50%"
													cy="50%"
													innerRadius={60}
													outerRadius={90}
													paddingAngle={2}
													dataKey="value"
												>
													{displayProductMix.map((entry, index) => (
														<Cell key={`cell-${index}`} fill={entry.color} />
													))}
												</Pie>
												<Tooltip
													contentStyle={{
														backgroundColor: "#1e293b",
														border: "1px solid #475569",
													}}
													formatter={(value: number) => [`${value}%`, "Share"]}
												/>
											</RechartsPie>
										</ResponsiveContainer>
										<div className="w-40 space-y-2">
											{displayProductMix.map((item, index) => (
												<div
													key={index}
													className="flex items-center justify-between"
												>
													<div className="flex items-center gap-2">
														<div
															className="w-3 h-3 rounded-full"
															style={{ backgroundColor: item.color }}
														/>
														<span className="text-sm text-muted-foreground">
															{item.name}
														</span>
													</div>
													<span className="text-sm font-medium text-foreground">
														{item.value}%
													</span>
												</div>
											))}
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Quick Stats */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<Card className="bg-card/50 border-border">
								<CardContent className="p-4 text-center">
									<CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
									<p className="text-2xl font-bold text-foreground">
										{displayMetrics.proposalsConverted}
									</p>
									<p className="text-sm text-muted-foreground">Converted</p>
								</CardContent>
							</Card>
							<Card className="bg-card/50 border-border">
								<CardContent className="p-4 text-center">
									<Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
									<p className="text-2xl font-bold text-foreground">
										{displayMetrics.proposalsSent -
											displayMetrics.proposalsConverted}
									</p>
									<p className="text-sm text-muted-foreground">Pending</p>
								</CardContent>
							</Card>
							<Card className="bg-card/50 border-border">
								<CardContent className="p-4 text-center">
									<IndianRupee className="h-8 w-8 text-blue-500 mx-auto mb-2" />
									<p className="text-2xl font-bold text-foreground">
										{formatCurrency(displayMetrics.avgDealSize)}
									</p>
									<p className="text-sm text-muted-foreground">Avg Deal Size</p>
								</CardContent>
							</Card>
							<Card className="bg-card/50 border-border">
								<CardContent className="p-4 text-center">
									<Award className="h-8 w-8 text-purple-500 mx-auto mb-2" />
									<p className="text-2xl font-bold text-foreground">Top 15%</p>
									<p className="text-sm text-muted-foreground">Peer Ranking</p>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					{/* Commissions Tab */}
					<TabsContent value="commissions" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<Card className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border-emerald-700/50">
								<CardContent className="p-6">
									<p className="text-emerald-300 text-sm font-medium">
										Realized Commissions
									</p>
									<p
										className="text-3xl font-bold text-foreground mt-2"
										data-testid="text-realized-commissions"
									>
										{formatCurrency(displayMetrics.realizedCommissions)}
									</p>
									<Badge className="mt-3 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
										Paid Out
									</Badge>
								</CardContent>
							</Card>
							<Card className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 border-amber-700/50">
								<CardContent className="p-6">
									<p className="text-amber-300 text-sm font-medium">
										Pending Commissions
									</p>
									<p
										className="text-3xl font-bold text-foreground mt-2"
										data-testid="text-pending-commissions"
									>
										{formatCurrency(displayMetrics.pendingCommissions)}
									</p>
									<Badge className="mt-3 bg-amber-500/20 text-amber-300 border-amber-500/30">
										Processing
									</Badge>
								</CardContent>
							</Card>
							<Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50">
								<CardContent className="p-6">
									<p className="text-blue-300 text-sm font-medium">
										Total Earnings
									</p>
									<p className="text-3xl font-bold text-foreground mt-2">
										{formatCurrency(displayMetrics.totalRevenue)}
									</p>
									<Badge className="mt-3 bg-blue-500/20 text-blue-300 border-blue-500/30">
										This Period
									</Badge>
								</CardContent>
							</Card>
						</div>

						{/* Commission Breakdown Chart */}
						<Card className="bg-background/50 border-border">
							<CardHeader>
								<CardTitle className="text-foreground">
									Commission Breakdown by Product
								</CardTitle>
								<CardDescription className="text-muted-foreground">
									Realized vs pending commissions per product category
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="h-80">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart data={displayCommissions} layout="vertical">
											<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
											<XAxis
												type="number"
												stroke="#9ca3af"
												tickFormatter={(value) =>
													`₹${(value / 100000).toFixed(0)}L`
												}
											/>
											<YAxis
												type="category"
												dataKey="product"
												stroke="#9ca3af"
												width={100}
											/>
											<Tooltip
												contentStyle={{
													backgroundColor: "#1e293b",
													border: "1px solid #475569",
												}}
												formatter={(value: number) => formatCurrency(value)}
											/>
											<Legend />
											<Bar
												dataKey="realized"
												name="Realized"
												fill="#10b981"
												stackId="a"
											/>
											<Bar
												dataKey="pending"
												name="Pending"
												fill="#f59e0b"
												stackId="a"
											/>
										</BarChart>
									</ResponsiveContainer>
								</div>
							</CardContent>
						</Card>

						{/* Commission Table */}
						<Card className="bg-background/50 border-border">
							<CardHeader>
								<CardTitle className="text-foreground">
									Detailed Commission Summary
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b border-border">
												<th className="text-left py-3 px-4 text-muted-foreground font-medium">
													Product
												</th>
												<th className="text-right py-3 px-4 text-muted-foreground font-medium">
													Realized
												</th>
												<th className="text-right py-3 px-4 text-muted-foreground font-medium">
													Pending
												</th>
												<th className="text-right py-3 px-4 text-muted-foreground font-medium">
													Total
												</th>
												<th className="text-right py-3 px-4 text-muted-foreground font-medium">
													% of Total
												</th>
											</tr>
										</thead>
										<tbody>
											{displayCommissions.map((item, index) => {
												const totalCommission = displayCommissions.reduce(
													(sum, c) => sum + c.total,
													0,
												);
												const percentage = (
													(item.total / totalCommission) *
													100
												).toFixed(1);
												return (
													<tr
														key={index}
														className="border-b border-border hover:bg-card/50"
													>
														<td className="py-3 px-4 text-foreground font-medium">
															{item.product}
														</td>
														<td className="py-3 px-4 text-right text-emerald-400">
															{formatCurrency(item.realized)}
														</td>
														<td className="py-3 px-4 text-right text-amber-400">
															{formatCurrency(item.pending)}
														</td>
														<td className="py-3 px-4 text-right text-foreground font-medium">
															{formatCurrency(item.total)}
														</td>
														<td className="py-3 px-4 text-right">
															<Badge
																variant="outline"
																className="border-border text-muted-foreground"
															>
																{percentage}%
															</Badge>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Products Tab */}
					<TabsContent value="products" className="space-y-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Product Performance Cards */}
							<div className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">
									Product Performance
								</h3>
								{displayProductMix.map((product, index) => (
									<Card key={index} className="bg-card/50 border-border">
										<CardContent className="p-4">
											<div className="flex items-center justify-between mb-3">
												<div className="flex items-center gap-3">
													<div
														className="w-4 h-4 rounded-full"
														style={{ backgroundColor: product.color }}
													/>
													<span className="text-foreground font-medium">
														{product.name}
													</span>
												</div>
												<Badge
													className="text-foreground"
													style={{
														backgroundColor: `${product.color}40`,
														borderColor: product.color,
													}}
												>
													{product.value}% of AUM
												</Badge>
											</div>
											<div className="flex justify-between items-center">
												<span className="text-muted-foreground text-sm">
													Commission Earned
												</span>
												<span className="text-emerald-400 font-medium">
													{formatCurrency(product.commission)}
												</span>
											</div>
											<Progress
												value={product.value}
												className="mt-3 h-2 bg-muted"
											/>
										</CardContent>
									</Card>
								))}
							</div>

							{/* Product Recommendations */}
							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground flex items-center gap-2">
										<Zap className="h-5 w-5 text-amber-500" />
										Growth Opportunities
									</CardTitle>
									<CardDescription className="text-muted-foreground">
										AI-suggested areas to expand your business
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="p-4 bg-emerald-900/20 border border-emerald-700/50 rounded-lg">
										<div className="flex items-start gap-3">
											<TrendingUp className="h-5 w-5 text-emerald-400 mt-0.5" />
											<div>
												<p className="text-foreground font-medium">
													Increase Bond Allocation
												</p>
												<p className="text-sm text-muted-foreground mt-1">
													Your bond allocation is below average. High-rated NCDs
													and SGBs offer stable returns with low risk.
												</p>
												<Badge className="mt-2 bg-emerald-500/20 text-emerald-300">
													+₹5L potential
												</Badge>
											</div>
										</div>
									</div>
									<div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
										<div className="flex items-start gap-3">
											<Target className="h-5 w-5 text-blue-400 mt-0.5" />
											<div>
												<p className="text-foreground font-medium">
													Cross-sell AIF to HNI Clients
												</p>
												<p className="text-sm text-muted-foreground mt-1">
													12 of your clients qualify for Category II AIFs.
													Higher ticket size means better commissions.
												</p>
												<Badge className="mt-2 bg-blue-500/20 text-blue-300">
													12 eligible clients
												</Badge>
											</div>
										</div>
									</div>
									<div className="p-4 bg-purple-900/20 border border-purple-700/50 rounded-lg">
										<div className="flex items-start gap-3">
											<Users className="h-5 w-5 text-purple-400 mt-0.5" />
											<div>
												<p className="text-foreground font-medium">
													Reactivate Dormant Clients
												</p>
												<p className="text-sm text-muted-foreground mt-1">
													14 clients haven't invested in 6+ months. Schedule
													review meetings to re-engage them.
												</p>
												<Badge className="mt-2 bg-purple-500/20 text-purple-300">
													14 dormant clients
												</Badge>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					{/* Performance Tab */}
					<TabsContent value="performance" className="space-y-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Client Growth Chart */}
							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground flex items-center gap-2">
										<Users className="h-5 w-5 text-purple-500" />
										Client Growth
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="h-64">
										<ResponsiveContainer width="100%" height="100%">
											<LineChart data={displayTrends}>
												<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
												<XAxis dataKey="month" stroke="#9ca3af" />
												<YAxis stroke="#9ca3af" />
												<Tooltip
													contentStyle={{
														backgroundColor: "#1e293b",
														border: "1px solid #475569",
													}}
												/>
												<Line
													type="monotone"
													dataKey="clients"
													stroke="#8b5cf6"
													strokeWidth={3}
													dot={{ fill: "#8b5cf6", strokeWidth: 2 }}
												/>
											</LineChart>
										</ResponsiveContainer>
									</div>
								</CardContent>
							</Card>

							{/* Performance Metrics */}
							<Card className="bg-background/50 border-border">
								<CardHeader>
									<CardTitle className="text-foreground">
										Key Performance Indicators
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-6">
									<div>
										<div className="flex justify-between text-sm mb-2">
											<span className="text-muted-foreground">
												Proposal Conversion Rate
											</span>
											<span className="text-foreground font-medium">
												{displayMetrics.conversionRate}%
											</span>
										</div>
										<Progress
											value={displayMetrics.conversionRate}
											className="h-2 bg-muted"
										/>
										<p className="text-xs text-muted-foreground mt-1">
											Target: 70% | Industry Avg: 55%
										</p>
									</div>
									<div>
										<div className="flex justify-between text-sm mb-2">
											<span className="text-muted-foreground">
												Client Retention Rate
											</span>
											<span className="text-foreground font-medium">91%</span>
										</div>
										<Progress value={91} className="h-2 bg-muted" />
										<p className="text-xs text-muted-foreground mt-1">
											Target: 90% | Industry Avg: 85%
										</p>
									</div>
									<div>
										<div className="flex justify-between text-sm mb-2">
											<span className="text-muted-foreground">
												AUM per Client
											</span>
											<span className="text-foreground font-medium">
												{formatCurrency(
													displayMetrics.totalAUM /
														displayMetrics.activeClients,
												)}
											</span>
										</div>
										<Progress value={75} className="h-2 bg-muted" />
										<p className="text-xs text-muted-foreground mt-1">
											Target: ₹10L | Your Rank: Top 25%
										</p>
									</div>
									<div>
										<div className="flex justify-between text-sm mb-2">
											<span className="text-muted-foreground">
												Monthly Revenue Target
											</span>
											<span className="text-foreground font-medium">
												82% achieved
											</span>
										</div>
										<Progress value={82} className="h-2 bg-muted" />
										<p className="text-xs text-muted-foreground mt-1">
											₹15.5L / ₹19L target
										</p>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Peer Comparison */}
						<Card className="bg-background/50 border-border">
							<CardHeader>
								<CardTitle className="text-foreground flex items-center gap-2">
									<Award className="h-5 w-5 text-amber-500" />
									Peer Comparison
								</CardTitle>
								<CardDescription className="text-muted-foreground">
									How you stack up against other agents in your region
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
									<div className="text-center">
										<p className="text-3xl font-bold text-emerald-400">
											Top 15%
										</p>
										<p className="text-sm text-muted-foreground mt-1">
											Overall Ranking
										</p>
									</div>
									<div className="text-center">
										<p className="text-3xl font-bold text-blue-400">Top 20%</p>
										<p className="text-sm text-muted-foreground mt-1">
											AUM Growth
										</p>
									</div>
									<div className="text-center">
										<p className="text-3xl font-bold text-purple-400">
											Top 10%
										</p>
										<p className="text-sm text-muted-foreground mt-1">
											Conversion Rate
										</p>
									</div>
									<div className="text-center">
										<p className="text-3xl font-bold text-amber-400">Top 25%</p>
										<p className="text-sm text-muted-foreground mt-1">
											Client Retention
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
