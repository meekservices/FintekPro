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
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
	Download,
	FileText,
	Calendar,
	BarChart3,
	Shield as LucideShield,
	AlertTriangle,
	CheckCircle,
	Clock,
	RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ComplianceReport {
	summary: {
		reportGeneratedAt: string;
		reportPeriod: { fromDate: string; toDate: string };
		totalAssessments: number;
		assessmentsByProfile: Record<string, number>;
		overridesApplied: number;
		overridesByType: Record<string, number>;
		auditLogCount: number;
		auditLogsByCategory: Record<string, number>;
	};
	assessments?: Array<{
		id: string;
		pan: string;
		profileCode: string;
		rawScore: number;
		hasOverride: boolean;
		overrideType?: string;
		createdAt: string;
	}>;
	auditLogs?: Array<{
		id: string;
		userId: string;
		action: string;
		actionCategory: string;
		actorRole: string;
		timestamp: string;
	}>;
}

const PROFILE_COLORS: Record<string, string> = {
	RP1: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	RP2: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
	RP3: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	RP4: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
	RP5: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
};

export default function RiskComplianceExport() {
	const { toast } = useToast();
	const [fromDate, setFromDate] = useState(() => {
		const d = new Date();
		d.setMonth(d.getMonth() - 1);
		return d.toISOString().split("T")[0];
	});
	const [toDate, setToDate] = useState(
		() => new Date().toISOString().split("T")[0],
	);
	const [reportType, setReportType] = useState<
		"summary" | "detailed" | "audit"
	>("summary");

	const {
		data: report,
		isLoading,
		refetch,
	} = useQuery<{ success: boolean; data: ComplianceReport }>({
		queryKey: [
			"/api/sebi-risk-profiling/compliance/report",
			fromDate,
			toDate,
			reportType,
		],
		enabled: false,
	});

	const generateReport = async () => {
		try {
			const response = await apiRequest(
				`/api/sebi-risk-profiling/compliance/report?fromDate=${fromDate}&toDate=${toDate}&reportType=${reportType}`,
			);
			refetch();
			toast({
				title: "Report Generated",
				description: "Compliance report generated successfully",
			});
		} catch (error: any) {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		}
	};

	const exportCSV = async () => {
		try {
			const response = await fetch(
				`/api/sebi-risk-profiling/compliance/export/csv?fromDate=${fromDate}&toDate=${toDate}`,
				{ credentials: "include" },
			);
			if (!response.ok) throw new Error("Export failed");

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `sebi_risk_compliance_${fromDate}_${toDate}.csv`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			toast({
				title: "Exported",
				description: "CSV file downloaded successfully",
			});
		} catch (error: any) {
			toast({
				title: "Export Failed",
				description: error.message,
				variant: "destructive",
			});
		}
	};

	const reportData = report?.data;

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<FileText className="h-6 w-6" />
						SEBI Compliance Reports
					</h1>
					<p className="text-muted-foreground">
						Generate and export risk profiling compliance reports for SEBI
						inspections
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						Report Parameters
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div>
							<Label>From Date</Label>
							<Input
								type="date"
								value={fromDate}
								onChange={(e) => setFromDate(e.target.value)}
								data-testid="input-from-date"
							/>
						</div>
						<div>
							<Label>To Date</Label>
							<Input
								type="date"
								value={toDate}
								onChange={(e) => setToDate(e.target.value)}
								data-testid="input-to-date"
							/>
						</div>
						<div>
							<Label>Report Type</Label>
							<Select
								value={reportType}
								onValueChange={(v) => setReportType(v as any)}
							>
								<SelectTrigger data-testid="select-report-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="summary">Summary Report</SelectItem>
									<SelectItem value="detailed">Detailed Report</SelectItem>
									<SelectItem value="audit">Full Audit Report</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-end gap-2">
							<Button
								onClick={generateReport}
								disabled={isLoading}
								data-testid="button-generate-report"
							>
								{isLoading ? (
									<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<BarChart3 className="h-4 w-4 mr-2" />
								)}
								Generate Report
							</Button>
							<Button
								variant="outline"
								onClick={exportCSV}
								data-testid="button-export-csv"
							>
								<Download className="h-4 w-4 mr-2" />
								Export CSV
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{reportData && (
				<>
					<Card>
						<CardHeader>
							<CardTitle>Report Summary</CardTitle>
							<CardDescription>
								Generated:{" "}
								{format(new Date(reportData.summary.reportGeneratedAt), "PPpp")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div className="p-4 bg-muted/50 rounded-lg text-center">
									<p className="text-3xl font-bold">
										{reportData.summary.totalAssessments}
									</p>
									<p className="text-sm text-muted-foreground">
										Total Assessments
									</p>
								</div>
								<div className="p-4 bg-muted/50 rounded-lg text-center">
									<p className="text-3xl font-bold">
										{reportData.summary.overridesApplied}
									</p>
									<p className="text-sm text-muted-foreground">
										Overrides Applied
									</p>
								</div>
								<div className="p-4 bg-muted/50 rounded-lg text-center">
									<p className="text-3xl font-bold">
										{reportData.summary.auditLogCount}
									</p>
									<p className="text-sm text-muted-foreground">
										Audit Log Entries
									</p>
								</div>
								<div className="p-4 bg-muted/50 rounded-lg text-center">
									<p className="text-3xl font-bold">
										{reportData.summary.totalAssessments > 0
											? Math.round(
													(reportData.summary.overridesApplied /
														reportData.summary.totalAssessments) *
														100,
												)
											: 0}
										%
									</p>
									<p className="text-sm text-muted-foreground">Override Rate</p>
								</div>
							</div>

							<Separator className="my-6" />

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<h4 className="font-medium mb-3">Assessments by Profile</h4>
									<div className="space-y-2">
										{Object.entries(
											reportData.summary.assessmentsByProfile,
										).map(([profile, count]) => (
											<div
												key={profile}
												className="flex items-center justify-between p-2 bg-muted/30 rounded"
											>
												<Badge className={PROFILE_COLORS[profile]}>
													{profile}
												</Badge>
												<span className="font-medium">{count}</span>
											</div>
										))}
										{Object.keys(reportData.summary.assessmentsByProfile)
											.length === 0 && (
											<p className="text-sm text-muted-foreground">
												No assessments in period
											</p>
										)}
									</div>
								</div>

								<div>
									<h4 className="font-medium mb-3">Overrides by Type</h4>
									<div className="space-y-2">
										{Object.entries(reportData.summary.overridesByType).map(
											([type, count]) => (
												<div
													key={type}
													className="flex items-center justify-between p-2 bg-muted/30 rounded"
												>
													<span className="capitalize">
														{type.replace(/_/g, " ")}
													</span>
													<Badge variant="secondary">{count}</Badge>
												</div>
											),
										)}
										{Object.keys(reportData.summary.overridesByType).length ===
											0 && (
											<p className="text-sm text-muted-foreground">
												No overrides in period
											</p>
										)}
									</div>
								</div>
							</div>

							<Separator className="my-6" />

							<div>
								<h4 className="font-medium mb-3">Audit Logs by Category</h4>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
									{Object.entries(reportData.summary.auditLogsByCategory).map(
										([category, count]) => (
											<div
												key={category}
												className="p-3 bg-muted/30 rounded text-center"
											>
												<p className="font-medium capitalize">
													{category.replace(/_/g, " ")}
												</p>
												<p className="text-2xl font-bold">{count}</p>
											</div>
										),
									)}
								</div>
							</div>
						</CardContent>
					</Card>

					{reportData.assessments && reportData.assessments.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Assessment Details</CardTitle>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>PAN</TableHead>
											<TableHead>Profile</TableHead>
											<TableHead>Score</TableHead>
											<TableHead>Override</TableHead>
											<TableHead>Date</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{reportData.assessments.slice(0, 50).map((a) => (
											<TableRow key={a.id}>
												<TableCell className="font-mono">{a.pan}</TableCell>
												<TableCell>
													<Badge className={PROFILE_COLORS[a.profileCode]}>
														{a.profileCode}
													</Badge>
												</TableCell>
												<TableCell>{Math.round(a.rawScore)}</TableCell>
												<TableCell>
													{a.hasOverride ? (
														<Badge variant="secondary">
															{a.overrideType || "Yes"}
														</Badge>
													) : (
														<span className="text-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell>
													{format(new Date(a.createdAt), "PP")}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
								{reportData.assessments.length > 50 && (
									<p className="text-sm text-muted-foreground mt-4 text-center">
										Showing 50 of {reportData.assessments.length} assessments.
										Export CSV for full data.
									</p>
								)}
							</CardContent>
						</Card>
					)}

					{reportData.auditLogs && reportData.auditLogs.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Audit Log Details</CardTitle>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Timestamp</TableHead>
											<TableHead>Action</TableHead>
											<TableHead>Category</TableHead>
											<TableHead>Actor</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{reportData.auditLogs.slice(0, 50).map((log) => (
											<TableRow key={log.id}>
												<TableCell>
													{format(new Date(log.timestamp), "PPpp")}
												</TableCell>
												<TableCell className="capitalize">
													{log.action.replace(/_/g, " ")}
												</TableCell>
												<TableCell>
													<Badge variant="outline">{log.actionCategory}</Badge>
												</TableCell>
												<TableCell className="capitalize">
													{log.actorRole || "-"}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
								{reportData.auditLogs.length > 50 && (
									<p className="text-sm text-muted-foreground mt-4 text-center">
										Showing 50 of {reportData.auditLogs.length} logs. Export CSV
										for full data.
									</p>
								)}
							</CardContent>
						</Card>
					)}
				</>
			)}

			<Alert>
				<LucideShield className="h-4 w-4" />
				<AlertTitle>SEBI Compliance Notice</AlertTitle>
				<AlertDescription>
					All risk profiling data is retained for 8 years as per SEBI
					regulations. Audit logs are immutable and include full traceability
					for regulatory inspections. Export reports periodically for backup.
				</AlertDescription>
			</Alert>
		</div>
	);
}
