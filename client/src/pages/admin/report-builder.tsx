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
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	FileText,
	Plus,
	Download,
	Calendar,
	Clock,
	RefreshCw,
	Play,
	Trash2,
	Edit,
	Copy,
	Mail,
	FileSpreadsheet,
	File,
	Filter,
	BarChart3,
	Users,
	DollarSign,
	Shield as LucideShield,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ReportTemplate {
	id: string;
	name: string;
	description: string;
	category: string;
	columns: string[];
	filters: Record<string, any>;
	schedule?: {
		frequency: "daily" | "weekly" | "monthly";
		time: string;
		recipients: string[];
	};
	lastRun?: string;
	createdBy: string;
}

interface GeneratedReport {
	id: string;
	templateId: string;
	templateName: string;
	status: "pending" | "generating" | "completed" | "failed";
	format: "pdf" | "excel" | "csv";
	createdAt: string;
	completedAt?: string;
	downloadUrl?: string;
	fileSize?: number;
}

interface ReportBuilderData {
	templates: ReportTemplate[];
	recentReports: GeneratedReport[];
	availableColumns: Record<string, string[]>;
	stats: {
		totalTemplates: number;
		reportsGenerated: number;
		scheduledReports: number;
	};
}

const categoryIcons: Record<string, any> = {
	users: Users,
	revenue: DollarSign,
	kyc: LucideShield,
	analytics: TrendingUp,
	compliance: LucideShield,
};

