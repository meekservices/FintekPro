import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
	FileText,
	Download,
	Share2,
	TrendingUp,
	TrendingDown,
	Database,
	Calendar,
	IndianRupee,
	Receipt,
	Mail,
	FileSpreadsheet,
	Loader2,
	Search,
	Filter,
} from "lucide-react";

interface CapitalGainsTransaction {
	id: string;
	isin: string;
	companyName: string;
	symbol: string;
	transactionType: string;
	buyDate: string;
	sellDate: string;
	buyQuantity: number;
	sellQuantity: number;
	buyPrice: string;
	sellPrice: string;
	buyValue: string;
	sellValue: string;
	gainLoss: string;
	gainType: string;
	tdsDeducted: string;
}

interface CapitalGainsReport {
	id: string;
	accountNumber?: string;
	boId?: string;
	financialYear: string;
	reportType: string;
	source: string;
	summary: {
		totalShortTermGains: string;
		totalLongTermGains: string;
		totalDividend: string;
		totalTdsDeducted: string;
		totalTransactions: number;
	};
	transactions: CapitalGainsTransaction[];
	generatedAt: string;
	reportId: string;
}

interface SavedReport {
	id: string;
	userId: string;
	financialYear: string;
	reportType: string;
	source: string;
	totalShortTermGains: string;
	totalLongTermGains: string;
	totalDividend: string;
	totalTdsDeducted: string;
	status: string;
	createdAt: string;
}

