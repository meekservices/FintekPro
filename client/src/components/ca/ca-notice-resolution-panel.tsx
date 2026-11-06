import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	ShieldAlert,
	FileText,
	CheckCircle,
	AlertTriangle,
	Scale,
	Copy,
	BookOpen,
	Sparkles,
} from "lucide-react";

interface CANoticeResolutionPanelProps {
	caProfile?: any;
}

export function CANoticeResolutionPanel({ caProfile }: CANoticeResolutionPanelProps) {
	const { toast } = useToast();

	// Notice Form State
	const [din, setDin] = useState("ITBA/AST/S/143(1)/2024-25/1068947291(1)");
	const [noticeSection, setNoticeSection] = useState<string>("143(1)(a)");
	const [assessmentYear, setAssessmentYear] = useState("2024-25");
	const [noticeDate, setNoticeDate] = useState("2024-10-15");
	const [responseDueDate, setResponseDueDate] = useState("2024-11-14");
	const [demandAmount, setDemandAmount] = useState<number>(85400);
	const [proposedAddition, setProposedAddition] = useState<number>(320000);
	const [issueCategory, setIssueCategory] = useState<string>("CAPITAL_GAINS_MISMATCH");

	// Client Context
	const [clientName, setClientName] = useState("Rajesh V. Sharma");
	const [clientPan, setClientPan] = useState("ABCDE1234F");

	// Results State
	const [dinResult, setDinResult] = useState<any>(null);
	const [reconciliationResult, setReconciliationResult] = useState<any>(null);
	const [rebuttalDraft, setRebuttalDraft] = useState<any>(null);
	const [appealDraft, setAppealDraft] = useState<any>(null);

	// Validate DIN Mutation
	const validateDinMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/notices/validate", {
				din,
				noticeSection,
				assessmentYear,
				noticeDate,
				responseDueDate,
				demandAmount,
				proposedAdditionAmount: proposedAddition,
				issueCategory,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setDinResult(data.result);
			toast({
				title: data.result.isValidDin ? "Valid CBDT DIN" : "Invalid DIN Warning",
				description: data.result.dinComplianceNote,
				variant: data.result.isValidDin ? "default" : "destructive",
			});
		},
	});

	// Reconcile Notice Mutation
	const reconcileMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/notices/reconcile", {
				din,
				noticeSection,
				assessmentYear,
				noticeDate,
				responseDueDate,
				demandAmount,
				proposedAdditionAmount: proposedAddition,
				issueCategory,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setReconciliationResult(data.report);
			toast({
				title: "Variance Reconciled",
				description: `Disputed Addition: ₹${data.report.summary.totalProposedAddition.toLocaleString("en-IN")}`,
			});
		},
	});

	// Generate Legal Rebuttal Mutation
	const generateRebuttalMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/notices/rebuttal", {
				notice: {
					din,
					noticeSection,
					assessmentYear,
					noticeDate,
					responseDueDate,
					demandAmount,
					proposedAdditionAmount: proposedAddition,
					issueCategory,
				},
				clientName,
				clientPan,
				caFirmName: caProfile?.name ? `${caProfile.name} & Associates` : "Chartered Accountants",
				caName: caProfile?.name || "Authorized Representative",
				icaiNumber: caProfile?.icaiNumber,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setRebuttalDraft(data.draft);
			toast({
				title: "Legal Rebuttal Drafted",
				description: "Formal submission letter prepared with judicial citations",
			});
		},
	});

	// Draft CIT Appeal Mutation
	const draftAppealMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/notices/appeal", {
				notice: {
					din,
					noticeSection,
					assessmentYear,
					noticeDate,
					responseDueDate,
					demandAmount,
					proposedAdditionAmount: proposedAddition,
					issueCategory,
				},
				clientName,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setAppealDraft(data.draft);
			toast({
				title: "Form 35 Appeal Prepared",
				description: "Grounds formatted within 1,000-character portal constraints",
			});
		},
	});

	return (
		<div className="space-y-6">
			<Tabs defaultValue="intake" className="w-full">
				<TabsList className="grid grid-cols-4 w-full">
					<TabsTrigger value="intake" className="text-xs">
						<ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Notice & DIN Intake
					</TabsTrigger>
					<TabsTrigger value="reconcile" className="text-xs">
						<Scale className="w-3.5 h-3.5 mr-1.5" /> Variance Reconciler
					</TabsTrigger>
					<TabsTrigger value="rebuttal" className="text-xs">
						<FileText className="w-3.5 h-3.5 mr-1.5" /> Legal Rebuttal Builder
					</TabsTrigger>
					<TabsTrigger value="appeal" className="text-xs">
						<BookOpen className="w-3.5 h-3.5 mr-1.5" /> Form 35 (CIT Appeal)
					</TabsTrigger>
				</TabsList>

				{/* TAB 1: NOTICE INGESTION & DIN VERIFIER */}
				<TabsContent value="intake" className="mt-4 space-y-4">
					<Card>
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<ShieldAlert className="w-4 h-4 text-primary" /> Income Tax Notice Ingestion & CBDT DIN Authenticator
							</CardTitle>
							<CardDescription className="text-xs">
								Parses notice details, checks Document Identification Number (DIN) validity under CBDT Circular 19/2019, and monitors response deadlines.
							</CardDescription>
						</CardHeader>
						<CardContent className="px-4 pb-4 space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-xs font-semibold">Document Identification Number (DIN)</Label>
									<Input
										value={din}
										onChange={(e) => setDin(e.target.value)}
										className="h-8 text-xs font-mono mt-1"
									/>
									<p className="text-[10px] text-muted-foreground mt-0.5">Found at top of ITD intimation/notice</p>
								</div>
								<div>
									<Label className="text-xs font-semibold">Notice Statutory Section</Label>
									<Select value={noticeSection} onValueChange={setNoticeSection}>
										<SelectTrigger className="h-8 text-xs mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="143(1)(a)">Section 143(1)(a) - Prima Facie Adjustment</SelectItem>
											<SelectItem value="139(9)">Section 139(9) - Defective Return</SelectItem>
											<SelectItem value="142(1)">Section 142(1) - Inquiry Before Assessment</SelectItem>
											<SelectItem value="143(2)">Section 143(2) - Scrutiny Notice</SelectItem>
											<SelectItem value="148">Section 148 - Income Escaping Reassessment</SelectItem>
											<SelectItem value="156">Section 156 - Notice of Demand</SelectItem>
											<SelectItem value="245">Section 245 - Refund Set-Off Adjustment</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="grid grid-cols-4 gap-3">
								<div>
									<Label className="text-xs">Assessment Year</Label>
									<Input
										value={assessmentYear}
										onChange={(e) => setAssessmentYear(e.target.value)}
										className="h-8 text-xs mt-1"
									/>
								</div>
								<div>
									<Label className="text-xs">Notice Issue Date</Label>
									<Input
										type="date"
										value={noticeDate}
										onChange={(e) => setNoticeDate(e.target.value)}
										className="h-8 text-xs mt-1"
									/>
								</div>
								<div>
									<Label className="text-xs">Response Due Date</Label>
									<Input
										type="date"
										value={responseDueDate}
										onChange={(e) => setResponseDueDate(e.target.value)}
										className="h-8 text-xs mt-1 font-semibold text-destructive"
									/>
								</div>
								<div>
									<Label className="text-xs">Tax Demand Amount (₹)</Label>
									<Input
										type="number"
										value={demandAmount}
										onChange={(e) => setDemandAmount(Number(e.target.value))}
										className="h-8 text-xs mt-1 font-bold"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-xs">Proposed Income Addition / Disallowance (₹)</Label>
									<Input
										type="number"
										value={proposedAddition}
										onChange={(e) => setProposedAddition(Number(e.target.value))}
										className="h-8 text-xs mt-1 font-semibold"
									/>
								</div>
								<div>
									<Label className="text-xs">Dispute / Notice Category</Label>
									<Select value={issueCategory} onValueChange={setIssueCategory}>
										<SelectTrigger className="h-8 text-xs mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="CAPITAL_GAINS_MISMATCH">Capital Gains (§ 111A/112A vs AIS Mismatch)</SelectItem>
											<SelectItem value="TDS_CREDIT_MISMATCH">TDS Credit Mismatch (§ 199 / 26AS)</SelectItem>
											<SelectItem value="DEDUCTION_DISALLOWANCE">Chapter VI-A Deductions Disallowance</SelectItem>
											<SelectItem value="HIGH_VALUE_TRANSACTION">High Value SFT Cash / Property Transaction</SelectItem>
											<SelectItem value="OTHER">Other Disputed Additions</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="flex gap-2 justify-end">
								<Button
									size="sm"
									className="h-8 text-xs"
									disabled={validateDinMutation.isPending}
									onClick={() => validateDinMutation.mutate()}
								>
									{validateDinMutation.isPending ? "Validating..." : "Validate DIN & SLA"}
								</Button>
							</div>

							{dinResult && (
								<div className={`p-3 rounded border text-xs ${dinResult.isValidDin ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-red-50 dark:bg-red-950/20 border-red-200"}`}>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											{dinResult.isValidDin ? (
												<CheckCircle className="w-4 h-4 text-emerald-600" />
											) : (
												<AlertTriangle className="w-4 h-4 text-destructive" />
											)}
											<span className="font-bold">
												{dinResult.isValidDin ? "Authenticated CBDT DIN" : "Invalid DIN Notice"}
											</span>
										</div>
										<Badge
											variant={dinResult.urgencyStatus === "CRITICAL" ? "destructive" : "secondary"}
											className="text-[10px]"
										>
											{dinResult.daysRemaining} Days Left ({dinResult.urgencyStatus})
										</Badge>
									</div>
									<p className="mt-1 text-[11px] text-muted-foreground">{dinResult.dinComplianceNote}</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* TAB 2: VARIANCE RECONCILER */}
				<TabsContent value="reconcile" className="mt-4 space-y-4">
					<Card>
						<CardHeader className="py-3 px-4">
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-sm font-semibold flex items-center gap-2">
										<Scale className="w-4 h-4 text-primary" /> Proposed Adjustment vs Verified Ledger Reconciler
									</CardTitle>
									<CardDescription className="text-xs">
										Triangulates CPC's proposed addition against client's verified FintekPro ledger to explain the mismatch root cause.
									</CardDescription>
								</div>
								<Button
									size="sm"
									className="h-8 text-xs"
									disabled={reconcileMutation.isPending}
									onClick={() => reconcileMutation.mutate()}
								>
									Run Variance Analysis
								</Button>
							</div>
						</CardHeader>
						<CardContent className="px-4 pb-4 space-y-4">
							{reconciliationResult ? (
								<div className="space-y-4">
									<div className="grid grid-cols-3 gap-3">
										<Card className="p-3 bg-muted/20 border">
											<p className="text-[11px] text-muted-foreground">Proposed Addition</p>
											<p className="text-base font-bold text-destructive">
												₹{reconciliationResult.summary.totalProposedAddition.toLocaleString("en-IN")}
											</p>
										</Card>
										<Card className="p-3 bg-muted/20 border">
											<p className="text-[11px] text-muted-foreground">Disputed Demand</p>
											<p className="text-base font-bold text-amber-600">
												₹{reconciliationResult.summary.totalDemand.toLocaleString("en-IN")}
											</p>
										</Card>
										<Card className="p-3 bg-muted/20 border">
											<p className="text-[11px] text-muted-foreground">Verified Rebuttal Amount</p>
											<p className="text-base font-bold text-emerald-600">
												₹{reconciliationResult.summary.disputedVariance.toLocaleString("en-IN")}
											</p>
										</Card>
									</div>

									<div className="border rounded-md overflow-hidden">
										<table className="w-full text-xs">
											<thead className="bg-muted font-medium">
												<tr>
													<th className="p-2 text-left">Disputed Head & Section</th>
													<th className="p-2 text-right">Claimed in ITR</th>
													<th className="p-2 text-right">Proposed by CPC</th>
													<th className="p-2 text-right">FintekPro Verified</th>
													<th className="p-2 text-left">Factual Rebuttal Finding</th>
												</tr>
											</thead>
											<tbody className="divide-y">
												{reconciliationResult.variances.map((v: any, idx: number) => (
													<tr key={idx} className="hover:bg-muted/30">
														<td className="p-2">
															<p className="font-semibold">{v.head}</p>
															<p className="text-[10px] text-muted-foreground">{v.statutorySection}</p>
														</td>
														<td className="p-2 text-right">₹{v.claimedInItr.toLocaleString("en-IN")}</td>
														<td className="p-2 text-right text-destructive font-semibold">
															₹{v.proposedByCpc.toLocaleString("en-IN")}
														</td>
														<td className="p-2 text-right text-emerald-600 font-semibold">
															₹{v.fintekProVerified.toLocaleString("en-IN")}
														</td>
														<td className="p-2 text-[11px] text-muted-foreground max-w-xs">
															{v.reconciliationNote}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							) : (
								<div className="py-12 text-center text-xs text-muted-foreground">
									Click "Run Variance Analysis" to cross-reference proposed adjustments against FintekPro's broker and AIS records.
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* TAB 3: LEGAL REBUTTAL BUILDER */}
				<TabsContent value="rebuttal" className="mt-4 space-y-4">
					<Card>
						<CardHeader className="py-3 px-4">
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-sm font-semibold flex items-center gap-2">
										<FileText className="w-4 h-4 text-primary" /> Ground-by-Ground Legal Rebuttal Drafter
									</CardTitle>
									<CardDescription className="text-xs">
										Generates a formal written submission letter with preliminary objections, factual proof, and judicial precedents.
									</CardDescription>
								</div>
								<Button
									size="sm"
									className="h-8 text-xs flex items-center gap-1.5"
									disabled={generateRebuttalMutation.isPending}
									onClick={() => generateRebuttalMutation.mutate()}
								>
									<Sparkles className="w-3.5 h-3.5" />
									{generateRebuttalMutation.isPending ? "Drafting..." : "Generate Written Submission"}
								</Button>
							</div>
						</CardHeader>
						<CardContent className="px-4 pb-4 space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-xs">Assessee Legal Name</Label>
									<Input
										value={clientName}
										onChange={(e) => setClientName(e.target.value)}
										className="h-8 text-xs mt-1"
									/>
								</div>
								<div>
									<Label className="text-xs">Assessee PAN</Label>
									<Input
										value={clientPan}
										onChange={(e) => setClientPan(e.target.value.toUpperCase())}
										className="h-8 text-xs font-mono uppercase mt-1"
									/>
								</div>
							</div>

							{rebuttalDraft && (
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<Badge variant="outline" className="text-xs font-mono">
											Notice: {rebuttalDraft.din}
										</Badge>
										<Button
											size="sm"
											variant="secondary"
											className="h-7 text-xs flex items-center gap-1"
											onClick={() => {
												navigator.clipboard.writeText(rebuttalDraft.formattedSubmissionText);
												toast({ title: "Copied to Clipboard", description: "Submission letter copied for portal upload" });
											}}
										>
											<Copy className="w-3.5 h-3.5" /> Copy Letter
										</Button>
									</div>

									<Textarea
										rows={18}
										readOnly
										value={rebuttalDraft.formattedSubmissionText}
										className="font-mono text-xs leading-relaxed bg-muted/20"
									/>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* TAB 4: CIT APPEALS (FORM 35) */}
				<TabsContent value="appeal" className="mt-4 space-y-4">
					<Card>
						<CardHeader className="py-3 px-4">
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-sm font-semibold flex items-center gap-2">
										<BookOpen className="w-4 h-4 text-primary" /> Faceless Appeal (Form 35) Drafter
									</CardTitle>
									<CardDescription className="text-xs">
										Prepares Statement of Facts (SOF) and Grounds of Appeal (GOA) adhering to the strict 1,000-character portal limit per ground.
									</CardDescription>
								</div>
								<Button
									size="sm"
									className="h-8 text-xs"
									disabled={draftAppealMutation.isPending}
									onClick={() => draftAppealMutation.mutate()}
								>
									{draftAppealMutation.isPending ? "Generating..." : "Draft Form 35 Grounds"}
								</Button>
							</div>
						</CardHeader>
						<CardContent className="px-4 pb-4 space-y-4">
							{appealDraft ? (
								<div className="space-y-4">
									<div>
										<Label className="text-xs font-semibold">Statement of Facts (SOF)</Label>
										<Textarea
											rows={4}
											readOnly
											value={appealDraft.statementOfFacts}
											className="mt-1 text-xs font-mono bg-muted/20"
										/>
									</div>

									<div>
										<Label className="text-xs font-semibold">Grounds of Appeal (1,000 chars per ground)</Label>
										<div className="space-y-2 mt-1">
											{appealDraft.groundsOfAppeal.map((g: any) => (
												<div key={g.groundNumber} className="p-3 border rounded bg-muted/10 text-xs">
													<div className="flex justify-between items-center mb-1">
														<span className="font-bold text-primary">Ground {g.groundNumber}</span>
														<span className="text-[10px] text-muted-foreground">{g.groundText.length} / 1000 chars</span>
													</div>
													<p className="font-mono text-foreground leading-relaxed">{g.groundText}</p>
												</div>
											))}
										</div>
									</div>

									<div className="p-3 bg-muted/30 border rounded text-xs">
										<p className="font-semibold text-foreground">Relief Sought:</p>
										<p className="text-muted-foreground mt-0.5">{appealDraft.reliefSought}</p>
									</div>
								</div>
							) : (
								<div className="py-12 text-center text-xs text-muted-foreground">
									Click "Draft Form 35 Grounds" to generate an appeal packet for the Commissioner of Income Tax (Appeals).
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

