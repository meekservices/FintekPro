import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Calculator,
	FileCheck2,
	MessageSquare,
	RefreshCw,
	CheckCircle2,
	AlertCircle,
	FileText,
	Send,
	Save,
	Sparkles,
	Coins,
} from "lucide-react";

interface CaseWorkspaceDrawerProps {
	caseId: string | null;
	isOpen: boolean;
	onClose: () => void;
	initialTab?: string;
	onCaseUpdated?: () => void;
}

export function CaseWorkspaceDrawer({
	caseId,
	isOpen,
	onClose,
	initialTab = "computation",
	onCaseUpdated,
}: CaseWorkspaceDrawerProps) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState(initialTab);

	useEffect(() => {
		if (initialTab) {
			setActiveTab(initialTab);
		}
	}, [initialTab]);

	// Fetch Full Case Details
	const { data: caseDetailData, isLoading } = useQuery<{
		success: boolean;
		data: any;
	}>({
		queryKey: [`/api/ca/cases/detail/${caseId}`],
		enabled: !!caseId && isOpen,
	});

	const caseData = caseDetailData?.data;

	// Computation Form State
	const [salaryIncome, setSalaryIncome] = useState<number>(0);
	const [interestIncome, setInterestIncome] = useState<number>(0);
	const [dividendIncome, setDividendIncome] = useState<number>(0);
	const [stcg, setStcg] = useState<number>(0);
	const [ltcg, setLtcg] = useState<number>(0);
	const [businessIncome, setBusinessIncome] = useState<number>(0);
	const [otherIncome, setOtherIncome] = useState<number>(0);
	const [section80c, setSection80c] = useState<number>(0);
	const [section80d, setSection80d] = useState<number>(0);
	const [otherDeductions, setOtherDeductions] = useState<number>(0);
	const [tdsPaid, setTdsPaid] = useState<number>(0);
	const [advanceTaxPaid, setAdvanceTaxPaid] = useState<number>(0);
	const [taxRegime, setTaxRegime] = useState<"new" | "old">("new");

	// Status Update State
	const [selectedStatus, setSelectedStatus] = useState<string>("");
	const [statusNotes, setStatusNotes] = useState<string>("");

	// Queries State
	const [newQueryText, setNewQueryText] = useState("");
	const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});

	// Reconciliation Inputs
	const [aisStcg, setAisStcg] = useState<number>(0);
	const [aisLtcg, setAisLtcg] = useState<number>(0);
	const [aisDividend, setAisDividend] = useState<number>(0);
	const [aisInterest, setAisInterest] = useState<number>(0);
	const [form26asTds, setForm26asTds] = useState<number>(0);
	const [reconciliationReport, setReconciliationReport] = useState<any>(null);

	// Populate values when case data loads
	useEffect(() => {
		if (caseData) {
			setSalaryIncome(Number(caseData.salaryIncome || 0));
			setInterestIncome(Number(caseData.interestIncome || 0));
			setDividendIncome(Number(caseData.dividendIncome || 0));
			setStcg(Number(caseData.capitalGainsStcg || 0));
			setLtcg(Number(caseData.capitalGainsLtcg || 0));
			setBusinessIncome(Number(caseData.businessIncome || 0));
			setOtherIncome(Number(caseData.otherIncome || 0));
			setSection80c(Number(caseData.section80c || 0));
			setSection80d(Number(caseData.section80d || 0));
			setOtherDeductions(Number(caseData.otherDeductions || 0));
			setTdsPaid(Number(caseData.tdsPaid || 0));
			setAdvanceTaxPaid(Number(caseData.advanceTaxPaid || 0));
			setTaxRegime(caseData.taxRegime === "old" ? "old" : "new");
			setSelectedStatus(caseData.status || "under_review");

			// Pre-fill recon defaults
			setAisStcg(Number(caseData.capitalGainsStcg || 0));
			setAisLtcg(Number(caseData.capitalGainsLtcg || 0));
			setAisDividend(Number(caseData.dividendIncome || 0));
			setAisInterest(Number(caseData.interestIncome || 0));
			setForm26asTds(Number(caseData.tdsPaid || 0));
		}
	}, [caseData]);

	// Save Computation Mutation
	const updateComputationMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("PATCH", `/api/ca/cases/${caseId}/computation`, {
				salaryIncome,
				interestIncome,
				dividendIncome,
				capitalGainsStcg: stcg,
				capitalGainsLtcg: ltcg,
				businessIncome,
				otherIncome,
				section80c,
				section80d,
				otherDeductions,
				tdsPaid,
				advanceTaxPaid,
				taxRegime,
			});
			return res.json();
		},
		onSuccess: (data) => {
			toast({
				title: "Computation Saved",
				description: `Updated calculation. Tax Payable: ₹${data.computation?.taxPayable?.toLocaleString() || 0}`,
			});
			queryClient.invalidateQueries({ queryKey: [`/api/ca/cases/detail/${caseId}`] });
			queryClient.invalidateQueries({ queryKey: ["/api/ca/cases"] });
			onCaseUpdated?.();
		},
		onError: (error: any) => {
			toast({
				title: "Error Saving Computation",
				description: error.message || "Failed to update computation",
				variant: "destructive",
			});
		},
	});

	// Status Update Mutation
	const updateStatusMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("PATCH", `/api/ca/cases/${caseId}/status`, {
				status: selectedStatus,
				notes: statusNotes.trim() ? statusNotes : undefined,
			});
			return res.json();
		},
		onSuccess: () => {
			toast({
				title: "Status Updated",
				description: `Case moved to ${selectedStatus.replace(/_/g, " ")}`,
			});
			setStatusNotes("");
			queryClient.invalidateQueries({ queryKey: [`/api/ca/cases/detail/${caseId}`] });
			queryClient.invalidateQueries({ queryKey: ["/api/ca/cases"] });
			onCaseUpdated?.();
		},
		onError: (err: any) => {
			toast({
				title: "Update Failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	// Query Mutation
	const addQueryMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", `/api/ca/cases/${caseId}/queries`, {
				query: newQueryText,
			});
			return res.json();
		},
		onSuccess: () => {
			toast({ title: "Query Sent", description: "Client notified regarding pending clarification" });
			setNewQueryText("");
			queryClient.invalidateQueries({ queryKey: [`/api/ca/cases/detail/${caseId}`] });
		},
	});

	// Resolve Query Mutation
	const resolveQueryMutation = useMutation({
		mutationFn: async ({ idx, response }: { idx: number; response: string }) => {
			const res = await apiRequest("PATCH", `/api/ca/cases/${caseId}/queries/${idx}/resolve`, {
				response,
			});
			return res.json();
		},
		onSuccess: () => {
			toast({ title: "Response Recorded", description: "Query marked as resolved" });
			queryClient.invalidateQueries({ queryKey: [`/api/ca/cases/detail/${caseId}`] });
		},
	});

	// Run Reconciliation Mutation
	const runReconMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", `/api/ca/reconciliation/run`, {
				caseId,
				aisData: {
					reportedStcg: aisStcg,
					reportedLtcg: aisLtcg,
					reportedDividendIncome: aisDividend,
					reportedSavingsInterest: aisInterest,
				},
				form26asData: {
					totalTdsClaimed: form26asTds,
				},
			});
			return res.json();
		},
		onSuccess: (res) => {
			setReconciliationReport(res.report);
			toast({
				title: "Reconciliation Complete",
				description: `Status: ${res.report.overallStatus}`,
			});
		},
		onError: (err: any) => {
			toast({
				title: "Reconciliation Failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	// Document Toggle Mutation
	const updateDocumentsMutation = useMutation({
		mutationFn: async (updatedDocs: { documentsRequired?: string[]; documentsReceived?: string[]; documentsMissing?: string[] }) => {
			const res = await apiRequest("PATCH", `/api/ca/cases/${caseId}/documents`, updatedDocs);
			return res.json();
		},
		onSuccess: () => {
			toast({ title: "Documents Updated", description: "Verification status saved" });
			queryClient.invalidateQueries({ queryKey: [`/api/ca/cases/detail/${caseId}`] });
		},
	});

	// Computed calculations for live display
	const totalGross = salaryIncome + interestIncome + dividendIncome + stcg + ltcg + businessIncome + otherIncome;
	const totalDeductions = taxRegime === "new" ? 75000 : 50000 + section80c + section80d + otherDeductions;
	const taxable = Math.max(0, totalGross - totalDeductions);
	const estimatedTax = taxRegime === "new"
		? taxable <= 700000 ? 0 : Math.round((taxable * 0.15) * 1.04)
		: taxable <= 500000 ? 0 : Math.round((taxable * 0.20) * 1.04);
	const netRefundOrDue = estimatedTax - (tdsPaid + advanceTaxPaid);

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-6">
				{isLoading ? (
					<div className="flex flex-col items-center justify-center py-20">
						<RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
						<p className="text-muted-foreground text-sm">Loading Case Workspace...</p>
					</div>
				) : !caseData ? (
					<div className="py-20 text-center text-muted-foreground">Case not found</div>
				) : (
					<div className="space-y-6">
						{/* Header */}
						<div>
							<div className="flex items-start justify-between">
								<div>
									<div className="flex items-center gap-2">
										<SheetTitle className="text-xl font-bold">
											{caseData.client?.fullName || "Client Workspace"}
										</SheetTitle>
										<Badge variant="outline" className="font-mono text-xs">
											{caseData.assessmentYear} ({caseData.itrFormType || "ITR-2"})
										</Badge>
									</div>
									<SheetDescription className="mt-1 flex items-center gap-3 text-xs">
										<span>Email: {caseData.client?.email || "N/A"}</span>
										{caseData.client?.maskedPan && (
											<span>PAN: <strong className="font-mono">{caseData.client.maskedPan}</strong></span>
										)}
										<Badge variant="secondary" className="capitalize text-[11px]">
											Priority: {caseData.priority}
										</Badge>
									</SheetDescription>
								</div>
							</div>

							{/* Status Stepper & Quick Action */}
							<div className="mt-4 p-3 bg-muted/40 rounded-lg border flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<Label className="text-xs font-medium">Status:</Label>
									<Select value={selectedStatus} onValueChange={setSelectedStatus}>
										<SelectTrigger className="w-48 h-8 text-xs font-semibold">
											<SelectValue placeholder="Update status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="documents_pending">Documents Pending</SelectItem>
											<SelectItem value="under_review">Under Review</SelectItem>
											<SelectItem value="draft_ready">Draft Ready</SelectItem>
											<SelectItem value="filed">Filed with ITD</SelectItem>
											<SelectItem value="acknowledged">Acknowledged (ITR-V)</SelectItem>
											<SelectItem value="completed">Completed</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<Button
									size="sm"
									className="h-8 text-xs"
									disabled={selectedStatus === caseData.status || updateStatusMutation.isPending}
									onClick={() => updateStatusMutation.mutate()}
								>
									{updateStatusMutation.isPending ? "Updating..." : "Update Status"}
								</Button>
							</div>
						</div>

						{/* Main Workspace Tabs */}
						<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
							<TabsList className="grid grid-cols-4 w-full">
								<TabsTrigger value="computation" className="text-xs">
									<Calculator className="w-3.5 h-3.5 mr-1" /> Computation
								</TabsTrigger>
								<TabsTrigger value="reconciliation" className="text-xs">
									<FileCheck2 className="w-3.5 h-3.5 mr-1" /> AIS Recon
								</TabsTrigger>
								<TabsTrigger value="documents" className="text-xs">
									<FileText className="w-3.5 h-3.5 mr-1" /> Docs Vault
								</TabsTrigger>
								<TabsTrigger value="queries" className="text-xs">
									<MessageSquare className="w-3.5 h-3.5 mr-1" /> Queries
								</TabsTrigger>
							</TabsList>

							{/* TAB 1: COMPUTATION & TAX REGIME */}
							<TabsContent value="computation" className="space-y-4 mt-4">
								{/* Live Summary Bar */}
								<div className="grid grid-cols-3 gap-3">
									<Card className="p-3 bg-card border">
										<p className="text-xs text-muted-foreground">Gross Income</p>
										<p className="text-lg font-bold text-foreground">₹{totalGross.toLocaleString()}</p>
									</Card>
									<Card className="p-3 bg-card border">
										<p className="text-xs text-muted-foreground">Taxable Income</p>
										<p className="text-lg font-bold text-foreground">₹{taxable.toLocaleString()}</p>
									</Card>
									<Card className="p-3 bg-card border">
										<p className="text-xs text-muted-foreground">Refund / Tax Due</p>
										<p className={`text-lg font-bold ${netRefundOrDue > 0 ? "text-destructive" : "text-emerald-600"}`}>
											{netRefundOrDue > 0 ? `₹${netRefundOrDue.toLocaleString()} (Due)` : `₹${Math.abs(netRefundOrDue).toLocaleString()} (Refund)`}
										</p>
									</Card>
								</div>

								{/* Regime Switcher */}
								<div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border">
									<div>
										<Label className="text-sm font-semibold">Tax Regime</Label>
										<p className="text-xs text-muted-foreground">
											{taxRegime === "new" ? "New Regime (§ 115BAC) with ₹75k Standard Deduction" : "Old Regime with Chapter VI-A Deductions"}
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant={taxRegime === "new" ? "default" : "outline"}
											onClick={() => setTaxRegime("new")}
											className="h-8 text-xs"
										>
											New Regime
										</Button>
										<Button
											size="sm"
											variant={taxRegime === "old" ? "default" : "outline"}
											onClick={() => setTaxRegime("old")}
											className="h-8 text-xs"
										>
											Old Regime
										</Button>
									</div>
								</div>

								{/* Income Sources Form */}
								<Card>
									<CardHeader className="py-3 px-4">
										<CardTitle className="text-sm font-semibold flex items-center gap-2">
											<Coins className="w-4 h-4 text-primary" /> Heads of Income
										</CardTitle>
									</CardHeader>
									<CardContent className="px-4 pb-4 space-y-3">
										<div className="grid grid-cols-2 gap-3">
											<div>
												<Label className="text-xs">Salary Income (Form 16)</Label>
												<Input
													type="number"
													value={salaryIncome}
													onChange={(e) => setSalaryIncome(Number(e.target.value))}
													className="h-8 text-xs mt-1"
												/>
											</div>
											<div>
												<Label className="text-xs">Business & Professional</Label>
												<Input
													type="number"
													value={businessIncome}
													onChange={(e) => setBusinessIncome(Number(e.target.value))}
													className="h-8 text-xs mt-1"
												/>
											</div>
										</div>

										<div className="grid grid-cols-2 gap-3">
											<div>
												<Label className="text-xs">Short-Term Capital Gains (STCG § 111A)</Label>
												<Input
													type="number"
													value={stcg}
													onChange={(e) => setStcg(Number(e.target.value))}
													className="h-8 text-xs mt-1"
												/>
											</div>
											<div>
												<Label className="text-xs">Long-Term Capital Gains (LTCG § 112A)</Label>
												<Input
													type="number"
													value={ltcg}
													onChange={(e) => setLtcg(Number(e.target.value))}
													className="h-8 text-xs mt-1"
												/>
											</div>
										</div>

										<div className="grid grid-cols-2 gap-3">
											<div>
												<Label className="text-xs">Dividend Income (§ 56)</Label>
												<Input
													type="number"
													value={dividendIncome}
													onChange={(e) => setDividendIncome(Number(e.target.value))}
													className="h-8 text-xs mt-1"
												/>
											</div>
											<div>
												<Label className="text-xs">Interest from Bank & FDs</Label>
												<Input
													type="number"
													value={interestIncome}
													onChange={(e) => setInterestIncome(Number(e.target.value))}
													className="h-8 text-xs mt-1"
												/>
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Deductions & Taxes Paid */}
								<div className="grid grid-cols-2 gap-3">
									<Card>
										<CardHeader className="py-2.5 px-4">
											<CardTitle className="text-xs font-semibold">Deductions (Old Regime)</CardTitle>
										</CardHeader>
										<CardContent className="px-4 pb-3 space-y-2">
											<div>
												<Label className="text-xs">Section 80C</Label>
												<Input
													type="number"
													disabled={taxRegime === "new"}
													value={section80c}
													onChange={(e) => setSection80c(Number(e.target.value))}
													className="h-7 text-xs mt-0.5"
												/>
											</div>
											<div>
												<Label className="text-xs">Section 80D (Health)</Label>
												<Input
													type="number"
													disabled={taxRegime === "new"}
													value={section80d}
													onChange={(e) => setSection80d(Number(e.target.value))}
													className="h-7 text-xs mt-0.5"
												/>
											</div>
										</CardContent>
									</Card>

									<Card>
										<CardHeader className="py-2.5 px-4">
											<CardTitle className="text-xs font-semibold">Taxes Paid & Credits</CardTitle>
										</CardHeader>
										<CardContent className="px-4 pb-3 space-y-2">
											<div>
												<Label className="text-xs">TDS Paid (26AS)</Label>
												<Input
													type="number"
													value={tdsPaid}
													onChange={(e) => setTdsPaid(Number(e.target.value))}
													className="h-7 text-xs mt-0.5"
												/>
											</div>
											<div>
												<Label className="text-xs">Advance / Self-Assessment Tax</Label>
												<Input
													type="number"
													value={advanceTaxPaid}
													onChange={(e) => setAdvanceTaxPaid(Number(e.target.value))}
													className="h-7 text-xs mt-0.5"
												/>
											</div>
										</CardContent>
									</Card>
								</div>

								<Button
									className="w-full h-9 font-medium text-xs flex items-center justify-center gap-2"
									disabled={updateComputationMutation.isPending}
									onClick={() => updateComputationMutation.mutate()}
								>
									<Save className="w-4 h-4" />
									{updateComputationMutation.isPending ? "Calculating..." : "Save & Recompute Tax"}
								</Button>
							</TabsContent>

							{/* TAB 2: AIS & 26AS RECONCILIATION */}
							<TabsContent value="reconciliation" className="space-y-4 mt-4">
								<Card className="p-4 bg-muted/20 border">
									<div className="flex items-center justify-between">
										<div>
											<CardTitle className="text-sm font-bold flex items-center gap-1.5">
												<Sparkles className="w-4 h-4 text-primary" /> AIS/TIS & 26AS Automated Triangulation
											</CardTitle>
											<CardDescription className="text-xs mt-0.5">
												Cross-checks broker portfolio capital gains and 26AS credits against Income Tax Department records.
											</CardDescription>
										</div>
										<Button
											size="sm"
											className="h-8 text-xs flex items-center gap-1.5"
											disabled={runReconMutation.isPending}
											onClick={() => runReconMutation.mutate()}
										>
											<RefreshCw className={`w-3.5 h-3.5 ${runReconMutation.isPending ? "animate-spin" : ""}`} />
											Run Reconciliation
										</Button>
									</div>

									<Separator className="my-3" />

									{/* Editable AIS inputs for verification */}
									<div className="grid grid-cols-4 gap-2 text-xs">
										<div>
											<Label className="text-[11px]">AIS STCG</Label>
											<Input
												type="number"
												value={aisStcg}
												onChange={(e) => setAisStcg(Number(e.target.value))}
												className="h-7 text-xs mt-0.5"
											/>
										</div>
										<div>
											<Label className="text-[11px]">AIS LTCG</Label>
											<Input
												type="number"
												value={aisLtcg}
												onChange={(e) => setAisLtcg(Number(e.target.value))}
												className="h-7 text-xs mt-0.5"
											/>
										</div>
										<div>
											<Label className="text-[11px]">AIS Dividends</Label>
											<Input
												type="number"
												value={aisDividend}
												onChange={(e) => setAisDividend(Number(e.target.value))}
												className="h-7 text-xs mt-0.5"
											/>
										</div>
										<div>
											<Label className="text-[11px]">26AS TDS Total</Label>
											<Input
												type="number"
												value={form26asTds}
												onChange={(e) => setForm26asTds(Number(e.target.value))}
												className="h-7 text-xs mt-0.5"
											/>
										</div>
									</div>
								</Card>

								{/* Reconciliation Report Display */}
								{reconciliationReport && (
									<div className="space-y-3">
										<div className="flex items-center justify-between p-3 rounded-lg border bg-card">
											<div className="flex items-center gap-2">
												{reconciliationReport.overallStatus === "RECONCILED" ? (
													<CheckCircle2 className="w-5 h-5 text-emerald-600" />
												) : (
													<AlertCircle className="w-5 h-5 text-amber-500" />
												)}
												<div>
													<p className="text-xs font-bold uppercase">{reconciliationReport.overallStatus.replace(/_/g, " ")}</p>
													<p className="text-[11px] text-muted-foreground">
														Net Variance: ₹{reconciliationReport.summary.netVariance.toLocaleString()} | TDS Variance: ₹{reconciliationReport.summary.tdsVariance.toLocaleString()}
													</p>
												</div>
											</div>
											<Button
												size="sm"
												variant="secondary"
												className="h-7 text-xs"
												onClick={() => {
													setStcg(aisStcg);
													setLtcg(aisLtcg);
													setDividendIncome(aisDividend);
													setTdsPaid(form26asTds);
													toast({ title: "Figures Adopted", description: "AIS reconciled amounts copied into Computation" });
													setActiveTab("computation");
												}}
											>
												Apply to Computation
											</Button>
										</div>

										{/* Discrepancy Breakdown Table */}
										<div className="border rounded-md overflow-hidden">
											<table className="w-full text-xs">
												<thead className="bg-muted font-medium">
													<tr>
														<th className="p-2 text-left">Category & Section</th>
														<th className="p-2 text-right">Portfolio</th>
														<th className="p-2 text-right">Govt AIS</th>
														<th className="p-2 text-right">Variance</th>
														<th className="p-2 text-center">Status</th>
													</tr>
												</thead>
												<tbody className="divide-y">
													{reconciliationReport.discrepancies.map((d: any, idx: number) => (
														<tr key={idx} className="hover:bg-muted/40">
															<td className="p-2">
																<p className="font-semibold">{d.field}</p>
																<p className="text-[10px] text-muted-foreground">{d.statutorySection}</p>
															</td>
															<td className="p-2 text-right">₹{d.portfolioAmount.toLocaleString()}</td>
															<td className="p-2 text-right">₹{d.reportedGovtAmount.toLocaleString()}</td>
															<td className="p-2 text-right font-medium">₹{d.variance.toLocaleString()}</td>
															<td className="p-2 text-center">
																<Badge
																	variant={d.riskLevel === "MATCH" ? "outline" : "destructive"}
																	className="text-[10px] py-0 px-1.5"
																>
																	{d.riskLevel}
																</Badge>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>

										{/* Grandfathering Notice */}
										<div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-900 text-xs">
											<p className="font-semibold text-blue-900 dark:text-blue-200">
												{reconciliationReport.grandfatheringVerification.status}: Section 112A Grandfathering
											</p>
											<p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-0.5">
												{reconciliationReport.grandfatheringVerification.notes}
											</p>
										</div>
									</div>
								)}
							</TabsContent>

							{/* TAB 3: DOCUMENTS VAULT */}
							<TabsContent value="documents" className="space-y-4 mt-4">
								<Card>
									<CardHeader className="py-3 px-4">
										<CardTitle className="text-xs font-semibold">Client Tax Document Checklist</CardTitle>
									</CardHeader>
									<CardContent className="px-4 pb-4 space-y-2">
										{[
											{ id: "form_16", label: "Form 16 (Part A & B from Employer)" },
											{ id: "ais_tis", label: "Annual Information Statement (AIS/TIS)" },
											{ id: "form_26as", label: "Form 26AS Tax Credit Statement" },
											{ id: "cams_kfin_pnl", label: "CAMS / KFintech Capital Gains Statement" },
											{ id: "broker_ledger", label: "Zerodha / Upstox Realized P&L Ledger" },
											{ id: "bank_statements", label: "Bank Account Interest Certificates" },
										].map((doc) => {
											const isReceived = (caseData.documentsReceived || []).includes(doc.id);
											return (
												<div key={doc.id} className="flex items-center justify-between p-2 rounded border text-xs">
													<div className="flex items-center gap-2">
														<FileText className="w-4 h-4 text-muted-foreground" />
														<span>{doc.label}</span>
													</div>
													<Badge
														variant={isReceived ? "default" : "secondary"}
														className="cursor-pointer"
														onClick={() => {
															const currentRec = caseData.documentsReceived || [];
															const nextRec = isReceived
																? currentRec.filter((d: string) => d !== doc.id)
																: [...currentRec, doc.id];
															updateDocumentsMutation.mutate({ documentsReceived: nextRec });
														}}
													>
														{isReceived ? "Received" : "Mark Received"}
													</Badge>
												</div>
											);
										})}
									</CardContent>
								</Card>
							</TabsContent>

							{/* TAB 4: CLIENT QUERIES */}
							<TabsContent value="queries" className="space-y-4 mt-4">
								<Card className="p-3">
									<Label className="text-xs font-semibold">Send Clarification Query to Client</Label>
									<div className="flex gap-2 mt-2">
										<Input
											placeholder="e.g. Please clarify missing savings interest from HDFC account..."
											value={newQueryText}
											onChange={(e) => setNewQueryText(e.target.value)}
											className="h-8 text-xs"
										/>
										<Button
											size="sm"
											className="h-8 text-xs"
											disabled={!newQueryText.trim() || addQueryMutation.isPending}
											onClick={() => addQueryMutation.mutate()}
										>
											<Send className="w-3.5 h-3.5 mr-1" /> Send
										</Button>
									</div>
								</Card>

								<div className="space-y-2">
									{(caseData.clientQueries || []).length === 0 ? (
										<p className="text-center py-6 text-xs text-muted-foreground">No queries raised yet.</p>
									) : (
										(caseData.clientQueries as any[]).map((q, idx) => (
											<div key={idx} className="p-3 bg-muted/40 rounded-lg border text-xs space-y-2">
												<div className="flex justify-between items-start">
													<p className="font-semibold text-foreground">{q.query}</p>
													<span className="text-[10px] text-muted-foreground">
														{new Date(q.askedAt).toLocaleDateString()}
													</span>
												</div>
												{q.response ? (
													<div className="p-2 bg-primary/10 rounded text-[11px] text-primary-foreground border-l-2 border-primary">
														<span className="font-semibold text-primary">Response: </span>
														<span className="text-foreground">{q.response}</span>
													</div>
												) : (
													<div className="flex gap-2 pt-1">
														<Input
															placeholder="Record client's answer..."
															value={replyTexts[idx] || ""}
															onChange={(e) => setReplyTexts({ ...replyTexts, [idx]: e.target.value })}
															className="h-7 text-xs"
														/>
														<Button
															size="sm"
															variant="secondary"
															className="h-7 text-[11px]"
															onClick={() => {
																if (replyTexts[idx]) {
																	resolveQueryMutation.mutate({ idx, response: replyTexts[idx] });
																}
															}}
														>
															Resolve
														</Button>
													</div>
												)}
											</div>
										))
									)}
								</div>
							</TabsContent>
						</Tabs>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}