export default function CapitalGainsReports() {
	const [activeTab, setActiveTab] = useState("generate");
	const [selectedSource, setSelectedSource] = useState("nsdl");
	const [accountNumber, setAccountNumber] = useState("1234567890123456");
	const [boId, setBoId] = useState("1756285624077");
	const [panNumber, setPanNumber] = useState("ABCDE1234F");
	const [financialYear, setFinancialYear] = useState("2024-25");
	const [fromDate, setFromDate] = useState("2023-04-01");
	const [toDate, setToDate] = useState("2024-03-31");
	const [shareEmail, setShareEmail] = useState("");
	const [shareMessage, setShareMessage] = useState("");
	const [selectedReportForShare, setSelectedReportForShare] = useState<
		string | null
	>(null);

	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const userId = user?.id || "";

	// Fetch NSDL capital gains report
	const fetchNSDLReportMutation = useMutation({
		mutationFn: async (data: {
			accountNumber: string;
			financialYear: string;
			fromDate?: string;
			toDate?: string;
		}) => {
			const response = await apiRequest("POST", "/api/nsdl/capital-gains", {
				body: data,
			});
			return response.json();
		},
		onSuccess: (data) => {
			toast({
				title: "NSDL Report Generated",
				description: "Capital gains report fetched successfully from NSDL.",
			});
			setActiveTab("view-report");
		},
		onError: (error: Error) => {
			toast({
				title: "Fetch Failed",
				description: `Failed to fetch NSDL report: ${error.message}`,
				variant: "destructive",
			});
		},
	});

	// Fetch CDSL capital gains report
	const fetchCDSLReportMutation = useMutation({
		mutationFn: async (data: {
			boId: string;
			financialYear: string;
			fromDate?: string;
			toDate?: string;
		}) => {
			const response = await apiRequest("POST", "/api/cdsl/capital-gains", {
				body: data,
			});
			return response.json();
		},
		onSuccess: (data) => {
			toast({
				title: "CDSL Report Generated",
				description: "Capital gains report fetched successfully from CDSL.",
			});
			setActiveTab("view-report");
		},
		onError: (error: Error) => {
			toast({
				title: "Fetch Failed",
				description: `Failed to fetch CDSL report: ${error.message}`,
				variant: "destructive",
			});
		},
	});

	// Fetch KFintech capital gains report
	const fetchKfintechReportMutation = useMutation({
		mutationFn: async (data: {
			pan: string;
			financialYear: string;
			transactionType?: string;
			folioNumber?: string;
		}) => {
			const queryParams = new URLSearchParams({
				pan: data.pan,
				financialYear: data.financialYear,
				...(data.transactionType && { transactionType: data.transactionType }),
				...(data.folioNumber && { folioNumber: data.folioNumber }),
			});
			const response = await fetch(
				`/api/kfintech/capital-gains?${queryParams}`,
			);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.json();
		},
		onSuccess: (data) => {
			toast({
				title: "KFintech Report Generated",
				description: "Capital gains report fetched successfully from KFintech.",
			});
			setActiveTab("view-report");
		},
		onError: (error: Error) => {
			toast({
				title: "Fetch Failed",
				description: `Failed to fetch KFintech report: ${error.message}`,
				variant: "destructive",
			});
		},
	});

	// Fetch CAMS capital gains report
	const fetchCAMSReportMutation = useMutation({
		mutationFn: async (data: {
			pan: string;
			financialYear: string;
			transactionType?: string;
			folioNumber?: string;
		}) => {
			const queryParams = new URLSearchParams({
				pan: data.pan,
				financialYear: data.financialYear,
				...(data.transactionType && { transactionType: data.transactionType }),
				...(data.folioNumber && { folioNumber: data.folioNumber }),
			});
			const response = await fetch(`/api/cams/capital-gains?${queryParams}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.json();
		},
		onSuccess: (data) => {
			toast({
				title: "CAMS Report Generated",
				description: "Capital gains report fetched successfully from CAMS.",
			});
			setActiveTab("view-report");
		},
		onError: (error: Error) => {
			toast({
				title: "Fetch Failed",
				description: `Failed to fetch CAMS report: ${error.message}`,
				variant: "destructive",
			});
		},
	});

	// Save report to database
	const saveReportMutation = useMutation({
		mutationFn: async (data: {
			reportData: CapitalGainsReport;
			userId: string;
		}) => {
			const response = await apiRequest("POST", "/api/capital-gains/save", {
				body: data,
			});
			return response.json();
		},
		onSuccess: () => {
			toast({
				title: "Report Saved",
				description: "Capital gains report saved successfully.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/capital-gains/reports", userId],
			});
		},
	});

	// Share report via email
	const shareReportMutation = useMutation({
		mutationFn: async (data: {
			reportId: string;
			email: string;
			message?: string;
			includeAttachment: boolean;
		}) => {
			const response = await apiRequest(
				"POST",
				`/api/capital-gains/share/${data.reportId}`,
				{ body: data },
			);
			return response.json();
		},
		onSuccess: () => {
			toast({
				title: "Report Shared",
				description: "Capital gains report shared successfully via email.",
			});
			setShareEmail("");
			setShareMessage("");
			setSelectedReportForShare(null);
		},
	});

	// Get saved reports
	const { data: savedReports, isLoading: reportsLoading } = useQuery<
		SavedReport[]
	>({
		queryKey: ["/api/capital-gains/reports", userId],
		queryFn: async () => {
			const response = await fetch(`/api/capital-gains/reports/${userId}`);
			const result = await response.json();
			return result.data;
		},
	});

	const handleGenerateReport = () => {
		if (selectedSource === "nsdl") {
			fetchNSDLReportMutation.mutate({
				accountNumber,
				financialYear,
				fromDate,
				toDate,
			});
		} else if (selectedSource === "cdsl") {
			fetchCDSLReportMutation.mutate({
				boId,
				financialYear,
				fromDate,
				toDate,
			});
		} else if (selectedSource === "fintech") {
			fetchKfintechReportMutation.mutate({
				pan: panNumber,
				financialYear,
			});
		} else if (selectedSource === "cams") {
			fetchCAMSReportMutation.mutate({
				pan: panNumber,
				financialYear,
			});
		}
	};

	const handleSaveReport = (reportData: CapitalGainsReport) => {
		saveReportMutation.mutate({ reportData, userId });
	};

	const handleDownloadPDF = (reportId: string) => {
		window.open(`/api/capital-gains/download/${reportId}/pdf`, "_blank");
	};

	const handleDownloadExcel = (reportId: string) => {
		window.open(`/api/capital-gains/download/${reportId}/excel`, "_blank");
	};

	const handleShareReport = () => {
		if (selectedReportForShare && shareEmail) {
			shareReportMutation.mutate({
				reportId: selectedReportForShare,
				email: shareEmail,
				message: shareMessage,
				includeAttachment: true,
			});
		}
	};

	const formatCurrency = (amount: string) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			minimumFractionDigits: 2,
		}).format(Number.parseFloat(amount));
	};

	const getCurrentReport = (): CapitalGainsReport | null => {
		if (fetchNSDLReportMutation.data?.status === "success") {
			return fetchNSDLReportMutation.data.data;
		}
		if (fetchCDSLReportMutation.data?.status === "success") {
			return fetchCDSLReportMutation.data.data;
		}
		return null;
	};

	const currentReport = getCurrentReport();

	return (
		<div className="max-w-7xl mx-auto p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-3">
						<Receipt className="h-8 w-8 text-blue-600" />
						Capital Gains Reports
					</h1>
					<p className="text-muted-foreground mt-2">
						Generate, download, and share capital gains reports from NSDL, CDSL,
						KFintech, and CAMS
					</p>
				</div>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-6"
			>
				<ScrollableTabsList className="grid grid-cols-3 w-full max-w-md">
					<TabsTrigger value="generate">Generate Report</TabsTrigger>
					<TabsTrigger value="view-report">Current Report</TabsTrigger>
					<TabsTrigger value="saved-reports">Saved Reports</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value="generate" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="h-5 w-5" />
								Generate New Capital Gains Report
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Source Selection */}
							<div className="space-y-2">
								<Label>Data Source</Label>
								<Select
									value={selectedSource}
									onValueChange={setSelectedSource}
								>
									<SelectTrigger data-testid="select-source">
										<SelectValue placeholder="Select data source" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="nsdl">NSDL</SelectItem>
										<SelectItem value="cdsl">CDSL</SelectItem>
										<SelectItem value="fintech">Fintech Reports</SelectItem>
										<SelectItem value="cams">
											CAMS (Computer Age Management Services)
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Account Details */}
								{selectedSource === "nsdl" ? (
									<div className="space-y-2">
										<Label htmlFor="accountNumber">NSDL Account Number</Label>
										<Input
											id="accountNumber"
											value={accountNumber}
											onChange={(e) => setAccountNumber(e.target.value)}
											placeholder="Enter NSDL account number"
											data-testid="input-account-number"
										/>
									</div>
								) : selectedSource === "cdsl" ? (
									<div className="space-y-2">
										<Label htmlFor="boId">CDSL BO ID</Label>
										<Input
											id="boId"
											value={boId}
											onChange={(e) => setBoId(e.target.value)}
											placeholder="Enter CDSL BO ID"
											data-testid="input-bo-id"
										/>
									</div>
								) : (
									<div className="space-y-2">
										<Label htmlFor="panNumber">PAN Number</Label>
										<Input
											id="panNumber"
											value={panNumber}
											onChange={(e) => setPanNumber(e.target.value)}
											placeholder="Enter PAN number (ABCDE1234F)"
											maxLength={10}
											data-testid="input-pan-number"
										/>
									</div>
								)}

								{/* Financial Year */}
								<div className="space-y-2">
									<Label htmlFor="financialYear">Financial Year</Label>
									<Select
										value={financialYear}
										onValueChange={setFinancialYear}
									>
										<SelectTrigger data-testid="select-financial-year">
											<SelectValue placeholder="Select financial year" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="2024-25">2024-25</SelectItem>
											<SelectItem value="2023-24">2023-24</SelectItem>
											<SelectItem value="2022-23">2022-23</SelectItem>
											<SelectItem value="2021-22">2021-22</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{/* Date Range */}
								<div className="space-y-2">
									<Label htmlFor="fromDate">From Date</Label>
									<Input
										id="fromDate"
										type="date"
										value={fromDate}
										onChange={(e) => setFromDate(e.target.value)}
										data-testid="input-from-date"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="toDate">To Date</Label>
									<Input
										id="toDate"
										type="date"
										value={toDate}
										onChange={(e) => setToDate(e.target.value)}
										data-testid="input-to-date"
									/>
								</div>
							</div>

							<Button
								onClick={handleGenerateReport}
								disabled={
									fetchNSDLReportMutation.isPending ||
									fetchCDSLReportMutation.isPending ||
									fetchKfintechReportMutation.isPending ||
									fetchCAMSReportMutation.isPending
								}
								className="w-full"
								data-testid="button-generate-report"
							>
								{(fetchNSDLReportMutation.isPending ||
									fetchCDSLReportMutation.isPending ||
									fetchKfintechReportMutation.isPending ||
									fetchCAMSReportMutation.isPending) && (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								)}
								Generate{" "}
								{selectedSource === "fintech"
									? "KFintech"
									: (selectedSource || "nsdl").toUpperCase()}{" "}
								Report
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="view-report" className="space-y-6">
					{currentReport ? (
						<>
							{/* Report Summary */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<FileText className="h-5 w-5" />
											Capital Gains Summary -{" "}
											{(currentReport.source || "NSDL").toUpperCase()}
										</div>
										<Badge variant="secondary">
											{currentReport.financialYear}
										</Badge>
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
										<div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<TrendingUp className="h-4 w-4 text-green-600" />
												<span className="text-sm font-medium text-green-600">
													Long Term Gains
												</span>
											</div>
											<p className="text-2xl font-bold text-green-700 dark:text-green-300">
												{formatCurrency(
													currentReport.summary.totalLongTermGains,
												)}
											</p>
										</div>

										<div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<TrendingDown className="h-4 w-4 text-orange-600" />
												<span className="text-sm font-medium text-orange-600">
													Short Term Gains
												</span>
											</div>
											<p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
												{formatCurrency(
													currentReport.summary.totalShortTermGains,
												)}
											</p>
										</div>

										<div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<IndianRupee className="h-4 w-4 text-blue-600" />
												<span className="text-sm font-medium text-blue-600">
													Total Dividend
												</span>
											</div>
											<p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
												{formatCurrency(currentReport.summary.totalDividend)}
											</p>
										</div>

										<div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<Receipt className="h-4 w-4 text-red-600" />
												<span className="text-sm font-medium text-red-600">
													TDS Deducted
												</span>
											</div>
											<p className="text-2xl font-bold text-red-700 dark:text-red-300">
												{formatCurrency(currentReport.summary.totalTdsDeducted)}
											</p>
										</div>
									</div>

									{/* Action Buttons */}
									<div className="flex gap-3 flex-wrap">
										<Button
											onClick={() => handleSaveReport(currentReport)}
											disabled={saveReportMutation.isPending}
											data-testid="button-save-report"
										>
											{saveReportMutation.isPending && (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											)}
											Save Report
										</Button>

										<Button
											variant="outline"
											onClick={() => handleDownloadPDF(currentReport.reportId)}
											data-testid="button-download-pdf"
										>
											<FileText className="mr-2 h-4 w-4" />
											Download PDF
										</Button>

										<Button
											variant="outline"
											onClick={() =>
												handleDownloadExcel(currentReport.reportId)
											}
											data-testid="button-download-excel"
										>
											<FileSpreadsheet className="mr-2 h-4 w-4" />
											Download Excel
										</Button>

										<Dialog>
											<DialogTrigger asChild>
												<Button
													variant="outline"
													onClick={() =>
														setSelectedReportForShare(currentReport.reportId)
													}
													data-testid="button-share-report"
												>
													<Share2 className="mr-2 h-4 w-4" />
													Share Report
												</Button>
											</DialogTrigger>
											<DialogContent>
												<DialogHeader>
													<DialogTitle>Share Capital Gains Report</DialogTitle>
												</DialogHeader>
												<div className="space-y-4">
													<div className="space-y-2">
														<Label htmlFor="shareEmail">Email Address</Label>
														<Input
															id="shareEmail"
															type="email"
															value={shareEmail}
															onChange={(e) => setShareEmail(e.target.value)}
															placeholder="Enter email address"
															data-testid="input-share-email"
														/>
													</div>
													<div className="space-y-2">
														<Label htmlFor="shareMessage">
															Message (Optional)
														</Label>
														<textarea
															id="shareMessage"
															value={shareMessage}
															onChange={(e) => setShareMessage(e.target.value)}
															placeholder="Add a personal message"
															className="w-full p-2 border rounded-md"
															rows={3}
														/>
													</div>
													<Button
														onClick={handleShareReport}
														disabled={
															!shareEmail || shareReportMutation.isPending
														}
														className="w-full"
														data-testid="button-send-share"
													>
														{shareReportMutation.isPending && (
															<Loader2 className="mr-2 h-4 w-4 animate-spin" />
														)}
														<Mail className="mr-2 h-4 w-4" />
														Send Report
													</Button>
												</div>
											</DialogContent>
										</Dialog>
									</div>
								</CardContent>
							</Card>

							{/* Transactions Table */}
							<Card>
								<CardHeader>
									<CardTitle>Transaction Details</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="overflow-x-auto">
										<table className="w-full border-collapse border border-border">
											<thead>
												<tr className="bg-muted">
													<th className="border border-border px-4 py-2 text-left">
														Company
													</th>
													<th className="border border-border px-4 py-2 text-left">
														Symbol
													</th>
													<th className="border border-border px-4 py-2 text-left">
														Buy Date
													</th>
													<th className="border border-border px-4 py-2 text-left">
														Sell Date
													</th>
													<th className="border border-border px-4 py-2 text-right">
														Buy Value
													</th>
													<th className="border border-border px-4 py-2 text-right">
														Sell Value
													</th>
													<th className="border border-border px-4 py-2 text-right">
														Gain/Loss
													</th>
													<th className="border border-border px-4 py-2 text-center">
														Type
													</th>
												</tr>
											</thead>
											<tbody>
												{currentReport.transactions.map((transaction) => (
													<tr key={transaction.id} className="hover:bg-muted">
														<td className="border border-border px-4 py-2">
															{transaction.companyName}
														</td>
														<td className="border border-border px-4 py-2 font-mono">
															{transaction.symbol}
														</td>
														<td className="border border-border px-4 py-2">
															{new Date(
																transaction.buyDate,
															).toLocaleDateString()}
														</td>
														<td className="border border-border px-4 py-2">
															{new Date(
																transaction.sellDate,
															).toLocaleDateString()}
														</td>
														<td className="border border-border px-4 py-2 text-right">
															{formatCurrency(transaction.buyValue)}
														</td>
														<td className="border border-border px-4 py-2 text-right">
															{formatCurrency(transaction.sellValue)}
														</td>
														<td
															className={`border border-border px-4 py-2 text-right font-semibold ${
																Number.parseFloat(transaction.gainLoss) >= 0
																	? "text-green-600"
																	: "text-red-600"
															}`}
														>
															{formatCurrency(transaction.gainLoss)}
														</td>
														<td className="border border-border px-4 py-2 text-center">
															<Badge
																variant={
																	transaction.gainType === "long_term"
																		? "default"
																		: "secondary"
																}
															>
																{transaction.gainType.replace("_", " ")}
															</Badge>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</CardContent>
							</Card>
						</>
					) : (
						<Card>
							<CardContent className="text-center py-12">
								<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
								<h3 className="text-lg font-semibold text-muted-foreground mb-2">
									No Report Generated
								</h3>
								<p className="text-muted-foreground mb-4">
									Generate a new capital gains report to view details here.
								</p>
								<Button onClick={() => setActiveTab("generate")}>
									Generate Report
								</Button>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="saved-reports" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="h-5 w-5" />
								Saved Capital Gains Reports
							</CardTitle>
						</CardHeader>
						<CardContent>
							{reportsLoading ? (
								<div className="text-center py-8">
									<Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
									<p>Loading saved reports...</p>
								</div>
							) : savedReports && savedReports.length > 0 ? (
								<div className="space-y-4">
									{savedReports.map((report) => (
										<Card key={report.id} className="border">
											<CardContent className="p-4">
												<div className="flex items-center justify-between">
													<div>
														<div className="flex items-center gap-2 mb-2">
															<Badge variant="outline">
																{(report.source || "nsdl").toUpperCase()}
															</Badge>
															<Badge variant="secondary">
																{report.financialYear}
															</Badge>
														</div>
														<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
															<div>
																<span className="text-muted-foreground">
																	LTCG:
																</span>
																<span className="ml-2 font-semibold">
																	{formatCurrency(report.totalLongTermGains)}
																</span>
															</div>
															<div>
																<span className="text-muted-foreground">
																	STCG:
																</span>
																<span className="ml-2 font-semibold">
																	{formatCurrency(report.totalShortTermGains)}
																</span>
															</div>
															<div>
																<span className="text-muted-foreground">
																	Dividend:
																</span>
																<span className="ml-2 font-semibold">
																	{formatCurrency(report.totalDividend)}
																</span>
															</div>
															<div>
																<span className="text-muted-foreground">
																	Generated:
																</span>
																<span className="ml-2">
																	{new Date(
																		report.createdAt,
																	).toLocaleDateString()}
																</span>
															</div>
														</div>
													</div>
													<div className="flex gap-2">
														<Button
															variant="outline"
															size="sm"
															onClick={() => handleDownloadPDF(report.id)}
															data-testid={`button-download-pdf-${report.id}`}
														>
															<FileText className="h-4 w-4" />
														</Button>
														<Button
															variant="outline"
															size="sm"
															onClick={() => handleDownloadExcel(report.id)}
															data-testid={`button-download-excel-${report.id}`}
														>
															<FileSpreadsheet className="h-4 w-4" />
														</Button>
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							) : (
								<div className="text-center py-8">
									<Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<h3 className="text-lg font-semibold text-muted-foreground mb-2">
										No Saved Reports
									</h3>
									<p className="text-muted-foreground">
										Generate and save reports to access them later.
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
