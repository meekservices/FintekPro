import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
	Building2,
	TrendingUp,
	CheckCircle2,
	XCircle,
	Clock,
	IndianRupee,
	RefreshCw,
	Search,
	Filter,
	Eye,
	Send,
	Settings,
	FileText,
	Activity,
} from "lucide-react";

interface DashboardStats {
	overview: {
		totalApplications: number;
		totalAmount: number;
		approvedAmount: number;
		disbursedAmount: number;
		approvalRate: number;
		activeBanks: number;
	};
	funnel: Record<string, number>;
	byLoanType: Record<string, number>;
	bankWiseStats: Array<{
		bankCode: string;
		bankName: string;
		connectorType: string;
		priority: number;
		interestRange: string;
		submitted: number;
		approved: number;
		rejected: number;
		pending: number;
		approvalRate: string;
	}>;
}

interface LoanApplication {
	id: string;
	applicationNumber: string;
	applicantName: string;
	applicantPhone: string;
	loanType: string;
	requestedAmount: string;
	requestedTenure: number;
	status: string;
	creditScore: number | null;
	routedBanks: string[];
	createdAt: string;
}

const statusColors: Record<string, string> = {
	draft: "bg-muted text-foreground",
	submitted: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
	eligibility_check:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	routed:
		"bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
	pending_with_banks:
		"bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
	in_review: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200",
	approved:
		"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	disbursed:
		"bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
};

const loanTypeLabels: Record<string, string> = {
	personal: "Personal Loan",
	home: "Home Loan",
	car: "Car Loan",
	business: "Business Loan",
	education: "Education Loan",
	gold: "Gold Loan",
	lap: "Loan Against Property",
};

// Sub-DSA Governance filter options
const originationModeOptions = [
	{ value: "all", label: "All Origins" },
	{ value: "SELF_SERVICE", label: "Self-Service" },
	{ value: "AGENT_ASSISTED", label: "Agent-Assisted" },
];

const routingIntentOptions = [
	{ value: "all", label: "All Routing" },
	{ value: "MARKETPLACE", label: "Marketplace" },
	{ value: "SPECIFIC_BANKS", label: "Specific Banks" },
];

