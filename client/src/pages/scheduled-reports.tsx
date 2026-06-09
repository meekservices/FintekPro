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
import { Switch } from "@/components/ui/switch";
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
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	FileText,
	Plus,
	Calendar,
	Clock,
	Mail,
	Trash2,
	Play,
	Pause,
	Download,
	BarChart3,
	PieChart,
	TrendingUp,
} from "lucide-react";

interface ScheduledReport {
	id: string;
	reportType: string;
	reportName: string;
	frequency: string;
	dayOfWeek?: number;
	dayOfMonth?: number;
	deliveryEmail: string;
	isActive: boolean;
	lastRun?: string;
	nextRun?: string;
}

interface ReportFormData {
	reportType: string;
	reportName: string;
	frequency: string;
	dayOfWeek: number;
	dayOfMonth: number;
	deliveryEmail: string;
}

const REPORT_TYPES = [
	{ value: "portfolio_summary", label: "Portfolio Summary", icon: PieChart },
	{
		value: "transaction_history",
		label: "Transaction History",
		icon: FileText,
	},
	{ value: "capital_gains", label: "Capital Gains Report", icon: TrendingUp },
	{ value: "dividend_income", label: "Dividend Income", icon: BarChart3 },
	{ value: "tax_statement", label: "Tax Statement", icon: FileText },
	{
		value: "performance_analysis",
		label: "Performance Analysis",
		icon: TrendingUp,
	},
];

const FREQUENCIES = [
	{ value: "daily", label: "Daily" },
	{ value: "weekly", label: "Weekly" },
	{ value: "monthly", label: "Monthly" },
	{ value: "quarterly", label: "Quarterly" },
];

const DAYS_OF_WEEK = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

