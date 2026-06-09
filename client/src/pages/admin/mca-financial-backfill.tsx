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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	Database,
	RefreshCw,
	Upload,
	Search,
	Play,
	Pause,
	CheckCircle,
	XCircle,
	AlertTriangle,
	TrendingUp,
	Building2,
} from "lucide-react";

interface CoverageStats {
	totalCompanies: number;
	companiesWithData: number;
	companiesWithoutData: number;
	totalSnapshots: number;
	snapshotsWithRevenue: number;
	snapshotsWithPAT: number;
	snapshotsWithFullData: number;
	averageCompleteness: number;
}

interface CompanyBackfillInfo {
	cin: string;
	companyName: string;
	snapshotCount: number;
	hasFinancialData: boolean;
	avgCompleteness: number;
}

interface SchedulerStatus {
	isRunning: boolean;
	pendingJobs: number;
}

interface FieldCoverage {
	fieldName: string;
	displayName: string;
	filledCount: number;
	missingCount: number;
	coverage: number;
}

interface ImportResult {
	total: number;
	imported: number;
	updated: number;
	failed: number;
	errors: Array<{ row: number; error: string }>;
	validationErrors: Array<{ row: number; error: string }>;
}

export default function McaFinancialBackfill() {
	const { toast } = useToast();
	const [searchCin, setSearchCin] = useState("");
	const [bulkCins, setBulkCins] = useState("");
	const [jsonImport, setJsonImport] = useState("");
	const [importResult, setImportResult] = useState<ImportResult | null>(null);

	const { data: coverageStats, isLoading: loadingStats } = useQuery<{
		success: boolean;
		stats: CoverageStats;
	}>({
		queryKey: ["/api/admin/mca-backfill/coverage/stats"],
	});

	const { data: needsBackfill, isLoading: loadingNeeds } = useQuery<{
		success: boolean;
		companies: CompanyBackfillInfo[];
	}>({
		queryKey: ["/api/admin/mca-backfill/coverage/needs-backfill"],
	});

	const { data: schedulerStatus } = useQuery<
		{ success: boolean } & SchedulerStatus
	>({
		queryKey: ["/api/admin/mca-backfill/scheduler/status"],
		refetchInterval: 10000,
	});

	const { data: fieldCoverageData } = useQuery<{
		success: boolean;
		totalSnapshots: number;
		fields: FieldCoverage[];
	}>({
		queryKey: ["/api/admin/mca-backfill/coverage/fields"],
	});

	const backfillMutation = useMutation({
		mutationFn: async (cin: string) => {
			return apiRequest("POST", `/api/admin/mca-backfill/backfill/${cin}`);
		},
		onSuccess: (data: any) => {
			toast({
				title: data.success ? "Backfill Complete" : "Backfill Failed",
				description: data.message,
				variant: data.success ? "default" : "destructive",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/admin/mca-backfill"] });
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const bulkBackfillMutation = useMutation({
		mutationFn: async (cins: string[]) => {
			return apiRequest("POST", "/api/admin/mca-backfill/backfill-bulk", {
				cins,
			});
		},
		onSuccess: (data: any) => {
			toast({
				title: "Bulk Backfill Complete",
				description: `${data.successful}/${data.total} companies processed successfully`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/admin/mca-backfill"] });
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const importMutation = useMutation({
		mutationFn: async (data: any[]) => {
			return apiRequest("POST", "/api/admin/mca-backfill/import-bulk", {
				data,
			});
		},
		onSuccess: (data: any) => {
			setImportResult(data);
			const hasErrors = data.failed > 0 || data.validationErrors?.length > 0;
			toast({
				title: hasErrors ? "Import Completed with Errors" : "Import Complete",
				description: `Imported: ${data.imported}, Updated: ${data.updated}, Failed: ${data.failed}`,
				variant: hasErrors ? "destructive" : "default",
			});
			setJsonImport("");
			queryClient.invalidateQueries({ queryKey: ["/api/admin/mca-backfill"] });
		},
		onError: (error: any) => {
			try {
				const errorData =
					typeof error === "object" ? error : JSON.parse(error.message || "{}");
				if (errorData.validationErrors) {
					setImportResult({
						total: 0,
						imported: 0,
						updated: 0,
						failed: errorData.validationErrors.length,
						errors: [],
						validationErrors: errorData.validationErrors,
					});
				}
			} catch {}
			toast({
				title: "Import Error",
				description: error.message || "Failed to import data",
				variant: "destructive",
			});
		},
	});

	const schedulerMutation = useMutation({
		mutationFn: async (action: "start" | "stop" | "trigger") => {
			return apiRequest("POST", `/api/admin/mca-backfill/scheduler/${action}`);
		},
		onSuccess: (data: any) => {
			toast({
				title: "Scheduler Updated",
				description: data.message || "Action completed",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/mca-backfill/scheduler/status"],
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

	const handleBulkBackfill = () => {
		const cins = bulkCins
			.split(/[\n,]/)
			.map((c) => c.trim())
			.filter((c) => c.length === 21);
		if (cins.length === 0) {
			toast({
				title: "Invalid Input",
				description: "Please enter valid 21-character CINs",
				variant: "destructive",
			});
			return;
		}
		bulkBackfillMutation.mutate(cins);
	};

	const handleJsonImport = () => {
		try {
			const data = JSON.parse(jsonImport);
			if (!Array.isArray(data)) {
				throw new Error("JSON must be an array");
			}
			importMutation.mutate(data);
		} catch (error: any) {
			toast({
				title: "Invalid JSON",
				description: error.message,
				variant: "destructive",
			});
		}
	};

	const stats = coverageStats?.stats;
	const companies = needsBackfill?.companies || [];

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">MCA Financial Data Backfill</h1>
					<p className="text-muted-foreground">
						Manage and backfill financial data for MCA-registered companies
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant={schedulerStatus?.isRunning ? "default" : "secondary"}>
						{schedulerStatus?.isRunning
							? "Scheduler Running"
							: "Scheduler Stopped"}
					</Badge>
					<Button
						variant="outline"
						size="sm"
						onClick={() =>
							schedulerMutation.mutate(
								schedulerStatus?.isRunning ? "stop" : "start",
							)
						}
						disabled={schedulerMutation.isPending}
					>
						{schedulerStatus?.isRunning ? (
							<Pause className="w-4 h-4 mr-1" />
						) : (
							<Play className="w-4 h-4 mr-1" />
						)}
						{schedulerStatus?.isRunning ? "Stop" : "Start"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => schedulerMutation.mutate("trigger")}
						disabled={schedulerMutation.isPending}
					>
						<RefreshCw className="w-4 h-4 mr-1" />
						Trigger Refresh
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Total Companies
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stats?.totalCompanies || 0}
						</div>
						<p className="text-xs text-muted-foreground">
							{stats?.companiesWithData || 0} with data
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Financial Snapshots
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stats?.totalSnapshots || 0}
						</div>
						<p className="text-xs text-muted-foreground">
							{stats?.snapshotsWithFullData || 0} complete
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Avg Completeness
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{stats?.averageCompleteness || 0}%
						</div>
						<Progress
							value={stats?.averageCompleteness || 0}
							className="mt-2"
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{schedulerStatus?.pendingJobs || 0}
						</div>
						<p className="text-xs text-muted-foreground">
							Companies needing refresh
						</p>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="overview">
				<TabsList>
					<TabsTrigger value="overview">Coverage Overview</TabsTrigger>
					<TabsTrigger value="search">Search Company</TabsTrigger>
					<TabsTrigger value="bulk">Bulk Backfill</TabsTrigger>
					<TabsTrigger value="import">Import Data</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<AlertTriangle className="w-5 h-5 text-yellow-500" />
								Companies Needing Backfill
							</CardTitle>
							<CardDescription>
								Companies with missing or incomplete financial data
							</CardDescription>
						</CardHeader>
						<CardContent>
							{loadingNeeds ? (
								<div className="text-center py-4">Loading...</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>CIN</TableHead>
											<TableHead>Company Name</TableHead>
											<TableHead>Snapshots</TableHead>
											<TableHead>Completeness</TableHead>
											<TableHead>Action</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{companies.slice(0, 20).map((company) => (
											<TableRow key={company.cin}>
												<TableCell className="font-mono text-xs">
													{company.cin}
												</TableCell>
												<TableCell>{company.companyName}</TableCell>
												<TableCell>{company.snapshotCount}</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<Progress
															value={company.avgCompleteness}
															className="w-20"
														/>
														<span className="text-xs">
															{company.avgCompleteness}%
														</span>
													</div>
												</TableCell>
												<TableCell>
													<Button
														size="sm"
														variant="outline"
														onClick={() => backfillMutation.mutate(company.cin)}
														disabled={backfillMutation.isPending}
													>
														<RefreshCw className="w-3 h-3 mr-1" />
														Backfill
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>

					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center gap-2">
									<TrendingUp className="w-5 h-5 text-green-500" />
									<div>
										<div className="text-lg font-bold">
											{stats?.snapshotsWithRevenue || 0}
										</div>
										<div className="text-xs text-muted-foreground">
											With Revenue
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center gap-2">
									<CheckCircle className="w-5 h-5 text-blue-500" />
									<div>
										<div className="text-lg font-bold">
											{stats?.snapshotsWithPAT || 0}
										</div>
										<div className="text-xs text-muted-foreground">
											With PAT
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center gap-2">
									<Building2 className="w-5 h-5 text-purple-500" />
									<div>
										<div className="text-lg font-bold">
											{stats?.companiesWithoutData || 0}
										</div>
										<div className="text-xs text-muted-foreground">
											Without Data
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-6">
								<div className="flex items-center gap-2">
									<Database className="w-5 h-5 text-orange-500" />
									<div>
										<div className="text-lg font-bold">
											{stats?.snapshotsWithFullData || 0}
										</div>
										<div className="text-xs text-muted-foreground">
											Complete (80%+)
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{fieldCoverageData?.fields && fieldCoverageData.fields.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Database className="w-5 h-5" />
									Per-Field Coverage Statistics
								</CardTitle>
								<CardDescription>
									Data completeness breakdown by financial metric
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Field</TableHead>
											<TableHead>Filled</TableHead>
											<TableHead>Missing</TableHead>
											<TableHead>Coverage</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{fieldCoverageData.fields.map((field) => (
											<TableRow key={field.fieldName}>
												<TableCell className="font-medium">
													{field.displayName}
												</TableCell>
												<TableCell className="text-green-600">
													{field.filledCount}
												</TableCell>
												<TableCell className="text-red-600">
													{field.missingCount}
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<Progress value={field.coverage} className="w-24" />
														<span className="text-xs font-medium">
															{field.coverage}%
														</span>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="search">
					<Card>
						<CardHeader>
							<CardTitle>Search Company Financial Data</CardTitle>
							<CardDescription>
								Enter a CIN to view and backfill financial data
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex gap-2">
								<Input
									placeholder="Enter 21-character CIN (e.g., U24220KA1947PLC000311)"
									value={searchCin}
									onChange={(e) => setSearchCin(e.target.value.toUpperCase())}
									className="font-mono"
								/>
								<Button
									onClick={() => backfillMutation.mutate(searchCin)}
									disabled={
										searchCin.length !== 21 || backfillMutation.isPending
									}
								>
									<Search className="w-4 h-4 mr-2" />
									Search & Backfill
								</Button>
							</div>
							{searchCin.length > 0 && searchCin.length !== 21 && (
								<p className="text-sm text-destructive">
									CIN must be exactly 21 characters ({searchCin.length}/21)
								</p>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="bulk">
					<Card>
						<CardHeader>
							<CardTitle>Bulk Backfill</CardTitle>
							<CardDescription>
								Enter multiple CINs to backfill (one per line or
								comma-separated)
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Textarea
								placeholder="U24220KA1947PLC000311&#10;U72200TG1993PLC015206&#10;U65990MH2007PLC173708"
								value={bulkCins}
								onChange={(e) => setBulkCins(e.target.value.toUpperCase())}
								className="font-mono min-h-[200px]"
							/>
							<Button
								onClick={handleBulkBackfill}
								disabled={bulkBackfillMutation.isPending}
							>
								<RefreshCw className="w-4 h-4 mr-2" />
								{bulkBackfillMutation.isPending
									? "Processing..."
									: "Start Bulk Backfill"}
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="import">
					<Card>
						<CardHeader>
							<CardTitle>Import Financial Data</CardTitle>
							<CardDescription>
								Import historical financial data in JSON format
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="bg-muted p-3 rounded text-sm">
								<p className="font-medium mb-2">Expected JSON format:</p>
								<pre className="text-xs overflow-x-auto">
									{`[
  {
    "cin": "U24220KA1947PLC000311",
    "financialYear": "2023-24",
    "revenue": 150000000,
    "profitBeforeTax": 25000000,
    "profitAfterTax": 18000000,
    "netWorth": 75000000,
    "totalAssets": 120000000,
    "totalLiabilities": 45000000
  }
]`}
								</pre>
							</div>
							<Textarea
								placeholder="Paste JSON data here..."
								value={jsonImport}
								onChange={(e) => setJsonImport(e.target.value)}
								className="font-mono min-h-[300px]"
							/>
							<Button
								onClick={handleJsonImport}
								disabled={!jsonImport || importMutation.isPending}
							>
								<Upload className="w-4 h-4 mr-2" />
								{importMutation.isPending ? "Importing..." : "Import Data"}
							</Button>

							{importResult && (
								<div className="mt-4 space-y-4">
									<div className="grid grid-cols-4 gap-4">
										<div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
											<div className="text-lg font-bold text-green-600">
												{importResult.imported}
											</div>
											<div className="text-xs text-muted-foreground">
												Imported
											</div>
										</div>
										<div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
											<div className="text-lg font-bold text-blue-600">
												{importResult.updated}
											</div>
											<div className="text-xs text-muted-foreground">
												Updated
											</div>
										</div>
										<div className="bg-red-50 dark:bg-red-900/20 p-3 rounded">
											<div className="text-lg font-bold text-red-600">
												{importResult.failed}
											</div>
											<div className="text-xs text-muted-foreground">
												Failed
											</div>
										</div>
										<div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
											<div className="text-lg font-bold text-yellow-600">
												{importResult.validationErrors?.length || 0}
											</div>
											<div className="text-xs text-muted-foreground">
												Validation Errors
											</div>
										</div>
									</div>

									{(importResult.errors?.length > 0 ||
										importResult.validationErrors?.length > 0) && (
										<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
											<div className="font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
												<XCircle className="w-4 h-4" />
												Import Errors
											</div>
											<div className="max-h-40 overflow-y-auto text-sm">
												{importResult.validationErrors?.map((err, i) => (
													<div
														key={`v-${i}`}
														className="text-red-600 dark:text-red-400"
													>
														Row {err.row}: {err.error}
													</div>
												))}
												{importResult.errors?.map((err, i) => (
													<div
														key={`e-${i}`}
														className="text-red-600 dark:text-red-400"
													>
														Row {err.row}: {err.error}
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
