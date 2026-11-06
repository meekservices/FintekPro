import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Building2,
	Copy,
} from "lucide-react";

export function CAMsmePanel() {
	const { toast } = useToast();

	const [financialYear, setFinancialYear] = useState("2024-25");
	const [report, setReport] = useState<any>(null);

	// Sample trade payables representing Micro, Small, Medium, and Trader entities
	const samplePayables = [
		{
			vendorName: "Precision Machine Tools (Micro)",
			vendorPan: "AABCP1122D",
			udyamRegistrationNumber: "UDYAM-MH-01-0012345",
			enterpriseCategory: "MICRO" as const,
			invoiceNumber: "PMT/24/098",
			invoiceDate: "2025-01-15", // Due Mar 1 (45 days)
			invoiceAmount: 240000,
			balanceOutstandingAsOfMarch31: 240000, // Unpaid on Mar 31 => DISALLOWED
			writtenAgreementExists: true,
			agreedPaymentDays: 45,
		},
		{
			vendorName: "Delta Industrial Spares (Small)",
			vendorPan: "AADCD9988E",
			udyamRegistrationNumber: "UDYAM-GJ-02-0056789",
			enterpriseCategory: "SMALL" as const,
			invoiceNumber: "DIS/2024/77",
			invoiceDate: "2025-03-05", // Due April 19 (45 days)
			invoiceAmount: 180000,
			balanceOutstandingAsOfMarch31: 180000, // Due in next FY => COMPLIANT
			writtenAgreementExists: true,
			agreedPaymentDays: 45,
		},
		{
			vendorName: "Global Steel Traders (Trader)",
			vendorPan: "AAECG4433F",
			udyamRegistrationNumber: "UDYAM-DL-03-0099887",
			enterpriseCategory: "TRADER" as const,
			invoiceNumber: "GST/4412",
			invoiceDate: "2024-12-10",
			invoiceAmount: 500000,
			balanceOutstandingAsOfMarch31: 500000, // Trader => EXEMPT from 43B(h)
			writtenAgreementExists: true,
			agreedPaymentDays: 45,
		},
	];

	const auditMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/msme/audit-43bh", {
				financialYear,
				payables: samplePayables,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setReport(data.report);
			toast({
				title: "MSME Audit Complete",
				description: `Disallowance: ₹${data.report.summary.totalDisallowedSec43Bh.toLocaleString("en-IN")}`,
			});
		},
		onError: (err: any) => {
			toast({ title: "Audit Failed", description: err.message, variant: "destructive" });
		},
	});

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="py-3 px-4">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<Building2 className="w-4 h-4 text-primary" /> Section 43B(h) MSME 45-Day Payment Disallowance Auditor
							</CardTitle>
							<CardDescription className="text-xs">
								Audits trade payables outstanding to Micro & Small enterprises to compute Form 3CD Clause 22 tax disallowance and Section 16 penal interest.
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Input
								value={financialYear}
								onChange={(e) => setFinancialYear(e.target.value)}
								placeholder="FY (e.g. 2024-25)"
								className="h-8 w-24 text-xs font-mono"
							/>
							<Button
								size="sm"
								className="h-8 text-xs flex items-center gap-1.5"
								disabled={auditMutation.isPending}
								onClick={() => auditMutation.mutate()}
							>
								{auditMutation.isPending ? "Auditing..." : "Run MSME Audit"}
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-4 pb-4 space-y-4">
					{report ? (
						<div className="space-y-4">
							{/* Summary Metric Cards */}
							<div className="grid grid-cols-4 gap-3">
								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Micro/Small Payables</p>
									<p className="text-base font-bold text-foreground">
										₹{report.summary.totalMicroSmallPayables.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-muted-foreground">Subject to 43B(h)</p>
								</Card>

								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Section 43B(h) Disallowed</p>
									<p className="text-base font-bold text-destructive">
										₹{report.summary.totalDisallowedSec43Bh.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-muted-foreground">Added back in Clause 22</p>
								</Card>

								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Exempt (Traders/Medium)</p>
									<p className="text-base font-bold text-emerald-600">
										₹{report.summary.totalMediumTraderExemptPayables.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-muted-foreground">Exempt per MSMED OM</p>
								</Card>

								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">MSME Penal Interest (Sec 16)</p>
									<p className="text-base font-bold text-amber-600">
										₹{report.summary.totalEstimatedInterestSec16.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-muted-foreground">3x Bank Rate (Compounded)</p>
								</Card>
							</div>

							{/* Vendor Ledger Breakdown Table */}
							<div className="border rounded-md overflow-hidden">
								<table className="w-full text-xs">
									<thead className="bg-muted font-medium">
										<tr>
											<th className="p-2 text-left">Vendor & Category</th>
											<th className="p-2 text-left">Invoice & Date</th>
											<th className="p-2 text-center">Statutory Due Date</th>
											<th className="p-2 text-right">Outstanding (31 Mar)</th>
											<th className="p-2 text-right">Disallowed u/s 43B(h)</th>
											<th className="p-2 text-center">Audit Status</th>
										</tr>
									</thead>
									<tbody className="divide-y">
										{report.items.map((item: any, idx: number) => (
											<tr key={idx} className="hover:bg-muted/30">
												<td className="p-2">
													<p className="font-semibold">{item.vendorName}</p>
													<Badge variant="outline" className="text-[10px] py-0 font-mono">
														{item.enterpriseCategory}
													</Badge>
												</td>
												<td className="p-2">
													<p className="font-mono">{item.invoiceNumber}</p>
													<p className="text-[10px] text-muted-foreground">{item.invoiceDate}</p>
												</td>
												<td className="p-2 text-center font-mono">
													{item.statutoryDueDate}
												</td>
												<td className="p-2 text-right font-medium">
													₹{item.outstandingAmount.toLocaleString("en-IN")}
												</td>
												<td className="p-2 text-right font-bold text-destructive">
													{item.isDisallowedSec43Bh ? `₹${item.disallowanceAmount.toLocaleString("en-IN")}` : "₹0"}
												</td>
												<td className="p-2 text-center">
													<Badge
														variant={item.isDisallowedSec43Bh ? "destructive" : "default"}
														className="text-[10px] py-0 px-2"
													>
														{item.isDisallowedSec43Bh ? "DISALLOWED" : "COMPLIANT"}
													</Badge>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Form 3CD Clause 22 Disclosure Output */}
							<div className="p-3 bg-muted/30 rounded border text-xs space-y-2">
								<div className="flex justify-between items-center">
									<p className="font-bold text-foreground">Form 3CD Clause 22 Official Disclosure</p>
									<Button
										size="sm"
										variant="secondary"
										className="h-6 text-[11px] flex items-center gap-1"
										onClick={() => {
											navigator.clipboard.writeText(report.form3CdClause22Text);
											toast({ title: "Copied", description: "Clause 22 disclosure copied to clipboard" });
										}}
									>
										<Copy className="w-3 h-3" /> Copy Disclosure
									</Button>
								</div>
								<Textarea
									rows={3}
									readOnly
									value={report.form3CdClause22Text}
									className="text-xs font-mono bg-background"
								/>
							</div>
						</div>
					) : (
						<div className="py-12 text-center text-xs text-muted-foreground">
							Click "Run MSME Audit" to calculate Section 43B(h) disallowance on year-end vendor payables.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

