import { useState } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
	FileText,
	Download,
	Calendar as CalendarIcon,
	TrendingUp,
	PieChart,
	Receipt,
	FileSpreadsheet,
	Clock,
	CheckCircle,
	Loader2,
	RefreshCw,
	IndianRupee,
	BarChart3,
	Wallet,
	FileCheck,
	History,
	Banknote,
} from "lucide-react";

interface Report {
	id: string;
	name: string;
	description: string;
	lastGenerated: string;
	status: "ready" | "generating" | "scheduled";
	size?: string;
}

interface ReportCategory {
	id: string;
	name: string;
	icon: LucideIcon;
	reports: Report[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
	{
		id: "portfolio",
		name: "Portfolio",
		icon: PieChart,
		reports: [
			{
				id: "holdings_summary",
				name: "Holdings Summary",
				description:
					"Complete overview of all your current investments across asset classes",
				lastGenerated: "2024-12-20",
				status: "ready",
				size: "1.2 MB",
			},
			{
				id: "asset_allocation",
				name: "Asset Allocation",
				description:
					"Breakdown of your portfolio by asset class, sector, and geography",
				lastGenerated: "2024-12-18",
				status: "ready",
				size: "890 KB",
			},
			{
				id: "portfolio_valuation",
				name: "Portfolio Valuation",
				description:
					"Current market value of all holdings with cost basis comparison",
				lastGenerated: "2024-12-22",
				status: "ready",
				size: "1.5 MB",
			},
		],
	},
	{
		id: "performance",
		name: "Performance",
		icon: TrendingUp,
		reports: [
			{
				id: "monthly_performance",
				name: "Monthly Performance",
				description:
					"Month-over-month returns analysis with benchmark comparison",
				lastGenerated: "2024-12-01",
				status: "ready",
				size: "750 KB",
			},
			{
				id: "quarterly_review",
				name: "Quarterly Review",
				description:
					"Comprehensive Q4 2024 performance analysis with market insights",
				lastGenerated: "2024-10-05",
				status: "scheduled",
			},
			{
				id: "annual_summary",
				name: "Annual Summary",
				description: "Year-to-date performance with XIRR and CAGR calculations",
				lastGenerated: "2024-04-01",
				status: "ready",
				size: "2.1 MB",
			},
		],
	},
	{
		id: "tax",
		name: "Tax",
		icon: Receipt,
		reports: [
			{
				id: "capital_gains",
				name: "Capital Gains Report",
				description: "Detailed LTCG and STCG breakdown for tax filing purposes",
				lastGenerated: "2024-12-15",
				status: "ready",
				size: "980 KB",
			},
			{
				id: "tax_harvesting",
				name: "Tax Harvesting Opportunities",
				description:
					"Identified opportunities to optimize tax liability through loss harvesting",
				lastGenerated: "2024-12-10",
				status: "ready",
				size: "450 KB",
			},
			{
				id: "form16_summary",
				name: "Form 16 Summary",
				description:
					"Consolidated Form 16 information from all dividend and interest income",
				lastGenerated: "2024-06-15",
				status: "ready",
				size: "320 KB",
			},
		],
	},
	{
		id: "statements",
		name: "Statements",
		icon: FileSpreadsheet,
		reports: [
			{
				id: "account_statement",
				name: "Account Statement",
				description:
					"Complete account activity including deposits, withdrawals, and transfers",
				lastGenerated: "2024-12-20",
				status: "ready",
				size: "1.8 MB",
			},
			{
				id: "transaction_history",
				name: "Transaction History",
				description: "Detailed log of all buy, sell, and switch transactions",
				lastGenerated: "2024-12-22",
				status: "generating",
			},
			{
				id: "dividend_income",
				name: "Dividend Income",
				description:
					"Summary of all dividend payments received across your portfolio",
				lastGenerated: "2024-12-01",
				status: "ready",
				size: "280 KB",
			},
		],
	},
];

export default function ClientReports() {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("portfolio");
	const [dateRange, setDateRange] = useState<{
		from: Date | undefined;
		to: Date | undefined;
	}>({
		from: new Date(2024, 0, 1),
		to: new Date(),
	});
	const [generatingReports, setGeneratingReports] = useState<Set<string>>(
		new Set(),
	);

	const formatDate = (dateStr: string) =>
		new Date(dateStr).toLocaleDateString("en-IN", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});

	const handleDownload = (report: Report) => {
		if (report.status === "generating") {
			toast({
				title: "Report Generating",
				description: "Please wait while the report is being generated.",
				variant: "default",
			});
			return;
		}

		if (report.status === "scheduled") {
			toast({
				title: "Report Scheduled",
				description:
					"This report is scheduled for generation. Check back soon.",
				variant: "default",
			});
			return;
		}

		toast({
			title: "Downloading Report",
			description: `${report.name} (${report.size}) is being downloaded.`,
		});
	};