export default function ScheduledReports() {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [formData, setFormData] = useState<ReportFormData>({
		reportType: "",
		reportName: "",
		frequency: "monthly",
		dayOfWeek: 1,
		dayOfMonth: 1,
		deliveryEmail: "",
	});
	const { toast } = useToast();

	const { data, isLoading } = useQuery<{
		success: boolean;
		reports: ScheduledReport[];
	}>({
		queryKey: ["/api/features/reports/scheduled"],
	});

	const createMutation = useMutation({
		mutationFn: async (data: ReportFormData) => {
			return apiRequest("/api/features/reports/scheduled", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			toast({
				title: "Report Scheduled",
				description: "Your report has been scheduled successfully.",
			});
			setIsDialogOpen(false);
			setFormData({
				reportType: "",
				reportName: "",
				frequency: "monthly",
				dayOfWeek: 1,
				dayOfMonth: 1,
				deliveryEmail: "",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/features/reports/scheduled"],
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to schedule report.",
				variant: "destructive",
			});
		},
	});

	const reports = data?.reports || [];

	const handleSubmit = () => {
		if (
			!formData.reportType ||
			!formData.reportName ||
			!formData.deliveryEmail
		) {
			toast({
				title: "Missing Fields",
				description: "Please fill all required fields.",
				variant: "destructive",
			});
			return;
		}
		createMutation.mutate(formData);
	};

	return (
		<div className="container max-w-6xl mx-auto py-8 px-4">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-3">
						<Calendar className="h-8 w-8 text-primary" />
						Scheduled Reports
					</h1>
					<p className="text-muted-foreground mt-2">
						Automate your financial reports and receive them on schedule
					</p>
				</div>

				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button data-testid="create-report-btn">
							<Plus className="h-4 w-4 mr-2" />
							Schedule Report
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Schedule New Report</DialogTitle>
							<DialogDescription>
								Set up automated report delivery to your email
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label>Report Type</Label>
								<Select
									value={formData.reportType}
									onValueChange={(v) =>
										setFormData({ ...formData, reportType: v })
									}
								>
									<SelectTrigger data-testid="report-type-select">
										<SelectValue placeholder="Select report type" />
									</SelectTrigger>
									<SelectContent>
										{REPORT_TYPES.map((type) => (
											<SelectItem key={type.value} value={type.value}>
												<div className="flex items-center gap-2">
													<type.icon className="h-4 w-4" />
													{type.label}
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label>Report Name</Label>
								<Input
									placeholder="My Monthly Portfolio Report"
									value={formData.reportName}
									onChange={(e) =>
										setFormData({ ...formData, reportName: e.target.value })
									}
									data-testid="report-name-input"
								/>
							</div>

							<div className="space-y-2">
								<Label>Frequency</Label>
								<Select
									value={formData.frequency}
									onValueChange={(v) =>
										setFormData({ ...formData, frequency: v })
									}
								>
									<SelectTrigger data-testid="frequency-select">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{FREQUENCIES.map((freq) => (
											<SelectItem key={freq.value} value={freq.value}>
												{freq.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{formData.frequency === "weekly" && (
								<div className="space-y-2">
									<Label>Day of Week</Label>
									<Select
										value={String(formData.dayOfWeek)}
										onValueChange={(v) =>
											setFormData({
												...formData,
												dayOfWeek: Number.parseInt(v),
											})
										}
									>
										<SelectTrigger data-testid="day-of-week-select">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DAYS_OF_WEEK.map((day, i) => (
												<SelectItem key={i} value={String(i)}>
													{day}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}

							{(formData.frequency === "monthly" ||
								formData.frequency === "quarterly") && (
								<div className="space-y-2">
									<Label>Day of Month</Label>
									<Select
										value={String(formData.dayOfMonth)}
										onValueChange={(v) =>
											setFormData({
												...formData,
												dayOfMonth: Number.parseInt(v),
											})
										}
									>
										<SelectTrigger data-testid="day-of-month-select">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{Array.from({ length: 28 }, (_, i) => (
												<SelectItem key={i + 1} value={String(i + 1)}>
													{i + 1}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}

							<div className="space-y-2">
								<Label>Delivery Email</Label>
								<Input
									type="email"
									placeholder="your@email.com"
									value={formData.deliveryEmail}
									onChange={(e) =>
										setFormData({ ...formData, deliveryEmail: e.target.value })
									}
									data-testid="delivery-email-input"
								/>
							</div>

							<Button
								className="w-full"
								onClick={handleSubmit}
								disabled={createMutation.isPending}
								data-testid="submit-report-btn"
							>
								{createMutation.isPending ? "Scheduling..." : "Schedule Report"}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{isLoading ? (
				<div className="grid md:grid-cols-2 gap-4">
					{[1, 2].map((i) => (
						<Card key={i} className="animate-pulse">
							<CardHeader>
								<div className="h-6 bg-muted rounded w-3/4" />
							</CardHeader>
							<CardContent>
								<div className="h-20 bg-muted rounded" />
							</CardContent>
						</Card>
					))}
				</div>
			) : reports.length === 0 ? (
				<Card className="text-center py-12">
					<CardContent>
						<FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">No Scheduled Reports</h3>
						<p className="text-muted-foreground mb-4">
							Set up automated reports to receive financial insights on a
							regular schedule.
						</p>
						<Button onClick={() => setIsDialogOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Create Your First Report
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid md:grid-cols-2 gap-4">
					{reports.map((report) => (
						<Card key={report.id} data-testid={`report-card-${report.id}`}>
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<CardTitle className="text-lg">{report.reportName}</CardTitle>
									<Badge variant={report.isActive ? "default" : "secondary"}>
										{report.isActive ? "Active" : "Paused"}
									</Badge>
								</div>
								<CardDescription>
									{REPORT_TYPES.find((t) => t.value === report.reportType)
										?.label || report.reportType}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3 text-sm">
									<div className="flex items-center gap-2 text-muted-foreground">
										<Clock className="h-4 w-4" />
										<span className="capitalize">{report.frequency}</span>
									</div>
									<div className="flex items-center gap-2 text-muted-foreground">
										<Mail className="h-4 w-4" />
										<span>{report.deliveryEmail}</span>
									</div>
									{report.nextRun && (
										<div className="flex items-center gap-2 text-muted-foreground">
											<Calendar className="h-4 w-4" />
											<span>
												Next: {new Date(report.nextRun).toLocaleDateString()}
											</span>
										</div>
									)}
								</div>
								<div className="flex gap-2 mt-4">
									<Button variant="outline" size="sm">
										<Download className="h-4 w-4 mr-1" />
										Run Now
									</Button>
									<Button variant="ghost" size="sm">
										{report.isActive ? (
											<Pause className="h-4 w-4" />
										) : (
											<Play className="h-4 w-4" />
										)}
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className="text-destructive"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
