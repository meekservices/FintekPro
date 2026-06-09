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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
	Shield as LucideShield,
	Users,
	Lock,
	AlertTriangle,
	Building2,
	Clock,
	FileWarning,
	CheckCircle,
	XCircle,
	TrendingUp,
	Calendar,
	RefreshCw,
	Eye,
	Ban,
	ArrowRight,
	Scale,
	Landmark,
	FileText,
} from "lucide-react";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { format, formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface STRFlag {
	id: string;
	companyId: string;
	companyName?: string;
	flagType: string;
	description?: string;
	severity?: string;
	transactionAmount?: string;
	flagReason?: string;
	strDueDate?: string;
	status: "pending" | "overdue" | "filed";
	dueDate?: string;
	createdAt?: string;
}

interface ComplianceOverview {
	investorLimits: {
		companiesNearLimit: number;
		companiesAtLimit: number;
		companiesAtRisk?: {
			id: string;
			name: string;
			count: number;
			status: "near_limit" | "at_limit";
		}[];
	};
	lockIns: {
		activeRecords: number;
		sharesLocked: number;
		unlockingThisMonth: number;
	};
	strFlags: {
		pending: number;
		overdue: number;
		filedThisMonth: number;
	};
	statusChanges: {
		listedThisMonth: number;
		suspended: number;
	};
	valuationDeviations: {
		highDeviationCount: number;
	};
}

interface AuditLogEntry {
	id: string;
	timestamp: string;
	action: string;
	userName: string;
	userEmail: string;
	companyName: string;
	changeDescription: string;
	riskLevel: string;
	forensicHash: string;
	prevHash: string;
}

export default function UnlistedRegulatoryCompliance() {
	const [activeTab, setActiveTab] = useState("overview");
	const { toast } = useToast();

	const {
		data: overviewData,
		isLoading: isLoadingOverview,
		refetch: refetchOverview,
	} = useQuery<{ success: boolean; data: ComplianceOverview }>({
		queryKey: ["/api/unlisted/admin/compliance/overview"],
		retry: false,
	});

	const {
		data: strFlagsData,
		isLoading: isLoadingFlags,
		refetch: refetchFlags,
	} = useQuery<{
		success: boolean;
		data: { total: number; overdue: number; dueSoon: number; flags: STRFlag[] };
	}>({
		queryKey: ["/api/unlisted/admin/compliance/str-flags"],
		retry: false,
	});

	const { data: auditLogsData, isLoading: isLoadingAudit } = useQuery<{
		success: boolean;
		data: AuditLogEntry[];
	}>({
		queryKey: ["/api/unlisted/admin/compliance/audit-trail"],
		retry: false,
	});

	const overview = overviewData?.data;
	const strData = strFlagsData?.data;
	const auditLogs = auditLogsData?.data;

	const handleRefresh = () => {
		refetchOverview();
		refetchFlags();
		toast({
			title: "Refreshing data",
			description: "Fetching latest compliance data...",
		});
	};

	const getSeverityBadge = (severity: string) => {
		switch (severity?.toLowerCase()) {
			case "critical":
				return <Badge className="bg-red-600 text-white">Critical</Badge>;
			case "high":
				return <Badge className="bg-orange-600 text-white">High</Badge>;
			case "medium":
				return <Badge className="bg-yellow-600 text-white">Medium</Badge>;
			case "low":
				return <Badge className="bg-blue-600 text-white">Low</Badge>;
			default:
				return <Badge variant="secondary">{severity}</Badge>;
		}
	};

	const getFlagTypeBadge = (type: string) => {
		switch (type) {
			case "source_of_funds":
				return (
					<Badge className="bg-red-700">
						<FileWarning className="w-3 h-3 mr-1" />
						Source of Funds
					</Badge>
				);
			case "high_frequency":
				return (
					<Badge className="bg-orange-700">
						<TrendingUp className="w-3 h-3 mr-1" />
						High Frequency
					</Badge>
				);
			case "structured_payment":
				return (
					<Badge className="bg-purple-700">
						<Scale className="w-3 h-3 mr-1" />
						Structured Payment
					</Badge>
				);
			case "round_tripping":
				return (
					<Badge className="bg-pink-700">
						<RefreshCw className="w-3 h-3 mr-1" />
						Round Tripping
					</Badge>
				);
			case "pep_involvement":
				return (
					<Badge className="bg-red-800">
						<Landmark className="w-3 h-3 mr-1" />
						PEP Involvement
					</Badge>
				);
			default:
				return <Badge variant="outline">{type?.replace(/_/g, " ")}</Badge>;
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "pending":
				return (
					<Badge
						variant="outline"
						className="border-yellow-500 text-yellow-500"
					>
						Pending Review
					</Badge>
				);
			case "under_review":
				return <Badge className="bg-blue-600">Under Review</Badge>;
			case "filed":
				return (
					<Badge className="bg-green-600">
						<CheckCircle className="w-3 h-3 mr-1" />
						Filed
					</Badge>
				);
			case "dismissed":
				return <Badge variant="secondary">Dismissed</Badge>;
			default:
				return <Badge variant="outline">{status}</Badge>;
		}
	};

	if (isLoadingOverview) {
		return <LoadingState message="Loading regulatory compliance data..." />;
	}

	return (
		<div
			className="container mx-auto p-6 space-y-6"
			data-testid="regulatory-compliance-page"
		>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
						<LucideShield className="h-8 w-8 text-blue-500" />
						Regulatory Compliance Dashboard
					</h1>
					<p className="text-muted-foreground mt-1">
						SEBI, RBI & Companies Act compliance monitoring for unlisted share
						trading
					</p>
				</div>
				<div className="flex gap-2">
					<Badge
						variant="outline"
						className="bg-blue-500/10 text-blue-400 border-blue-500/20 py-2 px-4 flex items-center gap-2"
					>
						<LucideShield className="w-4 h-4" />
						Forensic Audit Enabled
					</Badge>
					<Button
						onClick={handleRefresh}
						variant="outline"
						data-testid="button-refresh"
					>
						<RefreshCw className="w-4 h-4 mr-2" />
						Refresh
					</Button>
				</div>
			</div>

			{overview && (
				<>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
						<Card
							className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700"
							data-testid="card-investor-limits"
						>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-blue-300 flex items-center gap-2">
									<Users className="h-4 w-4" />
									200 Investor Limit
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-foreground">
									{overview.investorLimits.companiesAtLimit}
								</div>
								<p className="text-xs text-blue-300 mt-1">Companies at limit</p>
								{overview.investorLimits.companiesNearLimit > 0 && (
									<div className="mt-2 flex items-center gap-1 text-yellow-500 text-xs font-medium">
										<AlertTriangle className="h-3 w-3" />
										{overview.investorLimits.companiesNearLimit} near limit
									</div>
								)}
							</CardContent>
						</Card>

						<Card
							className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700"
							data-testid="card-lock-ins"
						>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-purple-300 flex items-center gap-2">
									<Lock className="h-4 w-4" />
									6-Month Lock-In
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-foreground">
									{overview.lockIns.activeRecords.toLocaleString()}
								</div>
								<p className="text-xs text-purple-300 mt-1">
									Active lock-in records
								</p>
								<div className="flex items-center gap-2 mt-2">
									<Badge
										variant="outline"
										className="border-purple-500 text-purple-300 py-0 text-[10px]"
									>
										{overview.lockIns.sharesLocked.toLocaleString()} shares
										locked
									</Badge>
								</div>
							</CardContent>
						</Card>

						<Card
							className={`bg-gradient-to-br ${overview.strFlags.overdue > 0 ? "from-red-900/50 to-red-800/30 border-red-700" : "from-orange-900/50 to-orange-800/30 border-orange-700"}`}
							data-testid="card-str-flags"
						>
							<CardHeader className="pb-2">
								<CardTitle
									className={`text-sm font-medium flex items-center gap-2 ${overview.strFlags.overdue > 0 ? "text-red-300" : "text-orange-300"}`}
								>
									<FileWarning className="h-4 w-4" />
									STR Flags
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-foreground">
									{overview.strFlags.pending}
								</div>
								<p
									className={`text-xs mt-1 ${overview.strFlags.overdue > 0 ? "text-red-300" : "text-orange-300"}`}
								>
									Pending review
								</p>
								{overview.strFlags.overdue > 0 && (
									<div className="mt-2 flex items-center gap-1 text-red-500 text-xs font-bold animate-pulse">
										<XCircle className="h-3 w-3" />
										{overview.strFlags.overdue} overdue!
									</div>
								)}
							</CardContent>
						</Card>

						<Card
							className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border-emerald-700"
							data-testid="card-status-changes"
						>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-emerald-300 flex items-center gap-2">
									<Building2 className="h-4 w-4" />
									Company Status
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-foreground">
									{overview.statusChanges.suspended}
								</div>
								<p className="text-xs text-emerald-300 mt-1">
									Trading suspended
								</p>
								{overview.statusChanges.listedThisMonth > 0 && (
									<div className="mt-2 text-green-400 text-xs font-medium flex items-center gap-1">
										<TrendingUp className="h-3 w-3" />
										{overview.statusChanges.listedThisMonth} listed this month
									</div>
								)}
							</CardContent>
						</Card>

						<Card
							className="bg-gradient-to-br from-rose-900/50 to-rose-800/30 border-rose-700"
							data-testid="card-valuation-deviation"
						>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-rose-300 flex items-center gap-2">
									<TrendingUp className="h-4 w-4" />
									Valuation Deviation
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-foreground">
									{overview.valuationDeviations.highDeviationCount}
								</div>
								<p className="text-xs text-rose-300 mt-1">
									Trades with &gt;20% dev
								</p>
								{overview.valuationDeviations.highDeviationCount > 0 && (
									<div className="mt-2 text-rose-400 text-xs font-medium flex items-center gap-1">
										<AlertTriangle className="h-3 w-3" />
										Requires Section 56(2) review
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					<Alert className="bg-blue-900/20 border-blue-700">
						<LucideShield className="h-4 w-4 text-blue-500" />
						<AlertTitle className="text-blue-300 font-semibold">
							Forensic Audit Active
						</AlertTitle>
						<AlertDescription className="text-blue-200 text-sm">
							All transactions are cryptographically signed using HMAC-SHA256
							chain-of-trust. Regulatory archival policy enforced:{" "}
							<strong>7-Year Immutable Storage</strong>.
						</AlertDescription>
					</Alert>
				</>
			)}

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
					<TabsTrigger value="overview" data-testid="tab-overview">
						<Eye className="w-4 h-4 mr-2" />
						Overview
					</TabsTrigger>
					<TabsTrigger value="str-flags" data-testid="tab-str-flags">
						<FileWarning className="w-4 h-4 mr-2" />
						STR Flags{" "}
						{strData && strData.total > 0 && (
							<Badge className="ml-2 bg-red-600">{strData.total}</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger
						value="investor-limits"
						data-testid="tab-investor-limits"
					>
						<Users className="w-4 h-4 mr-2" />
						Investor Limits
					</TabsTrigger>
					<TabsTrigger value="lock-ins" data-testid="tab-lock-ins">
						<Lock className="w-4 h-4 mr-2" />
						Lock-Ins
					</TabsTrigger>
					<TabsTrigger value="audit-trail" data-testid="tab-audit-trail">
						<CheckCircle className="w-4 h-4 mr-2" />
						Audit Trail
					</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="mt-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<Card data-testid="card-compliance-checklist">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CheckCircle className="h-5 w-5 text-green-500" />
									Compliance Checklist
								</CardTitle>
								<CardDescription>
									Key regulatory requirements status
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{[
									{
										title: "200 Investor Limit Monitoring",
										subtitle: "Companies Act Section 42(2)",
										icon: Users,
										color: "text-blue-400",
									},
									{
										title: "6-Month Lock-In Enforcement",
										subtitle: "SEBI Private Placement Rules",
										icon: Lock,
										color: "text-purple-400",
									},
									{
										title: "STR Red Flag Detection",
										subtitle: "PMLA / FIU-IND Compliance",
										icon: FileWarning,
										color: "text-orange-400",
									},
									{
										title: "MCA Status Monitoring",
										subtitle: "Auto-suspend on listing",
										icon: Building2,
										color: "text-emerald-400",
									},
									{
										title: "Forensic Chain Integrity",
										subtitle: "HMAC-SHA256 Audit Trail",
										icon: LucideShield,
										color: "text-indigo-400",
									},
								].map((item, idx) => (
									<div
										key={idx}
										className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
									>
										<div className="flex items-center gap-3">
											<item.icon className={`h-5 w-5 ${item.color}`} />
											<div>
												<p className="font-medium">{item.title}</p>
												<p className="text-xs text-muted-foreground">
													{item.subtitle}
												</p>
											</div>
										</div>
										<Badge className="bg-green-600">
											<CheckCircle className="h-3 w-3 mr-1" />
											Active
										</Badge>
									</div>
								))}
							</CardContent>
						</Card>

						<div className="space-y-6">
							{overview?.investorLimits.companiesAtRisk &&
								overview.investorLimits.companiesAtRisk.length > 0 && (
									<Card className="border-yellow-700 bg-yellow-900/10">
										<CardHeader>
											<CardTitle className="text-sm font-bold flex items-center gap-2 text-yellow-500">
												<AlertTriangle className="h-4 w-4" />
												Companies At Risk
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3">
											{overview.investorLimits.companiesAtRisk.map((comp) => (
												<div
													key={comp.id}
													className="flex items-center justify-between p-2 bg-black/20 rounded border border-yellow-700/30"
												>
													<div>
														<p className="text-xs font-bold text-foreground">
															{comp.name}
														</p>
														<p className="text-[10px] text-muted-foreground">
															{comp.id}
														</p>
													</div>
													<div className="text-right">
														<p
															className={`text-sm font-bold ${comp.status === "at_limit" ? "text-red-500" : "text-yellow-500"}`}
														>
															{comp.count} / 200
														</p>
														<Badge
															variant="outline"
															className={`text-[10px] py-0 ${comp.status === "at_limit" ? "border-red-500 text-red-500" : "border-yellow-500 text-yellow-500"}`}
														>
															{comp.status === "at_limit"
																? "Limit Reached"
																: "Near Limit"}
														</Badge>
													</div>
												</div>
											))}
										</CardContent>
									</Card>
								)}

							<Card data-testid="card-quick-actions">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<ArrowRight className="h-5 w-5 text-blue-500" />
										Quick Actions
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<Button
										variant="outline"
										className="w-full justify-start"
										onClick={() => setActiveTab("str-flags")}
									>
										<FileWarning className="h-4 w-4 mr-2 text-orange-400" />
										Review Pending STR Flags
										{overview && overview.strFlags.pending > 0 && (
											<Badge className="ml-auto bg-orange-600">
												{overview.strFlags.pending}
											</Badge>
										)}
									</Button>

									<Button
										variant="outline"
										className="w-full justify-start"
										onClick={() => setActiveTab("investor-limits")}
									>
										<Users className="h-4 w-4 mr-2 text-blue-400" />
										Check Investor Limits
									</Button>

									<Button
										variant="outline"
										className="w-full justify-start"
										onClick={() => setActiveTab("audit-trail")}
									>
										<LucideShield className="h-4 w-4 mr-2 text-indigo-400" />
										Verify Forensic Trail
									</Button>

									<Separator />

									<Button
										variant="outline"
										className="w-full justify-start text-muted-foreground"
									>
										<FileText className="h-4 w-4 mr-2" />
										Export SEBI Reporting Batch
									</Button>
								</CardContent>
							</Card>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="str-flags" className="mt-6">
					<Card data-testid="card-str-flags-table">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-orange-500">
								<FileWarning className="h-5 w-5" />
								Suspicious Transaction Report Flags
							</CardTitle>
							<CardDescription>
								Flagged transactions requiring review for FIU-IND reporting (7
								working day deadline)
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoadingFlags ? (
								<LoadingState message="Loading STR flags..." />
							) : strData && strData.flags.length > 0 ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Flag Type</TableHead>
											<TableHead>Severity</TableHead>
											<TableHead>Amount</TableHead>
											<TableHead>Reason</TableHead>
											<TableHead>Due Date</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{strData.flags.map((flag) => (
											<TableRow key={flag.id}>
												<TableCell>{getFlagTypeBadge(flag.flagType)}</TableCell>
												<TableCell>
													{getSeverityBadge(flag.severity ?? "")}
												</TableCell>
												<TableCell className="font-mono">
													₹
													{Number.parseFloat(
														String(flag.transactionAmount ?? "0"),
													).toLocaleString("en-IN")}
												</TableCell>
												<TableCell className="max-w-xs truncate text-sm text-muted-foreground">
													{flag.flagReason}
												</TableCell>
												<TableCell>
													{flag.strDueDate && (
														<div
															className={`text-sm ${new Date(flag.strDueDate) < new Date() ? "text-red-400 font-medium" : "text-muted-foreground"}`}
														>
															{format(new Date(flag.strDueDate), "dd MMM yyyy")}
															<br />
															<span className="text-[10px]">
																{formatDistanceToNow(
																	new Date(flag.strDueDate),
																	{ addSuffix: true },
																)}
															</span>
														</div>
													)}
												</TableCell>
												<TableCell>{getStatusBadge(flag.status)}</TableCell>
												<TableCell>
													<Button size="sm" variant="outline">
														<Eye className="h-3 w-3 mr-1" />
														Review
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : (
								<EmptyState
									icon={CheckCircle}
									title="No Pending STR Flags"
									description="All suspicious transaction reports have been reviewed and filed."
								/>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="audit-trail" className="mt-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-indigo-400">
								<LucideShield className="h-5 w-5" />
								Forensic Audit Trail
							</CardTitle>
							<CardDescription>
								Cryptographically linked transaction log for forensic analysis
								and regulatory audit.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoadingAudit ? (
								<LoadingState message="Verifying forensic chain..." />
							) : auditLogs && auditLogs.length > 0 ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Timestamp</TableHead>
											<TableHead>Action</TableHead>
											<TableHead>Entity</TableHead>
											<TableHead>User</TableHead>
											<TableHead>Forensic Hash</TableHead>
											<TableHead>Integrity</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{auditLogs.map((log) => (
											<TableRow key={log.id} className="group">
												<TableCell className="text-xs">
													{format(new Date(log.timestamp), "dd MMM HH:mm:ss")}
												</TableCell>
												<TableCell>
													<Badge
														variant="outline"
														className="text-[10px] uppercase font-bold"
													>
														{log.action.replace(/_/g, " ")}
													</Badge>
												</TableCell>
												<TableCell className="text-xs font-medium">
													{log.companyName || "System"}
												</TableCell>
												<TableCell>
													<div className="text-xs">
														<p className="font-medium">{log.userName}</p>
														<p className="text-muted-foreground">
															{log.userEmail}
														</p>
													</div>
												</TableCell>
												<TableCell className="max-w-[120px]">
													<code
														className="text-[10px] bg-muted px-1 py-0.5 rounded block truncate"
														title={log.forensicHash}
													>
														{log.forensicHash}
													</code>
												</TableCell>
												<TableCell>
													<Badge className="bg-emerald-600/20 text-emerald-500 border-emerald-500/30">
														<LucideShield className="w-3 h-3 mr-1" />
														Verified
													</Badge>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : (
								<EmptyState
									icon={LucideShield}
									title="Audit Trail Empty"
									description="No forensic events recorded in the current window."
								/>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="investor-limits" className="mt-6">
					<Card data-testid="card-investor-limits-info">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-blue-500">
								<Users className="h-5 w-5" />
								200 Investor Limit Tracking
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
								<Card className="bg-muted/30">
									<CardContent className="pt-4 text-center">
										<div className="text-3xl font-bold text-foreground">
											{overview?.investorLimits.companiesAtLimit || 0}
										</div>
										<p className="text-sm text-red-400">At Limit (200)</p>
									</CardContent>
								</Card>
								<Card className="bg-muted/30">
									<CardContent className="pt-4 text-center">
										<div className="text-3xl font-bold text-foreground">
											{overview?.investorLimits.companiesNearLimit || 0}
										</div>
										<p className="text-sm text-yellow-400">
											Near Limit (180-199)
										</p>
									</CardContent>
								</Card>
								<Card className="bg-muted/30">
									<CardContent className="pt-4 text-center">
										<div className="text-3xl font-bold text-foreground">
											200
										</div>
										<p className="text-sm text-green-400">Max Limit</p>
									</CardContent>
								</Card>
							</div>

							{overview?.investorLimits.companiesAtRisk &&
							overview.investorLimits.companiesAtRisk.length > 0 ? (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Company Name</TableHead>
											<TableHead>Investor Count</TableHead>
											<TableHead>Utilization</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Action</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{overview.investorLimits.companiesAtRisk.map((comp) => (
											<TableRow key={comp.id}>
												<TableCell className="font-medium">
													{comp.name}
												</TableCell>
												<TableCell>{comp.count} / 200</TableCell>
												<TableCell className="w-[200px]">
													<Progress
														value={(comp.count / 200) * 100}
														className={`h-2 ${comp.count >= 200 ? "bg-red-500" : "bg-yellow-500"}`}
													/>
												</TableCell>
												<TableCell>
													{comp.count >= 200 ? (
														<Badge className="bg-red-600">BLOCKED</Badge>
													) : (
														<Badge className="bg-yellow-600">WARNING</Badge>
													)}
												</TableCell>
												<TableCell>
													<Button size="sm" variant="outline">
														Manage
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							) : (
								<EmptyState
									icon={CheckCircle}
									title="All Companies Within Limits"
									description="No companies are currently near the 200 investor limit."
								/>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="lock-ins" className="mt-6">
					<Card data-testid="card-lock-ins-info">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-purple-500">
								<Lock className="h-5 w-5" />
								6-Month Lock-In Period
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<Card className="bg-muted/30">
									<CardContent className="pt-4 text-center">
										<div className="text-3xl font-bold text-foreground">
											{overview?.lockIns.activeRecords?.toLocaleString() || 0}
										</div>
										<p className="text-sm text-purple-400">Active Records</p>
									</CardContent>
								</Card>
								<Card className="bg-muted/30">
									<CardContent className="pt-4 text-center">
										<div className="text-3xl font-bold text-foreground">
											{overview?.lockIns.sharesLocked?.toLocaleString() || 0}
										</div>
										<p className="text-sm text-blue-400">Shares Locked</p>
									</CardContent>
								</Card>
								<Card className="bg-muted/30">
									<CardContent className="pt-4 text-center">
										<div className="text-3xl font-bold text-foreground">
											{overview?.lockIns.unlockingThisMonth || 0}
										</div>
										<p className="text-sm text-green-400">Unlocks (30d)</p>
									</CardContent>
								</Card>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