	const handleRefresh = (report: Report) => {
		setGeneratingReports((prev) => new Set(prev).add(report.id));

		toast({
			title: "Regenerating Report",
			description: `${report.name} is being refreshed with latest data.`,
		});

		setTimeout(() => {
			setGeneratingReports((prev) => {
				const next = new Set(prev);
				next.delete(report.id);
				return next;
			});
			toast({
				title: "Report Ready",
				description: `${report.name} has been regenerated successfully.`,
			});
		}, 2000);
	};

	const getStatusConfig = (status: string, reportId: string) => {
		if (generatingReports.has(reportId)) {
			return {
				color:
					"bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
				label: "Generating",
				icon: Loader2,
			};
		}
		switch (status) {
			case "ready":
				return {
					color:
						"bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
					label: "Ready",
					icon: CheckCircle,
				};
			case "generating":
				return {
					color:
						"bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
					label: "Generating",
					icon: Loader2,
				};
			case "scheduled":
				return {
					color:
						"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
					label: "Scheduled",
					icon: Clock,
				};
			default:
				return {
					color: "bg-muted text-muted-foreground border-border",
					label: status,
					icon: FileText,
				};
		}
	};

	const getCategoryIcon = (categoryId: string) => {
		switch (categoryId) {
			case "portfolio":
				return PieChart;
			case "performance":
				return TrendingUp;
			case "tax":
				return Receipt;
			case "statements":
				return FileSpreadsheet;
			default:
				return FileText;
		}
	};

	const getReportIcon = (reportId: string) => {
		switch (reportId) {
			case "holdings_summary":
				return Wallet;
			case "asset_allocation":
				return PieChart;
			case "portfolio_valuation":
				return IndianRupee;
			case "monthly_performance":
				return BarChart3;
			case "quarterly_review":
				return TrendingUp;
			case "annual_summary":
				return FileCheck;
			case "capital_gains":
				return Receipt;
			case "tax_harvesting":
				return Banknote;
			case "form16_summary":
				return FileText;
			case "account_statement":
				return FileSpreadsheet;
			case "transaction_history":
				return History;
			case "dividend_income":
				return IndianRupee;
			default:
				return FileText;
		}
	};

	const totalReports = REPORT_CATEGORIES.reduce(
		(acc, cat) => acc + cat.reports.length,
		0,
	);
	const readyReports = REPORT_CATEGORIES.reduce(
		(acc, cat) => acc + cat.reports.filter((r) => r.status === "ready").length,
		0,
	);

