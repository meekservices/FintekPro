import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	AlertTriangle,
	CheckCircle,
	Settings,
	ShieldAlert,
	Monitor,
	Globe,
	Server,
	TrendingUp,
	Building2,
	Brain,
	BarChart3,
	Lightbulb,
	Loader2,
} from "lucide-react";

interface ApiStatusData {
	overall?: string;
	timestamp?: string;
	apis?: Record<string, any>;
	systemHealth?: any;
}

export default function ApiMonitorDemo() {
	const {
		data: apiStatus = {} as ApiStatusData,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["/api/public/api-status"],
		refetchInterval: 10000, // Refresh every 10 seconds for real-time monitoring
	});

	const getStatusColor = (status: string) => {
		switch (status) {
			case "healthy":
			case "configured":
			case "available":
				return "bg-gradient-to-r from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30 border-green-200 dark:border-green-800 hover:from-green-100 dark:from-green-900/30 hover:to-emerald-100 dark:to-emerald-900/30";
			case "degraded":
				return "bg-gradient-to-r from-yellow-50 dark:from-yellow-950/30 to-orange-50 dark:to-orange-950/30 border-yellow-200 dark:border-yellow-800 hover:from-yellow-100 dark:from-yellow-900/30 hover:to-orange-100 dark:to-orange-900/30";
			case "error":
				return "bg-gradient-to-r from-red-50 dark:from-red-950/30 to-pink-50 dark:to-pink-950/30 border-red-200 dark:border-red-800 hover:from-red-100 dark:from-red-900/30 hover:to-pink-100 dark:to-pink-900/30";
			case "not_configured":
				return "bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-cyan-50 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800 hover:from-blue-100 dark:from-blue-900/30 hover:to-cyan-100 dark:to-cyan-900/30";
			default:
				return "bg-gradient-to-r from-gray-50 to-slate-50 border-border hover:from-gray-100 hover:to-slate-100";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "healthy":
			case "configured":
			case "available":
				return <CheckCircle className="w-6 h-6 text-green-600 animate-pulse" />;
			case "degraded":
				return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
			case "error":
				return <ShieldAlert className="w-6 h-6 text-red-600 animate-bounce" />;
			case "not_configured":
				return <Settings className="w-6 h-6 text-blue-600" />;
			default:
				return <Monitor className="w-6 h-6 text-muted-foreground" />;
		}
	};

	const getApiTypeIcon = (apiName: string) => {
		const name = apiName?.toLowerCase() || "";
		if (name.includes("database") || name.includes("postgresql"))
			return <Server className="w-5 h-5" />;
		if (name.includes("yahoo") || name.includes("finance"))
			return <TrendingUp className="w-5 h-5" />;
		if (name.includes("jm financial")) return <Building2 className="w-5 h-5" />;
		if (name.includes("interactive") || name.includes("brokers"))
			return <BarChart3 className="w-5 h-5" />;
		return <Globe className="w-5 h-5" />;
	};

	const getResponseTimeColor = (responseTime: string) => {
		const time = Number.parseInt(responseTime?.replace(/[^\d]/g, "") || "0");
		if (time < 200) return "text-green-600";
		if (time < 1000) return "text-yellow-600";
		return "text-red-600";
	};

	const getStatusBadgeClass = (status: string) => {
		switch (status) {
			case "healthy":
			case "configured":
			case "available":
				return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700";
			case "degraded":
				return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700";
			case "error":
				return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700";
			case "not_configured":
				return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700";
			default:
				return "bg-muted text-muted-foreground border-border";
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:to-blue-950/30 p-6">
				<div className="max-w-7xl mx-auto">
					<Card className="overflow-hidden">
						<CardHeader className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30">
							<CardTitle className="flex items-center gap-2">
								<Loader2 className="w-6 h-6 animate-spin text-blue-600" />
								API Status Monitor - Loading...
							</CardTitle>
						</CardHeader>
						<CardContent className="p-6">
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{[1, 2, 3, 4, 5, 6].map((i) => (
									<div key={i} className="animate-pulse">
										<div className="h-32 bg-muted rounded-lg" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:to-blue-950/30 p-6">
				<div className="max-w-7xl mx-auto">
					<Card className="border-red-200 dark:border-red-800">
						<CardHeader className="bg-gradient-to-r from-red-50 dark:from-red-950/30 to-pink-50 dark:to-pink-950/30 border-b border-red-200 dark:border-red-800">
							<CardTitle className="flex items-center gap-2 text-red-600">
								<ShieldAlert className="w-6 h-6" />
								API Status Monitor - Connection Error
							</CardTitle>
						</CardHeader>
						<CardContent className="p-6">
							<div className="text-center py-8">
								<AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
								<h3 className="text-lg font-semibold text-red-600 mb-2">
									Failed to fetch API status
								</h3>
								<p className="text-red-500">
									Please check your connection and try again.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:to-blue-950/30 p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Header */}
				<div className="text-center">
					<h1 className="text-4xl font-bold text-foreground mb-2">
						Individual API Status Monitor
					</h1>
					<p className="text-muted-foreground">
						Real-time monitoring of all integrated financial services
					</p>
				</div>

				{/* Overall Status Dashboard */}
				<Card className="overflow-hidden">
					<CardHeader className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-b-2 border-blue-200 dark:border-blue-800">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<div className="p-2 rounded-full bg-card bg-opacity-50">
									{getStatusIcon(
										(apiStatus as ApiStatusData)?.overall || "unknown",
									)}
								</div>
								<div>
									<CardTitle className="text-2xl font-bold">
										System Status:{" "}
										{(
											(apiStatus as ApiStatusData)?.overall || "Unknown"
										).toUpperCase()}
									</CardTitle>
									<div className="text-sm opacity-80 mt-1">
										Last Updated:{" "}
										{(apiStatus as ApiStatusData)?.timestamp
											? new Date(
													(apiStatus as ApiStatusData).timestamp!,
												).toLocaleString()
											: "Unknown"}
									</div>
								</div>
							</div>
							<div className="text-right">
								<div className="text-sm opacity-80">Total APIs</div>
								<div className="text-3xl font-bold">
									{Object.keys((apiStatus as ApiStatusData)?.apis || {}).length}
								</div>
							</div>
						</div>
					</CardHeader>
					<CardContent className="p-4">
						<div className="grid grid-cols-4 gap-4 text-center">
							<div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
								<div className="text-2xl font-bold text-green-600">
									{
										Object.values(
											(apiStatus as ApiStatusData)?.apis || {},
										).filter(
											(api: any) =>
												api.status === "healthy" || api.status === "configured",
										).length
									}
								</div>
								<div className="text-sm text-green-600">Healthy</div>
							</div>
							<div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
								<div className="text-2xl font-bold text-yellow-600">
									{
										Object.values(
											(apiStatus as ApiStatusData)?.apis || {},
										).filter((api: any) => api.status === "degraded").length
									}
								</div>
								<div className="text-sm text-yellow-600">Degraded</div>
							</div>
							<div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
								<div className="text-2xl font-bold text-red-600">
									{
										Object.values(
											(apiStatus as ApiStatusData)?.apis || {},
										).filter((api: any) => api.status === "error").length
									}
								</div>
								<div className="text-sm text-red-600">Error</div>
							</div>
							<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
								<div className="text-2xl font-bold text-blue-600">
									{
										Object.values(
											(apiStatus as ApiStatusData)?.apis || {},
										).filter((api: any) => api.status === "not_configured")
											.length
									}
								</div>
								<div className="text-sm text-blue-600">Not Configured</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Individual API Services Grid */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Monitor className="w-6 h-6 text-blue-600" />
							Individual API Services (
							{Object.keys((apiStatus as ApiStatusData)?.apis || {}).length})
						</CardTitle>
						<CardDescription>
							Real-time status monitoring with detailed health metrics for each
							integrated service
						</CardDescription>
					</CardHeader>
					<CardContent className="p-6">
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
							{Object.entries((apiStatus as ApiStatusData)?.apis || {}).map(
								([key, api]: [string, any]) => (
									<Card
										key={key}
										className={`transition-all duration-300 border-2 hover:shadow-lg hover:scale-[1.02] ${getStatusColor(api.status)}`}
									>
										<CardHeader className="pb-3">
											<div className="flex items-start justify-between">
												<div className="flex items-center gap-3">
													<div className="p-2 rounded-lg bg-card bg-opacity-70 shadow-sm">
														{getApiTypeIcon(api.name)}
													</div>
													<div className="flex-1">
														<CardTitle className="text-lg text-foreground leading-tight">
															{api.name || key}
														</CardTitle>
														<Badge
															variant="outline"
															className={`mt-1 text-xs font-medium ${getStatusBadgeClass(api.status)}`}
														>
															{api.status.replace("_", " ").toUpperCase()}
														</Badge>
													</div>
												</div>
												<div className="flex-shrink-0">
													{getStatusIcon(api.status)}
												</div>
											</div>
										</CardHeader>
										<CardContent className="pt-0">
											<div className="space-y-4">
												<p className="text-sm text-muted-foreground leading-relaxed">
													{api.details}
												</p>

												{/* Performance Metrics */}
												<div className="grid grid-cols-2 gap-3">
													<div className="bg-card bg-opacity-60 p-3 rounded-lg border">
														<div className="text-xs text-muted-foreground mb-1 font-medium">
															Response Time
														</div>
														<div
															className={`text-sm font-bold ${getResponseTimeColor(api.responseTime)}`}
														>
															{api.responseTime || "N/A"}
														</div>
													</div>
													<div className="bg-card bg-opacity-60 p-3 rounded-lg border">
														<div className="text-xs text-muted-foreground mb-1 font-medium">
															Last Check
														</div>
														<div className="text-sm font-medium text-muted-foreground">
															{api.lastChecked
																? new Date(api.lastChecked).toLocaleTimeString(
																		[],
																		{
																			hour: "2-digit",
																			minute: "2-digit",
																			second: "2-digit",
																		},
																	)
																: "Never"}
														</div>
													</div>
												</div>

												{/* Connection Details */}
												{(api.endpoint || api.url) && (
													<div className="bg-muted p-3 rounded-lg border">
														<div className="text-xs text-muted-foreground mb-1 font-medium">
															Endpoint
														</div>
														<div className="text-sm text-muted-foreground font-mono break-all">
															{api.endpoint || api.url}
														</div>
													</div>
												)}

												{/* Error Information */}
												{api.error && (
													<div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-lg">
														<div className="text-xs text-red-500 mb-1 font-medium flex items-center gap-1">
															<AlertTriangle className="w-3 h-3" />
															Error Details
														</div>
														<div className="text-sm text-red-700 dark:text-red-300 leading-tight">
															{api.error}
														</div>
													</div>
												)}

												{/* Status-specific Information */}
												{api.status === "not_configured" && (
													<div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
														<div className="text-xs text-blue-500 mb-1 font-medium flex items-center gap-1">
															<Settings className="w-3 h-3" />
															Configuration Required
														</div>
														<div className="text-sm text-blue-700 dark:text-blue-300 leading-tight">
															This API requires configuration. Please check
															environment variables or settings.
														</div>
													</div>
												)}

												{/* Recommendations */}
												{api.recommendations && (
													<div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-3 rounded-lg">
														<div className="text-xs text-indigo-500 mb-1 font-medium flex items-center gap-1">
															<Lightbulb className="w-3 h-3" />
															Recommendations
														</div>
														<div className="text-sm text-indigo-700 dark:text-indigo-300 leading-tight">
															{api.recommendations}
														</div>
													</div>
												)}
											</div>
										</CardContent>
									</Card>
								),
							)}
						</div>
					</CardContent>
				</Card>

				{/* System Health */}
				{(apiStatus as ApiStatusData)?.systemHealth && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Monitor className="w-5 h-5" />
								System Health Metrics
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div className="text-center p-4 bg-muted rounded-lg">
									<div className="text-2xl font-bold text-blue-600">
										{Math.floor(
											((apiStatus as ApiStatusData).systemHealth?.uptime || 0) /
												60,
										)}
										m
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Uptime
									</div>
								</div>
								<div className="text-center p-4 bg-muted rounded-lg">
									<div className="text-2xl font-bold text-green-600">
										{(
											((apiStatus as ApiStatusData).systemHealth?.memory
												?.heapUsed || 0) /
											1024 /
											1024
										).toFixed(1)}{" "}
										MB
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Memory Used
									</div>
								</div>
								<div className="text-center p-4 bg-muted rounded-lg">
									<div className="text-2xl font-bold text-purple-600">
										{(apiStatus as ApiStatusData).systemHealth?.nodeVersion ||
											"Unknown"}
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Node.js
									</div>
								</div>
								<div className="text-center p-4 bg-muted rounded-lg">
									<div className="text-2xl font-bold text-orange-600">
										{(apiStatus as ApiStatusData).systemHealth
											?.totalResponseTime || "Unknown"}
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Check Duration
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