export default function ReportBuilder() {
	const { toast } = useToast();
	const [selectedCategory, setSelectedCategory] = useState<string>("all");
	const [showBuilder, setShowBuilder] = useState(false);

	const { data, isLoading, refetch, isFetching } = useQuery<ReportBuilderData>({
		queryKey: ["/api/admin/report-builder"],
	});

	const generateReportMutation = useMutation({
		mutationFn: async ({
			templateId,
			format,
		}: { templateId: string; format: string }) => {
			return await apiRequest("/api/admin/reports/generate", {
				method: "POST",
				body: JSON.stringify({ templateId, format }),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			toast({
				title: "Report Queued",
				description: "Your report is being generated",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/report-builder"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const filteredTemplates = (data?.templates || []).filter(
		(t) => selectedCategory === "all" || t.category === selectedCategory,
	);

	const getStatusColor = (status: string) => {
		switch (status) {
			case "completed":
				return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200";
			case "generating":
				return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
			case "pending":
				return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200";
			case "failed":
				return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
			default:
				return "bg-muted text-foreground";
		}
	};

	const formatFileSize = (bytes?: number) => {
		if (!bytes) return "-";
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground">Report Builder</h1>
					<p className="text-sm text-muted-foreground">
						Create custom reports with scheduling and export options
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={() => refetch()}
						disabled={isFetching}
						variant="outline"
						data-testid="button-refresh"
					>
						<RefreshCw
							className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
					<Button
						onClick={() => setShowBuilder(true)}
						data-testid="button-new-report"
					>
						<Plus className="w-4 h-4 mr-2" />
						New Report
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<FileText className="w-4 h-4 text-blue-600" />
							Report Templates
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-blue-600">
							{data?.stats?.totalTemplates || 0}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Download className="w-4 h-4 text-emerald-600" />
							Reports Generated
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-emerald-600">
							{data?.stats?.reportsGenerated || 0}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Calendar className="w-4 h-4 text-purple-600" />
							Scheduled
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold text-purple-600">
							{data?.stats?.scheduledReports || 0}
						</p>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="templates" className="w-full">
				<TabsList>
					<TabsTrigger value="templates" data-testid="tab-templates">
						Templates
					</TabsTrigger>
					<TabsTrigger value="recent" data-testid="tab-recent">
						Recent Reports
					</TabsTrigger>
					<TabsTrigger value="scheduled" data-testid="tab-scheduled">
						Scheduled
					</TabsTrigger>
				</TabsList>

				<TabsContent value="templates" className="mt-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Report Templates</CardTitle>
									<CardDescription>
										Pre-built and custom report templates
									</CardDescription>
								</div>
								<Select
									value={selectedCategory}
									onValueChange={setSelectedCategory}
								>
									<SelectTrigger
										className="w-[150px]"
										data-testid="select-category"
									>
										<Filter className="w-4 h-4 mr-2" />
										<SelectValue placeholder="Category" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Categories</SelectItem>
										<SelectItem value="users">Users</SelectItem>
										<SelectItem value="revenue">Revenue</SelectItem>
										<SelectItem value="kyc">KYC</SelectItem>
										<SelectItem value="analytics">Analytics</SelectItem>
										<SelectItem value="compliance">Compliance</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{filteredTemplates.map((template) => {
									const IconComponent =
										categoryIcons[template.category] || FileText;
									return (
										<div
											key={template.id}
											className="p-4 border rounded-lg hover:bg-muted"
											data-testid={`template-${template.id}`}
										>
											<div className="flex items-start justify-between">
												<div className="flex items-center gap-3">
													<div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
														<IconComponent className="w-5 h-5 text-blue-600" />
													</div>
													<div>
														<p className="font-medium">{template.name}</p>
														<p className="text-sm text-muted-foreground">
															{template.description}
														</p>
													</div>
												</div>
												<Badge variant="outline">{template.category}</Badge>
											</div>

											<div className="mt-4 flex items-center justify-between">
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													{template.schedule ? (
														<>
															<Calendar className="w-4 h-4" />
															<span className="capitalize">
																{template.schedule.frequency}
															</span>
														</>
													) : (
														<>
															<Clock className="w-4 h-4" />
															<span>Manual</span>
														</>
													)}
													{template.lastRun && (
														<span className="ml-2">
															Last:{" "}
															{format(new Date(template.lastRun), "MMM dd")}
														</span>
													)}
												</div>
												<div className="flex items-center gap-1">
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															generateReportMutation.mutate({
																templateId: template.id,
																format: "pdf",
															})
														}
													>
														<File className="w-4 h-4 mr-1" />
														PDF
													</Button>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															generateReportMutation.mutate({
																templateId: template.id,
																format: "excel",
															})
														}
													>
														<FileSpreadsheet className="w-4 h-4 mr-1" />
														Excel
													</Button>
													<Button size="sm" variant="ghost">
														<Edit className="w-4 h-4" />
													</Button>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="recent" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Recent Reports</CardTitle>
							<CardDescription>
								Previously generated reports available for download
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{(data?.recentReports || []).length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
										<p>No reports generated yet</p>
									</div>
								) : (
									(data?.recentReports || []).map((report) => (
										<div
											key={report.id}
											className="flex items-center justify-between p-4 border rounded-lg"
											data-testid={`report-${report.id}`}
										>
											<div className="flex items-center gap-4">
												<div
													className={`p-2 rounded-lg ${
														report.format === "pdf"
															? "bg-red-100 dark:bg-red-900/30"
															: report.format === "excel"
																? "bg-emerald-100 dark:bg-emerald-900/30"
																: "bg-blue-100 dark:bg-blue-900/30"
													}`}
												>
													{report.format === "pdf" ? (
														<File className="w-5 h-5 text-red-600" />
													) : report.format === "excel" ? (
														<FileSpreadsheet className="w-5 h-5 text-emerald-600" />
													) : (
														<FileText className="w-5 h-5 text-blue-600" />
													)}
												</div>
												<div>
													<p className="font-medium">{report.templateName}</p>
													<p className="text-sm text-muted-foreground">
														{format(
															new Date(report.createdAt),
															"MMM dd, yyyy HH:mm",
														)}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3">
												<Badge className={getStatusColor(report.status)}>
													{report.status}
												</Badge>
												{report.fileSize && (
													<span className="text-sm text-muted-foreground">
														{formatFileSize(report.fileSize)}
													</span>
												)}
												{report.status === "completed" &&
													report.downloadUrl && (
														<Button size="sm" variant="outline">
															<Download className="w-4 h-4 mr-1" />
															Download
														</Button>
													)}
											</div>
										</div>
									))
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="scheduled" className="mt-4">
					<Card>
						<CardHeader>
							<CardTitle>Scheduled Reports</CardTitle>
							<CardDescription>
								Automated report generation schedules
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{filteredTemplates
									.filter((t) => t.schedule)
									.map((template) => (
										<div
											key={template.id}
											className="flex items-center justify-between p-4 border rounded-lg"
											data-testid={`scheduled-${template.id}`}
										>
											<div className="flex items-center gap-4">
												<Calendar className="w-5 h-5 text-purple-600" />
												<div>
													<p className="font-medium">{template.name}</p>
													<p className="text-sm text-muted-foreground capitalize">
														{template.schedule?.frequency} at{" "}
														{template.schedule?.time}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3">
												<div className="text-right">
													<p className="text-sm font-medium">
														{template.schedule?.recipients.length || 0}{" "}
														recipients
													</p>
													<div className="flex items-center gap-1 text-muted-foreground">
														<Mail className="w-3 h-3" />
														<span className="text-xs">Auto-email</span>
													</div>
												</div>
												<Button size="sm" variant="ghost">
													<Edit className="w-4 h-4" />
												</Button>
											</div>
										</div>
									))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