	return (
		<div
			className="min-h-screen bg-muted p-6"
			data-testid="client-reports-page"
		>
			<div className="max-w-6xl mx-auto space-y-6">
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
					<div>
						<h1
							className="text-2xl font-bold text-foreground flex items-center gap-2"
							data-testid="text-page-title"
						>
							<FileText className="h-7 w-7 text-blue-600" />
							Your Reports
						</h1>
						<p className="text-muted-foreground mt-1">
							Download and manage your financial reports
						</p>
					</div>
					<div className="flex items-center gap-3">
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className="border-border text-muted-foreground hover:bg-muted"
									data-testid="button-date-range"
								>
									<CalendarIcon className="h-4 w-4 mr-2" />
									{dateRange.from ? (
										dateRange.to ? (
											<>
												{format(dateRange.from, "dd MMM yyyy")} -{" "}
												{format(dateRange.to, "dd MMM yyyy")}
											</>
										) : (
											format(dateRange.from, "dd MMM yyyy")
										)
									) : (
										"Select date range"
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0 bg-card" align="end">
								<Calendar
									mode="range"
									selected={{ from: dateRange.from, to: dateRange.to }}
									onSelect={(range) =>
										setDateRange({ from: range?.from, to: range?.to })
									}
									numberOfMonths={2}
									className="rounded-md border"
								/>
							</PopoverContent>
						</Popover>
					</div>
				</div>

				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<Card
						className="bg-card border-border shadow-sm"
						data-testid="card-total-reports"
					>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
									<FileText className="h-5 w-5 text-blue-600" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Total Reports</p>
									<p
										className="text-2xl font-bold text-foreground"
										data-testid="text-total-count"
									>
										{totalReports}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card
						className="bg-card border-border shadow-sm"
						data-testid="card-ready-reports"
					>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
									<CheckCircle className="h-5 w-5 text-emerald-600" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">
										Ready to Download
									</p>
									<p
										className="text-2xl font-bold text-foreground"
										data-testid="text-ready-count"
									>
										{readyReports}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card
						className="bg-card border-border shadow-sm"
						data-testid="card-generating-reports"
					>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
									<Loader2 className="h-5 w-5 text-blue-600" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Generating</p>
									<p
										className="text-2xl font-bold text-foreground"
										data-testid="text-generating-count"
									>
										{REPORT_CATEGORIES.reduce(
											(acc, cat) =>
												acc +
												cat.reports.filter((r) => r.status === "generating")
													.length,
											0,
										) + generatingReports.size}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card
						className="bg-card border-border shadow-sm"
						data-testid="card-scheduled-reports"
					>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
									<Clock className="h-5 w-5 text-amber-600" />
								</div>
								<div>
									<p className="text-muted-foreground text-sm">Scheduled</p>
									<p
										className="text-2xl font-bold text-foreground"
										data-testid="text-scheduled-count"
									>
										{REPORT_CATEGORIES.reduce(
											(acc, cat) =>
												acc +
												cat.reports.filter((r) => r.status === "scheduled")
													.length,
											0,
										)}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList className="bg-card border border-border shadow-sm w-full md:w-auto">
						{REPORT_CATEGORIES.map((category) => {
							const Icon = category.icon;
							return (
								<TabsTrigger
									key={category.id}
									value={category.id}
									className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2"
									data-testid={`tab-${category.id}`}
								>
									<Icon className="h-4 w-4" />
									{category.name}
								</TabsTrigger>
							);
						})}
					</TabsList>

					{REPORT_CATEGORIES.map((category) => (
						<TabsContent key={category.id} value={category.id} className="mt-6">
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{category.reports.map((report) => {
									const statusConfig = getStatusConfig(
										report.status,
										report.id,
									);
									const StatusIcon = statusConfig.icon;
									const ReportIcon = getReportIcon(report.id);
									const isGenerating =
										generatingReports.has(report.id) ||
										report.status === "generating";

									return (
										<Card
											key={report.id}
											className="bg-card border-border shadow-sm hover:shadow-md transition-shadow"
											data-testid={`report-card-${report.id}`}
										>
											<CardHeader className="pb-3">
												<div className="flex items-start justify-between">
													<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
														<ReportIcon className="h-5 w-5 text-blue-600" />
													</div>
													<Badge
														variant="outline"
														className={statusConfig.color}
														data-testid={`report-status-${report.id}`}
													>
														<StatusIcon
															className={`h-3 w-3 mr-1 ${isGenerating ? "animate-spin" : ""}`}
														/>
														{statusConfig.label}
													</Badge>
												</div>
												<CardTitle
													className="text-foreground text-lg mt-3"
													data-testid={`report-name-${report.id}`}
												>
													{report.name}
												</CardTitle>
												<CardDescription
													className="text-muted-foreground"
													data-testid={`report-description-${report.id}`}
												>
													{report.description}
												</CardDescription>
											</CardHeader>
											<CardContent>
												<div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
													<div
														className="flex items-center gap-1"
														data-testid={`report-date-${report.id}`}
													>
														<CalendarIcon className="h-4 w-4" />
														<span>
															Last generated: {formatDate(report.lastGenerated)}
														</span>
													</div>
													{report.size && (
														<span
															className="text-muted-foreground"
															data-testid={`report-size-${report.id}`}
														>
															{report.size}
														</span>
													)}
												</div>
												<div className="flex items-center gap-2">
													<Button
														className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
														onClick={() => handleDownload(report)}
														disabled={isGenerating}
														data-testid={`button-download-${report.id}`}
													>
														{isGenerating ? (
															<>
																<Loader2 className="h-4 w-4 mr-2 animate-spin" />
																Generating...
															</>
														) : (
															<>
																<Download className="h-4 w-4 mr-2" />
																Download PDF
															</>
														)}
													</Button>
													<Button
														variant="outline"
														size="icon"
														className="border-border text-muted-foreground hover:bg-muted"
														onClick={() => handleRefresh(report)}
														disabled={isGenerating}
														data-testid={`button-refresh-${report.id}`}
													>
														<RefreshCw
															className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`}
														/>
													</Button>
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						</TabsContent>
					))}
				</Tabs>

				<Card className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="font-semibold text-foreground mb-1">
									Need a Custom Report?
								</h3>
								<p className="text-muted-foreground text-sm">
									Contact your advisor to request specialized reports tailored
									to your needs.
								</p>
							</div>
							<Button
								variant="outline"
								className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:bg-blue-900/30"
								data-testid="button-request-report"
							>
								Request Custom Report
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
