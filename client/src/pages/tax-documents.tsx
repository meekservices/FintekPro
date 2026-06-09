import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Upload,
	FileText,
	Calculator,
	Download,
	Eye,
	Trash2,
	CheckCircle,
	Clock,
	AlertCircle,
	RefreshCw,
	FileCheck,
	TrendingUp,
	PieChart,
	DollarSign,
	Calendar,
} from "lucide-react";

interface TaxDocument {
	id: string;
	documentType: string;
	financialYear: string;
	fileName: string;
	fileFormat: string;
	documentUrl?: string;
	processingStatus: "pending" | "processing" | "completed" | "failed";
	processingError?: string;
	uploadedAt: string;
	metadata?: any;
}

interface StructuredTaxData {
	id: string;
	documentId: string;
	dataType: string;
	dataCategory: string;
	sourceType: string;
	taxableAmount?: number;
	taxDeducted?: number;
	transactionDate: string;
	deductorPan?: string;
	deductorName?: string;
	incomeNature?: string;
}

interface TaxCalculation {
	id: string;
	financialYear: string;
	taxRegime: "old" | "new";
	totalIncome: number;
	taxableIncome: number;
	grossTaxLiability: number;
	totalTaxPayable: number;
	totalTaxPaid: number;
	refundDue: number;
	taxPayable: number;
	incomeBreakdown: any;
	deductionBreakdown: any;
}