export default function AdminDsaLoanDashboard() {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("overview");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [selectedApplication, setSelectedApplication] = useState<string | null>(
		null,
	);

	const [loanVerticalFilter, setLoanVerticalFilter] = useState<string>("all");
	const [originationModeFilter, setOriginationModeFilter] =
		useState<string>("all");
	const [routingIntentFilter, setRoutingIntentFilter] = useState<string>("all");
	const [bankCodeFilter, setBankCodeFilter] = useState<string>("all");

	const {
		data: statsData,
		isLoading: statsLoading,
		refetch: refetchStats,
	} = useQuery<{ success: boolean; data: DashboardStats }>({
		queryKey: ["/api/admin/dsa-loans/dashboard/stats"],
	});

	// SUB-DSA GOVERNANCE: Build query URL with all mandatory filters
	const buildApplicationsQueryUrl = () => {
		const params = new URLSearchParams();
		if (statusFilter !== "all") params.append("status", statusFilter);
		if (loanVerticalFilter !== "all")
			params.append("loanVertical", loanVerticalFilter);
		if (originationModeFilter !== "all")
			params.append("originationMode", originationModeFilter);
		if (routingIntentFilter !== "all")
			params.append("routingIntent", routingIntentFilter);
		if (bankCodeFilter !== "all") params.append("bankCode", bankCodeFilter);
		const queryString = params.toString();
		return queryString
			? `/api/admin/dsa-loans/applications?${queryString}`
			: "/api/admin/dsa-loans/applications";
	};

	const {
		data: applicationsData,
		isLoading: applicationsLoading,
		refetch: refetchApplications,
	} = useQuery<{
		success: boolean;
		data: LoanApplication[];
		meta: { total: number };
	}>({
		queryKey: [buildApplicationsQueryUrl()],
	});

	const { data: banksData } = useQuery<{ success: boolean; data: any[] }>({
		queryKey: ["/api/admin/dsa-loans/banks"],
	});

	const { data: rulesData } = useQuery<{ success: boolean; data: any[] }>({
		queryKey: ["/api/admin/dsa-loans/eligibility-rules"],
	});

	const stats = statsData?.data;
	const applications = applicationsData?.data || [];
	const banks = banksData?.data || [];
	const rules = rulesData?.data || [];

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const handleRefresh = () => {
		refetchStats();
		refetchApplications();
		toast({
			title: "Data refreshed",
			description: "Dashboard data has been updated.",
		});
	};

	return (
		<div className="min-h-screen bg-muted p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold text-foreground">
							DSA Loan Dashboard
						</h1>
						<p className="text-muted-foreground mt-1">
							Multi-Financier Loan Routing System
						</p>
					</div>
					<Button onClick={handleRefresh} variant="outline">
						<RefreshCw className="w-4 h-4 mr-2" />
						Refresh
					</Button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Applications
							</CardTitle>
							<FileText className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{stats?.overview.totalApplications || 0}
							</div>
							<p className="text-xs text-muted-foreground">
								All time submissions
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Amount
							</CardTitle>
							<IndianRupee className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{formatCurrency(stats?.overview.totalAmount || 0)}
							</div>
							<p className="text-xs text-muted-foreground">
								Loan value requested
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Approval Rate
							</CardTitle>
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{stats?.overview.approvalRate || 0}%
							</div>
							<p className="text-xs text-muted-foreground">
								Of completed applications
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Active Banks
							</CardTitle>
							<Building2 className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{stats?.overview.activeBanks || 0}
							</div>
							<p className="text-xs text-muted-foreground">
								Partner financiers
							</p>
						</CardContent>
					</Card>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
					<Card className="lg:col-span-2">
						<CardHeader>
							<CardTitle>Application Funnel</CardTitle>
							<CardDescription>
								Status breakdown of all applications
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-3 gap-4">
								<div className="text-center p-4 bg-muted rounded-lg">
									<div className="text-2xl font-bold text-muted-foreground">
										{stats?.funnel.draft || 0}
									</div>
									<div className="text-sm text-muted-foreground">Draft</div>
								</div>
								<div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
									<div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
										{stats?.funnel.submitted || 0}
									</div>
									<div className="text-sm text-blue-500">Submitted</div>
								</div>
								<div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
									<div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
										{stats?.funnel.routed || 0}
									</div>
									<div className="text-sm text-purple-500">Routed</div>
								</div>
								<div className="text-center p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
									<div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
										{stats?.funnel.pendingWithBanks || 0}
									</div>
									<div className="text-sm text-orange-500">
										Pending with Banks
									</div>
								</div>
								<div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
									<div className="text-2xl font-bold text-green-700 dark:text-green-300">
										{stats?.funnel.approved || 0}
									</div>
									<div className="text-sm text-green-500">Approved</div>
								</div>
								<div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
									<div className="text-2xl font-bold text-red-700 dark:text-red-300">
										{stats?.funnel.rejected || 0}
									</div>
									<div className="text-sm text-red-500">Rejected</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>By Loan Type</CardTitle>
							<CardDescription>Distribution across products</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{Object.entries(stats?.byLoanType || {}).map(
									([type, count]) => (
										<div
											key={type}
											className="flex items-center justify-between"
										>
											<span className="text-sm text-muted-foreground">
												{loanTypeLabels[type] || type}
											</span>
											<Badge variant="secondary">{count}</Badge>
										</div>
									),
								)}
								{Object.keys(stats?.byLoanType || {}).length === 0 && (
									<p className="text-sm text-muted-foreground text-center py-4">
										No data available
									</p>
								)}
							</div>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Bank-wise Performance</CardTitle>
						<CardDescription>
							Submission and approval metrics per financier
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Bank</TableHead>
									<TableHead>Connector</TableHead>
									<TableHead>Priority</TableHead>
									<TableHead>Interest Range</TableHead>
									<TableHead className="text-center">Submitted</TableHead>
									<TableHead className="text-center">Approved</TableHead>
									<TableHead className="text-center">Rejected</TableHead>
									<TableHead className="text-center">Pending</TableHead>
									<TableHead className="text-center">Approval Rate</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{stats?.bankWiseStats.map((bank) => (
									<TableRow key={bank.bankCode}>
										<TableCell className="font-medium">
											{bank.bankName}
										</TableCell>
										<TableCell>
											<Badge variant="outline" className="capitalize">
												{bank.connectorType}
											</Badge>
										</TableCell>
										<TableCell>{bank.priority}</TableCell>
										<TableCell>{bank.interestRange}</TableCell>
										<TableCell className="text-center">
											{bank.submitted}
										</TableCell>
										<TableCell className="text-center text-green-600">
											{bank.approved}
										</TableCell>
										<TableCell className="text-center text-red-600">
											{bank.rejected}
										</TableCell>
										<TableCell className="text-center text-orange-600">
											{bank.pending}
										</TableCell>
										<TableCell className="text-center font-medium">
											{bank.approvalRate}%
										</TableCell>
									</TableRow>
								))}
								{(stats?.bankWiseStats || []).length === 0 && (
									<TableRow>
										<TableCell
											colSpan={9}
											className="text-center text-muted-foreground py-8"
										>
											No bank data available
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Recent Applications</CardTitle>
								<CardDescription>
									Latest loan applications in the system
								</CardDescription>
							</div>
							<div className="flex gap-2 flex-wrap">
								<Select value={statusFilter} onValueChange={setStatusFilter}>
									<SelectTrigger className="w-[160px]">
										<SelectValue placeholder="Filter by status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Statuses</SelectItem>
										<SelectItem value="draft">Draft</SelectItem>
										<SelectItem value="submitted">Submitted</SelectItem>
										<SelectItem value="routed">Routed</SelectItem>
										<SelectItem value="approved">Approved</SelectItem>
										<SelectItem value="rejected">Rejected</SelectItem>
									</SelectContent>
								</Select>

								<Select
									value={loanVerticalFilter}
									onValueChange={setLoanVerticalFilter}
								>
									<SelectTrigger className="w-[160px]">
										<SelectValue placeholder="Vertical" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Verticals</SelectItem>
										<SelectItem value="RETAIL">Retail</SelectItem>
										<SelectItem value="MSME">MSME</SelectItem>
										<SelectItem value="DEVELOPER">Developer Finance</SelectItem>
									</SelectContent>
								</Select>

								<Select
									value={originationModeFilter}
									onValueChange={setOriginationModeFilter}
								>
									<SelectTrigger className="w-[160px]">
										<SelectValue placeholder="Origination" />
									</SelectTrigger>
									<SelectContent>
										{originationModeOptions.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<Select
									value={routingIntentFilter}
									onValueChange={setRoutingIntentFilter}
								>
									<SelectTrigger className="w-[160px]">
										<SelectValue placeholder="Routing" />
									</SelectTrigger>
									<SelectContent>
										{routingIntentOptions.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<Select
									value={bankCodeFilter}
									onValueChange={setBankCodeFilter}
								>
									<SelectTrigger className="w-[160px]">
										<SelectValue placeholder="Bank" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Banks</SelectItem>
										{banks.map((bank: any) => (
											<SelectItem key={bank.bankCode} value={bank.bankCode}>
												{bank.bankName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{applicationsLoading ? (
							<div className="text-center py-8 text-muted-foreground">
								Loading applications...
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Application #</TableHead>
										<TableHead>Applicant</TableHead>
										<TableHead>Loan Type</TableHead>
										<TableHead>Amount</TableHead>
										<TableHead>Tenure</TableHead>
										<TableHead>Credit Score</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Routed To</TableHead>
										<TableHead>Date</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{applications.map((app) => (
										<TableRow key={app.id}>
											<TableCell className="font-mono text-sm">
												{app.applicationNumber}
											</TableCell>
											<TableCell>
												<div>
													<div className="font-medium">{app.applicantName}</div>
													<div className="text-sm text-muted-foreground">
														{app.applicantPhone}
													</div>
												</div>
											</TableCell>
											<TableCell>
												{loanTypeLabels[app.loanType] || app.loanType}
											</TableCell>
											<TableCell>
												{formatCurrency(Number.parseFloat(app.requestedAmount))}
											</TableCell>
											<TableCell>{app.requestedTenure} months</TableCell>
											<TableCell>{app.creditScore || "-"}</TableCell>
											<TableCell>
												<Badge
													className={statusColors[app.status] || "bg-muted"}
												>
													{app.status.replace(/_/g, " ")}
												</Badge>
											</TableCell>
											<TableCell>
												{app.routedBanks?.length > 0 ? (
													<div className="flex gap-1">
														{app.routedBanks.map((bank) => (
															<Badge
																key={bank}
																variant="outline"
																className="text-xs"
															>
																{bank}
															</Badge>
														))}
													</div>
												) : (
													"-"
												)}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{formatDate(app.createdAt)}
											</TableCell>
											<TableCell>
												<Button variant="ghost" size="sm">
													<Eye className="w-4 h-4" />
												</Button>
											</TableCell>
										</TableRow>
									))}
									{applications.length === 0 && (
										<TableRow>
											<TableCell
												colSpan={10}
												className="text-center text-muted-foreground py-8"
											>
												No applications found
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<Card>
						<CardHeader>
							<CardTitle>Partner Banks</CardTitle>
							<CardDescription>Configured bank connectors</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Bank</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Loan Types</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{banks.map((bank) => (
										<TableRow key={bank.bankCode}>
											<TableCell className="font-medium">
												{bank.bankName}
											</TableCell>
											<TableCell>
												<Badge variant="outline" className="capitalize">
													{bank.connectorType}
												</Badge>
											</TableCell>
											<TableCell>
												{bank.isActive ? (
													<Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
														Active
													</Badge>
												) : (
													<Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
														Inactive
													</Badge>
												)}
											</TableCell>
											<TableCell>
												<div className="flex flex-wrap gap-1">
													{(bank.supportedLoanTypes || [])
														.slice(0, 3)
														.map((type: string) => (
															<Badge
																key={type}
																variant="secondary"
																className="text-xs"
															>
																{type}
															</Badge>
														))}
													{(bank.supportedLoanTypes || []).length > 3 && (
														<Badge variant="secondary" className="text-xs">
															+{bank.supportedLoanTypes.length - 3}
														</Badge>
													)}
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Eligibility Rules</CardTitle>
							<CardDescription>
								Bank-specific qualification criteria
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Bank</TableHead>
										<TableHead>Loan Type</TableHead>
										<TableHead>Min Score</TableHead>
										<TableHead>Min Income</TableHead>
										<TableHead>Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rules.slice(0, 8).map((rule) => (
										<TableRow key={rule.id}>
											<TableCell className="font-medium">
												{rule.bankCode}
											</TableCell>
											<TableCell>{rule.loanType}</TableCell>
											<TableCell>{rule.minCreditScore || "-"}</TableCell>
											<TableCell>
												{rule.minMonthlyIncome
													? formatCurrency(
															Number.parseFloat(rule.minMonthlyIncome),
														)
													: "-"}
											</TableCell>
											<TableCell>
												{rule.isActive ? (
													<Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
														Active
													</Badge>
												) : (
													<Badge className="bg-muted text-foreground">
														Inactive
													</Badge>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
