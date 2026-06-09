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
import { Progress } from "@/components/ui/progress";
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
	CheckCircle,
	AlertCircle,
	RefreshCw,
	Brain,
	Zap,
	Target,
	Shield as LucideShield,
	Archive,
	Calculator,
} from "lucide-react";

interface ITRDataSource {
	id: string;
	name: string;
	status: "connected" | "disconnected" | "syncing" | "error";
	lastSync: string | null;
	recordsCount: number;
	icon: any;
}

interface ITRPrefilledData {
	id: string;
	userId: string;
	assessmentYear: string;
	financialYear: string;
	itrForm: string;
	autoSelectedForm: boolean;
	taxRegime: string;
	completionPercentage: number;
	validationStatus: string;
	validationErrors?: string[];
	personalInfo: any;
	incomeFromSalary: any;
	incomeFromCapitalGains: any;
	incomeFromOtherSources: any;
	deductionsChapter6A: any;
	taxComputation: any;
	tdsDetails: any;
	readyForFiling: boolean;
	filingStatus: string;
}

export default function ITRPrefilledPage() {
	const [activeTab, setActiveTab] = useState("overview");
	const [selectedAssessmentYear, setSelectedAssessmentYear] =
		useState("2025-26");
	const [selectedFinancialYear, setSelectedFinancialYear] = useState("2024-25");
	const [selectedTaxRegime, setSelectedTaxRegime] = useState("new");
	const [shareEmail, setShareEmail] = useState("");

	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const userId = user?.id || "";

	// Fetch data sources status
	const { data: dataSources = [], isLoading: sourcesLoading } = useQuery<
		ITRDataSource[]
	>({
		queryKey: ["/api/itr/data-sources", userId],
		queryFn: async () => {
			const response = await fetch(`/api/itr/data-sources/${userId}`);
			const result = await response.json();
			return result.data || [];
		},
	});

	// Fetch pre-filled ITR data
	const {
		data: itrData,
		isLoading: itrLoading,
		refetch: refetchITR,
	} = useQuery<ITRPrefilledData>({
		queryKey: ["/api/itr/prefilled", userId, selectedAssessmentYear],
		queryFn: async () => {
			const response = await fetch(
				`/api/itr/prefilled/${userId}?assessmentYear=${selectedAssessmentYear}`,
			);
			const result = await response.json();
			return result.data;
		},
	});

	// Auto-populate ITR data
	const autoPopulateMutation = useMutation({
		mutationFn: async (data: {
			assessmentYear: string;
			financialYear: string;
			taxRegime: string;
			dataSources: string[];
		}) => {
			const response = await apiRequest("POST", "/api/itr/auto-populate", {
				body: data,
			});
			return response.json();
		},
		onSuccess: (data) => {
			toast({
				title: "ITR Auto-Population Started",
				description: `Intelligently gathering data from ${data.sourcesCount} sources. This may take a few minutes.`,
			});
			refetchITR();
			queryClient.invalidateQueries({ queryKey: ["/api/itr"] });
		},
		onError: (error: Error) => {
			toast({
				title: "Auto-Population Failed",
				description: `Failed to start ITR auto-population: ${error.message}`,
				variant: "destructive",
			});
		},
	});

	// Sync specific data source
	const syncDataSourceMutation = useMutation({
		mutationFn: async (sourceId: string) => {
			const response = await apiRequest(
				"POST",
				`/api/itr/sync-source/${sourceId}`,
				{ body: { userId } },
			);
			return response.json();
		},
		onSuccess: (data, sourceId) => {
			toast({
				title: "Data Source Synced",
				description: `Successfully synced data from ${sourceId}`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/itr/data-sources"] });
		},
	});

	// Validate ITR data
	const validateITRMutation = useMutation({
		mutationFn: async () => {
			const response = await apiRequest(
				"POST",
				`/api/itr/validate/${itrData?.id}`,
				{ body: {} },
			);
			return response.json();
		},
		onSuccess: (data) => {
			toast({
				title: "ITR Validation Complete",
				description: `Validation completed. ${data.errorsFound} issues found.`,
				variant: data.errorsFound > 0 ? "destructive" : "default",
			});
			refetchITR();
		},
	});

	// Generate ITR for filing
	const generateITRMutation = useMutation({
		mutationFn: async () => {
			const response = await apiRequest(
				"POST",
				`/api/itr/generate/${itrData?.id}`,
				{ body: {} },
			);
			return response.json();
		},
		onSuccess: (data) => {
			toast({
				title: "ITR Generated Successfully",
				description:
					"Your ITR is ready for filing. Download the JSON/XML file.",
			});
			refetchITR();
		},
	});

	const handleAutoPopulate = () => {
		const connectedSources = dataSources
			.filter((source) => source.status === "connected")
			.map((source) => source.id);

		autoPopulateMutation.mutate({
			assessmentYear: selectedAssessmentYear,
			financialYear: selectedFinancialYear,
			taxRegime: selectedTaxRegime,
			dataSources: connectedSources,
		});
	};

	const formatCurrency = (amount: string | number) => {
		const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			minimumFractionDigits: 0,
		}).format(num);
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "connected":
				return (
					<Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
						<CheckCircle className="h-3 w-3 mr-1" />
						Connected
					</Badge>
				);
			case "syncing":
				return (
					<Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
						<Loader2 className="h-3 w-3 mr-1 animate-spin" />
						Syncing
					</Badge>
				);
			case "error":
				return (
					<Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
						<AlertCircle className="h-3 w-3 mr-1" />
						Error
					</Badge>
				);
			default:
				return <Badge className="bg-muted text-foreground">Disconnected</Badge>;
		}
	};

	return (
		<div className="max-w-7xl mx-auto p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-3">
						<Brain className="h-8 w-8 text-blue-600" />
						ITR Pre-filled
					</h1>
					<p className="text-muted-foreground mt-2">
						Intelligent Income Tax Return preparation with auto-population from
						multiple sources
					</p>
				</div>
				<div className="flex gap-3">
					<Button
						onClick={handleAutoPopulate}
						disabled={
							autoPopulateMutation.isPending ||
							dataSources.filter((s) => s.status === "connected").length === 0
						}
						className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
						data-testid="button-auto-populate"
					>
						{autoPopulateMutation.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Zap className="mr-2 h-4 w-4" />
						)}
						Auto-Populate ITR
					</Button>
				</div>
			</div>

			{/* Configuration */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Target className="h-5 w-5" />
						ITR Configuration
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="space-y-2">
							<Label>Assessment Year</Label>
							<Select
								value={selectedAssessmentYear}
								onValueChange={setSelectedAssessmentYear}
							>
								<SelectTrigger data-testid="select-assessment-year">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="2025-26">2025-26</SelectItem>
									<SelectItem value="2024-25">2024-25</SelectItem>
									<SelectItem value="2023-24">2023-24</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Financial Year</Label>
							<Select
								value={selectedFinancialYear}
								onValueChange={setSelectedFinancialYear}
							>
								<SelectTrigger data-testid="select-financial-year">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="2024-25">2024-25</SelectItem>
									<SelectItem value="2023-24">2023-24</SelectItem>
									<SelectItem value="2022-23">2022-23</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Tax Regime</Label>
							<Select
								value={selectedTaxRegime}
								onValueChange={setSelectedTaxRegime}
							>
								<SelectTrigger data-testid="select-tax-regime">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="new">New Tax Regime</SelectItem>
									<SelectItem value="old">Old Tax Regime</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
			</Card>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-6"
			>
				<ScrollableTabsList className="grid grid-cols-4 w-full max-w-2xl">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="data-sources">Data Sources</TabsTrigger>
					<TabsTrigger value="itr-form">ITR Form</TabsTrigger>
					<TabsTrigger value="validation">Validation</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value="overview" className="space-y-6">
					{/* ITR Status Overview */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Completion</p>
										<p className="text-2xl font-bold text-blue-600">
											{itrData?.completionPercentage || 0}%
										</p>
									</div>
									<Target className="h-8 w-8 text-blue-600" />
								</div>
								<Progress
									value={itrData?.completionPercentage || 0}
									className="mt-4"
								/>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">ITR Form</p>
										<p className="text-2xl font-bold text-green-600">
											{itrData?.itrForm || "Auto-Select"}
										</p>
									</div>
									<FileText className="h-8 w-8 text-green-600" />
								</div>
								{itrData?.autoSelectedForm && (
									<Badge className="mt-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
										Auto-Selected
									</Badge>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">Status</p>
										<p className="text-2xl font-bold text-purple-600">
											{itrData?.filingStatus || "Draft"}
										</p>
									</div>
									<LucideShield className="h-8 w-8 text-purple-600" />
								</div>
								{itrData?.readyForFiling && (
									<Badge className="mt-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
										Ready for Filing
									</Badge>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Data Sources Summary */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="h-5 w-5" />
								Connected Data Sources
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								{dataSources.map((source) => (
									<div
										key={source.id}
										className="flex items-center gap-3 p-3 rounded-lg border"
									>
										<source.icon className="h-6 w-6 text-blue-600" />
										<div>
											<p className="font-medium">{source.name}</p>
											{getStatusBadge(source.status)}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Quick Actions */}
					<Card>
						<CardHeader>
							<CardTitle>Quick Actions</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex flex-wrap gap-3">
								<Button
									onClick={() => validateITRMutation.mutate()}
									disabled={validateITRMutation.isPending || !itrData}
									variant="outline"
									data-testid="button-validate-itr"
								>
									{validateITRMutation.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									<CheckCircle className="mr-2 h-4 w-4" />
									Validate ITR
								</Button>

								<Button
									onClick={() => generateITRMutation.mutate()}
									disabled={
										generateITRMutation.isPending || !itrData?.readyForFiling
									}
									variant="outline"
									data-testid="button-generate-itr"
								>
									{generateITRMutation.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									<FileSpreadsheet className="mr-2 h-4 w-4" />
									Generate ITR
								</Button>

								<Button
									variant="outline"
									disabled={!itrData}
									onClick={() =>
										window.open(
											`/api/itr/download/${itrData?.id}/pdf`,
											"_blank",
										)
									}
									data-testid="button-download-pdf"
								>
									<Download className="mr-2 h-4 w-4" />
									Download PDF
								</Button>

								<Button
									variant="outline"
									disabled={!itrData}
									onClick={() =>
										window.open(
											`/api/itr/download/${itrData?.id}/json`,
											"_blank",
										)
									}
									data-testid="button-download-json"
								>
									<Archive className="mr-2 h-4 w-4" />
									Download JSON
								</Button>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="data-sources" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="h-5 w-5" />
								Data Sources Management
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{sourcesLoading ? (
									<div className="flex items-center justify-center p-8">
										<Loader2 className="h-8 w-8 animate-spin" />
									</div>
								) : (
									dataSources.map((source) => (
										<div
											key={source.id}
											className="flex items-center justify-between p-4 border rounded-lg"
										>
											<div className="flex items-center gap-4">
												<source.icon className="h-8 w-8 text-blue-600" />
												<div>
													<h3 className="font-medium">{source.name}</h3>
													<p className="text-sm text-muted-foreground">
														{source.recordsCount} records • Last sync:{" "}
														{source.lastSync || "Never"}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3">
												{getStatusBadge(source.status)}
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														syncDataSourceMutation.mutate(source.id)
													}
													disabled={syncDataSourceMutation.isPending}
													data-testid={`button-sync-${source.id}`}
												>
													<RefreshCw className="h-4 w-4 mr-1" />
													Sync
												</Button>
											</div>
										</div>
									))
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="itr-form" className="space-y-6">
					{itrData ? (
						<>
							{/* Personal Information */}
							<Card>
								<CardHeader>
									<CardTitle>Personal Information</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Name</Label>
											<Input
												value={itrData.personalInfo?.name || ""}
												readOnly
												data-testid="input-name"
											/>
										</div>
										<div className="space-y-2">
											<Label>PAN</Label>
											<Input
												value={itrData.personalInfo?.pan || ""}
												readOnly
												data-testid="input-pan"
											/>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Income Summary */}
							<Card>
								<CardHeader>
									<CardTitle>Income Summary</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										<div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<IndianRupee className="h-4 w-4 text-blue-600" />
												<span className="text-sm font-medium text-blue-600">
													Salary Income
												</span>
											</div>
											<p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
												{formatCurrency(
													itrData.incomeFromSalary?.totalIncome || 0,
												)}
											</p>
										</div>

										<div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<TrendingUp className="h-4 w-4 text-green-600" />
												<span className="text-sm font-medium text-green-600">
													Capital Gains
												</span>
											</div>
											<p className="text-2xl font-bold text-green-700 dark:text-green-300">
												{formatCurrency(
													itrData.incomeFromCapitalGains?.totalGains || 0,
												)}
											</p>
										</div>

										<div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<Receipt className="h-4 w-4 text-purple-600" />
												<span className="text-sm font-medium text-purple-600">
													Other Sources
												</span>
											</div>
											<p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
												{formatCurrency(
													itrData.incomeFromOtherSources?.totalIncome || 0,
												)}
											</p>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Tax Computation */}
							<Card>
								<CardHeader>
									<CardTitle>Tax Computation</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="flex justify-between items-center">
											<span>Total Income</span>
											<span className="font-semibold">
												{formatCurrency(
													itrData.taxComputation?.totalIncome || 0,
												)}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span>Total Tax</span>
											<span className="font-semibold">
												{formatCurrency(itrData.taxComputation?.totalTax || 0)}
											</span>
										</div>
										<div className="flex justify-between items-center">
											<span>TDS Deducted</span>
											<span className="font-semibold text-green-600">
												{formatCurrency(itrData.tdsDetails?.totalTds || 0)}
											</span>
										</div>
										<Separator />
										<div className="flex justify-between items-center text-lg font-bold">
											<span>Refund/Tax Payable</span>
											<span
												className={
													itrData.taxComputation?.refundDue > 0
														? "text-green-600"
														: "text-red-600"
												}
											>
												{formatCurrency(itrData.taxComputation?.refundDue || 0)}
											</span>
										</div>
									</div>
								</CardContent>
							</Card>
						</>
					) : (
						<Card>
							<CardContent className="text-center py-12">
								<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
								<h3 className="text-lg font-semibold text-muted-foreground mb-2">
									No ITR Data Available
								</h3>
								<p className="text-muted-foreground mb-4">
									Click "Auto-Populate ITR" to start intelligent data
									collection.
								</p>
								<Button
									onClick={handleAutoPopulate}
									disabled={autoPopulateMutation.isPending}
								>
									<Zap className="mr-2 h-4 w-4" />
									Auto-Populate ITR
								</Button>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="validation" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CheckCircle className="h-5 w-5" />
								ITR Validation & Compliance
							</CardTitle>
						</CardHeader>
						<CardContent>
							{itrData ? (
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<span>Validation Status</span>
										<Badge
											variant={
												itrData.validationStatus === "validated"
													? "default"
													: "secondary"
											}
										>
											{itrData.validationStatus}
										</Badge>
									</div>

									{itrData.validationErrors &&
										itrData.validationErrors.length > 0 && (
											<div className="space-y-2">
												<h4 className="font-medium text-red-600">
													Validation Errors
												</h4>
												<ul className="space-y-1">
													{itrData.validationErrors.map(
														(error: string, index: number) => (
															<li
																key={index}
																className="text-sm text-red-600 flex items-center gap-2"
															>
																<AlertCircle className="h-4 w-4" />
																{error}
															</li>
														),
													)}
												</ul>
											</div>
										)}

									<Button
										onClick={() => validateITRMutation.mutate()}
										disabled={validateITRMutation.isPending}
										className="w-full"
										data-testid="button-validate-full"
									>
										{validateITRMutation.isPending && (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										)}
										Run Full Validation
									</Button>
								</div>
							) : (
								<div className="text-center py-8">
									<AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<p className="text-muted-foreground">
										No ITR data to validate. Generate your ITR first.
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