export default function TaxDocuments() {
	const [selectedYear, setSelectedYear] = useState("2023-24");
	const [uploadData, setUploadData] = useState({
		documentType: "",
		fileName: "",
		fileFormat: "pdf",
	});
	const [dragActive, setDragActive] = useState(false);
	const queryClient = useQueryClient();
	const { toast } = useToast();

	// Financial years for dropdown
	const financialYears = [
		"2023-24",
		"2022-23",
		"2021-22",
		"2020-21",
		"2019-20",
	];

	// Document types
	const documentTypes = [
		{ value: "26AS", label: "Form 26AS - Tax Credit Statement" },
		{ value: "AIS", label: "Annual Information Statement (AIS)" },
		{ value: "TIS", label: "Tax Information Summary (TIS)" },
		{ value: "Form16", label: "Form 16 - Salary Certificate" },
		{ value: "Form16A", label: "Form 16A - TDS Certificate" },
		{ value: "CapitalGains", label: "Capital Gains Statement" },
		{ value: "BankStatement", label: "Bank Interest Statement" },
		{ value: "HouseProperty", label: "House Property Income" },
		{ value: "BusinessIncome", label: "Business/Professional Income" },
	];

	// Fetch tax documents
	const { data: documents = [], isLoading: documentsLoading } = useQuery({
		queryKey: ["/api/tax/documents", selectedYear],
		queryFn: () =>
			apiRequest(`/api/tax/documents?financialYear=${selectedYear}`),
	});

	// Fetch structured tax data
	const { data: taxData = [], isLoading: taxDataLoading } = useQuery({
		queryKey: ["/api/tax/data", selectedYear],
		queryFn: () => apiRequest(`/api/tax/data?financialYear=${selectedYear}`),
	});

	// Fetch tax calculations
	const { data: calculations = [], isLoading: calculationsLoading } = useQuery({
		queryKey: ["/api/tax/calculations", selectedYear],
		queryFn: () =>
			apiRequest(`/api/tax/calculations?financialYear=${selectedYear}`),
	});

	// Upload document mutation
	const uploadMutation = useMutation({
		mutationFn: (data: any) =>
			apiRequest("/api/tax/documents", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/tax/documents"] });
			toast({
				title: "Success",
				description: "Document uploaded successfully",
			});
			setUploadData({ documentType: "", fileName: "", fileFormat: "pdf" });
		},
		onError: (error: any) => {
			toast({
				title: "Upload Failed",
				description: error.message || "Failed to upload document",
				variant: "destructive",
			});
		},
	});

	// Process document mutation
	const processMutation = useMutation({
		mutationFn: (documentId: string) =>
			apiRequest(`/api/tax/documents/${documentId}/process`, {
				method: "POST",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/tax/documents"] });
			queryClient.invalidateQueries({ queryKey: ["/api/tax/data"] });
			toast({
				title: "Processing Started",
				description: "Document processing has been initiated",
			});
		},
	});

	// Calculate tax mutation
	const calculateMutation = useMutation({
		mutationFn: (data: { financialYear: string; taxRegime: "old" | "new" }) =>
			apiRequest("/api/tax/calculate", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/tax/calculations"] });
			toast({
				title: "Tax Calculated",
				description: "Tax calculation completed successfully",
			});
		},
	});

	// Generate ITR mutation
	const generateITRMutation = useMutation({
		mutationFn: (financialYear: string) =>
			apiRequest("/api/tax/generate-itr", {
				method: "POST",
				body: JSON.stringify({ financialYear }),
			}),
		onSuccess: (data) => {
			// Create download link
			const blob = new Blob([data.itrJson], { type: "application/json" });
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.style.display = "none";
			a.href = url;
			a.download = `ITR_${selectedYear}.json`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);

			toast({
				title: "ITR Generated",
				description: "ITR JSON file has been downloaded",
			});
		},
	});

	// File drop handlers
	const onDrop = useCallback((acceptedFiles: File[]) => {
		const file = acceptedFiles[0];
		if (file) {
			setUploadData((prev) => ({
				...prev,
				fileName: file.name,
				fileFormat: file.name.split(".").pop()?.toLowerCase() || "pdf",
			}));
		}
	}, []);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			"application/pdf": [".pdf"],
			"application/json": [".json"],
			"text/csv": [".csv"],
			"application/vnd.ms-excel": [".xls"],
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
				".xlsx",
			],
		},
		multiple: false,
	});

	const handleUpload = () => {
		if (!uploadData.documentType || !uploadData.fileName) {
			toast({
				title: "Missing Information",
				description: "Please select document type and upload a file",
				variant: "destructive",
			});
			return;
		}

		uploadMutation.mutate({
			documentType: uploadData.documentType,
			financialYear: selectedYear,
			fileName: uploadData.fileName,
			fileFormat: uploadData.fileFormat,
			metadata: {
				uploadedVia: "web-interface",
				fileSize: 0, // Would be actual file size in real implementation
			},
		});
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "completed":
				return <CheckCircle className="h-4 w-4 text-green-500" />;
			case "processing":
				return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
			case "failed":
				return <AlertCircle className="h-4 w-4 text-red-500" />;
			default:
				return <Clock className="h-4 w-4 text-yellow-500" />;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "completed":
				return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
			case "processing":
				return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
			case "failed":
				return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
			default:
				return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200";
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(amount);
	};

	// Calculate summary statistics
	const totalIncome = (taxData as StructuredTaxData[]).reduce(
		(sum: number, item: StructuredTaxData) => sum + (item.taxableAmount || 0),
		0,
	);
	const totalTDSDeducted = (taxData as StructuredTaxData[]).reduce(
		(sum: number, item: StructuredTaxData) => sum + (item.taxDeducted || 0),
		0,
	);
	const latestCalculation = calculations[0];

	return (
		<div
			className="container mx-auto p-6 space-y-6"
			data-testid="tax-documents-page"
		>
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold" data-testid="page-title">
						Tax Documents & ITR Filing
					</h1>
					<p className="text-muted-foreground mt-2">
						Upload Form 26AS, AIS, and other tax documents to automatically
						generate your ITR
					</p>
				</div>
				<div className="flex items-center gap-4">
					<Label htmlFor="financial-year">Financial Year:</Label>
					<Select value={selectedYear} onValueChange={setSelectedYear}>
						<SelectTrigger
							className="w-[140px]"
							data-testid="select-financial-year"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{financialYears.map((year) => (
								<SelectItem key={year} value={year}>
									{year}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card data-testid="summary-documents">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Documents
								</p>
								<p className="text-2xl font-bold">{documents.length}</p>
							</div>
							<FileText className="h-8 w-8 text-blue-500" />
						</div>
					</CardContent>
				</Card>

				<Card data-testid="summary-income">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Total Income
								</p>
								<p className="text-2xl font-bold">
									{formatCurrency(totalIncome)}
								</p>
							</div>
							<TrendingUp className="h-8 w-8 text-green-500" />
						</div>
					</CardContent>
				</Card>

				<Card data-testid="summary-tds">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									TDS Deducted
								</p>
								<p className="text-2xl font-bold">
									{formatCurrency(totalTDSDeducted)}
								</p>
							</div>
							<DollarSign className="h-8 w-8 text-red-500" />
						</div>
					</CardContent>
				</Card>

				<Card data-testid="summary-refund">
					<CardContent className="p-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									{latestCalculation?.refundDue > 0
										? "Refund Due"
										: "Tax Payable"}
								</p>
								<p className="text-2xl font-bold">
									{latestCalculation
										? formatCurrency(
												latestCalculation.refundDue > 0
													? latestCalculation.refundDue
													: latestCalculation.taxPayable,
											)
										: "₹0"}
								</p>
							</div>
							<PieChart className="h-8 w-8 text-purple-500" />
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="upload" className="space-y-4">
				<ScrollableTabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="upload" data-testid="tab-upload">
						Upload Documents
					</TabsTrigger>
					<TabsTrigger value="documents" data-testid="tab-documents">
						My Documents
					</TabsTrigger>
					<TabsTrigger value="analysis" data-testid="tab-analysis">
						Tax Analysis
					</TabsTrigger>
					<TabsTrigger value="calculate" data-testid="tab-calculate">
						Calculate & Generate ITR
					</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value="upload" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Upload Tax Documents</CardTitle>
							<CardDescription>
								Upload your Form 26AS, AIS, or other tax-related documents to
								get started
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<Label htmlFor="document-type">Document Type</Label>
								<Select
									value={uploadData.documentType}
									onValueChange={(value) =>
										setUploadData((prev) => ({ ...prev, documentType: value }))
									}
								>
									<SelectTrigger data-testid="select-document-type">
										<SelectValue placeholder="Select document type" />
									</SelectTrigger>
									<SelectContent>
										{documentTypes.map((type) => (
											<SelectItem key={type.value} value={type.value}>
												{type.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div
								{...getRootProps()}
								className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
									isDragActive || dragActive
										? "border-primary bg-primary/5"
										: "border-muted-foreground/25 hover:border-primary/50"
								}`}
								data-testid="file-dropzone"
							>
								<input {...getInputProps()} />
								<Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
								<p className="text-lg font-medium mb-2">
									{uploadData.fileName ||
										"Drop your document here or click to browse"}
								</p>
								<p className="text-sm text-muted-foreground">
									Supports PDF, JSON, CSV, Excel files up to 10MB
								</p>
							</div>

							<Button
								onClick={handleUpload}
								disabled={
									uploadMutation.isPending ||
									!uploadData.documentType ||
									!uploadData.fileName
								}
								className="w-full"
								data-testid="button-upload"
							>
								{uploadMutation.isPending ? "Uploading..." : "Upload Document"}
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="documents" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Uploaded Documents</CardTitle>
							<CardDescription>
								Manage your uploaded tax documents for {selectedYear}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{documentsLoading ? (
								<div className="flex items-center justify-center py-8">
									<RefreshCw className="h-8 w-8 animate-spin" />
								</div>
							) : documents.length === 0 ? (
								<div className="text-center py-8">
									<FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
									<p className="text-lg font-medium mb-2">
										No documents uploaded
									</p>
									<p className="text-muted-foreground">
										Upload your first document to get started
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{documents.map((doc: TaxDocument) => (
										<div
											key={doc.id}
											className="flex items-center justify-between p-4 border rounded-lg"
											data-testid={`document-${doc.id}`}
										>
											<div className="flex items-center gap-4">
												<FileCheck className="h-8 w-8 text-blue-500" />
												<div>
													<h3 className="font-medium">{doc.fileName}</h3>
													<p className="text-sm text-muted-foreground">
														{doc.documentType} • Uploaded{" "}
														{new Date(doc.uploadedAt).toLocaleDateString()}
													</p>
												</div>
											</div>

											<div className="flex items-center gap-2">
												<Badge className={getStatusColor(doc.processingStatus)}>
													{getStatusIcon(doc.processingStatus)}
													<span className="ml-1 capitalize">
														{doc.processingStatus}
													</span>
												</Badge>

												{doc.processingStatus === "pending" && (
													<Button
														size="sm"
														variant="outline"
														onClick={() => processMutation.mutate(doc.id)}
														disabled={processMutation.isPending}
														data-testid={`button-process-${doc.id}`}
													>
														<RefreshCw className="h-4 w-4 mr-1" />
														Process
													</Button>
												)}

												<Button
													size="sm"
													variant="outline"
													data-testid={`button-view-${doc.id}`}
												>
													<Eye className="h-4 w-4" />
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="analysis" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Tax Data Analysis</CardTitle>
							<CardDescription>
								Detailed breakdown of your tax information for {selectedYear}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{taxDataLoading ? (
								<div className="flex items-center justify-center py-8">
									<RefreshCw className="h-8 w-8 animate-spin" />
								</div>
							) : taxData.length === 0 ? (
								<Alert>
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>
										No processed tax data available. Upload and process
										documents to see analysis.
									</AlertDescription>
								</Alert>
							) : (
								<div className="space-y-6">
									{/* Income Sources */}
									<div>
										<h3 className="text-lg font-semibold mb-3">
											Income Sources
										</h3>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											{Object.entries(
												taxData.reduce((acc: any, item: StructuredTaxData) => {
													const key = item.incomeNature || item.dataType;
													acc[key] =
														(acc[key] || 0) + (item.taxableAmount || 0);
													return acc;
												}, {}),
											).map(([source, amount]) => (
												<div key={source} className="p-4 border rounded-lg">
													<p className="font-medium capitalize">{source}</p>
													<p className="text-2xl font-bold text-green-600">
														{formatCurrency(amount as number)}
													</p>
												</div>
											))}
										</div>
									</div>

									{/* TDS Details */}
									<div>
										<h3 className="text-lg font-semibold mb-3">
											TDS Breakdown
										</h3>
										<div className="overflow-x-auto">
											<table className="w-full border-collapse border border-border">
												<thead>
													<tr className="bg-muted">
														<th className="border border-border p-2 text-left">
															Deductor
														</th>
														<th className="border border-border p-2 text-left">
															Income Nature
														</th>
														<th className="border border-border p-2 text-right">
															Taxable Amount
														</th>
														<th className="border border-border p-2 text-right">
															TDS Deducted
														</th>
														<th className="border border-border p-2 text-left">
															Date
														</th>
													</tr>
												</thead>
												<tbody>
													{taxData
														.filter(
															(item: StructuredTaxData) =>
																item.dataType === "TDS",
														)
														.slice(0, 10)
														.map((item: StructuredTaxData) => (
															<tr key={item.id}>
																<td className="border border-border p-2">
																	{item.deductorName || item.deductorPan}
																</td>
																<td className="border border-border p-2 capitalize">
																	{item.incomeNature}
																</td>
																<td className="border border-border p-2 text-right">
																	{formatCurrency(item.taxableAmount || 0)}
																</td>
																<td className="border border-border p-2 text-right">
																	{formatCurrency(item.taxDeducted || 0)}
																</td>
																<td className="border border-border p-2">
																	{new Date(
																		item.transactionDate,
																	).toLocaleDateString()}
																</td>
															</tr>
														))}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="calculate" className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle>Calculate Tax Liability</CardTitle>
								<CardDescription>
									Calculate your tax for {selectedYear} under different tax
									regimes
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-3">
									<Button
										onClick={() =>
											calculateMutation.mutate({
												financialYear: selectedYear,
												taxRegime: "old",
											})
										}
										disabled={calculateMutation.isPending}
										variant="outline"
										data-testid="button-calculate-old"
									>
										<Calculator className="h-4 w-4 mr-2" />
										Old Regime
									</Button>

									<Button
										onClick={() =>
											calculateMutation.mutate({
												financialYear: selectedYear,
												taxRegime: "new",
											})
										}
										disabled={calculateMutation.isPending}
										variant="outline"
										data-testid="button-calculate-new"
									>
										<Calculator className="h-4 w-4 mr-2" />
										New Regime
									</Button>
								</div>

								<Button
									onClick={() => generateITRMutation.mutate(selectedYear)}
									disabled={generateITRMutation.isPending}
									className="w-full"
									data-testid="button-generate-itr"
								>
									<Download className="h-4 w-4 mr-2" />
									{generateITRMutation.isPending
										? "Generating..."
										: "Generate ITR JSON"}
								</Button>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Tax Calculations</CardTitle>
								<CardDescription>
									Your calculated tax liability results
								</CardDescription>
							</CardHeader>
							<CardContent>
								{calculationsLoading ? (
									<div className="flex items-center justify-center py-8">
										<RefreshCw className="h-8 w-8 animate-spin" />
									</div>
								) : calculations.length === 0 ? (
									<Alert>
										<AlertCircle className="h-4 w-4" />
										<AlertDescription>
											No tax calculations available. Calculate your tax
											liability to see results.
										</AlertDescription>
									</Alert>
								) : (
									<div className="space-y-4">
										{calculations.slice(0, 2).map((calc: TaxCalculation) => (
											<div key={calc.id} className="border rounded-lg p-4">
												<div className="flex justify-between items-center mb-3">
													<Badge variant="secondary" className="capitalize">
														{calc.taxRegime} Regime
													</Badge>
													<span className="text-sm text-muted-foreground">
														{new Date().toLocaleDateString()}
													</span>
												</div>

												<div className="grid grid-cols-2 gap-4 text-sm">
													<div>
														<p className="text-muted-foreground">
															Total Income
														</p>
														<p className="font-semibold">
															{formatCurrency(calc.totalIncome)}
														</p>
													</div>
													<div>
														<p className="text-muted-foreground">
															Taxable Income
														</p>
														<p className="font-semibold">
															{formatCurrency(calc.taxableIncome)}
														</p>
													</div>
													<div>
														<p className="text-muted-foreground">
															Tax Liability
														</p>
														<p className="font-semibold">
															{formatCurrency(calc.totalTaxPayable)}
														</p>
													</div>
													<div>
														<p className="text-muted-foreground">
															{calc.refundDue > 0 ? "Refund" : "Tax Payable"}
														</p>
														<p
															className={`font-semibold ${
																calc.refundDue > 0
																	? "text-green-600"
																	: "text-red-600"
															}`}
														>
															{formatCurrency(
																calc.refundDue > 0
																	? calc.refundDue
																	: calc.taxPayable,
															)}
														</p>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
