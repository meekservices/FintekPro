import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Receipt,
	AlertTriangle,
	RefreshCw,
} from "lucide-react";

export function CAGstPanel() {
	const { toast } = useToast();

	const [returnPeriod, setReturnPeriod] = useState("102024");
	const [report, setReport] = useState<any>(null);

	// Sample Purchase Register Invoices
	const samplePurchaseInvoices = [
		{
			supplierGstin: "27AABCU9603R1ZM",
			supplierName: "Tech Cloud India Pvt Ltd",
			invoiceNumber: "INV-2024-101",
			invoiceDate: "2024-10-04",
			taxableValue: 150000,
			igst: 27000,
			cgst: 0,
			sgst: 0,
			totalTax: 27000,
		},
		{
			supplierGstin: "27AAACW1234F1Z5",
			supplierName: "Apex Logistics & Courier",
			invoiceNumber: "ALC/884",
			invoiceDate: "2024-10-12",
			taxableValue: 50000,
			igst: 0,
			cgst: 4500,
			sgst: 4500,
			totalTax: 9000,
		},
		{
			supplierGstin: "29AABCS5544K1ZZ",
			supplierName: "Karnataka Hardware Mart",
			invoiceNumber: "KHM-9912",
			invoiceDate: "2024-10-18",
			taxableValue: 80000,
			igst: 14400,
			cgst: 0,
			sgst: 0,
			totalTax: 14400,
		},
	];

	// Sample GSTR-2B Invoices (Simulating 1 match, 1 mismatch, 1 missing in 2B)
	const sampleGstr2bInvoices = [
		{
			supplierGstin: "27AABCU9603R1ZM",
			supplierName: "Tech Cloud India Pvt Ltd",
			invoiceNumber: "INV-2024-101",
			invoiceDate: "2024-10-04",
			taxableValue: 150000,
			igst: 27000,
			cgst: 0,
			sgst: 0,
			totalTax: 27000,
			filingDate: "2024-11-10",
			itcEligibility: "Y" as const,
		},
		{
			supplierGstin: "27AAACW1234F1Z5",
			supplierName: "Apex Logistics & Courier",
			invoiceNumber: "ALC/884",
			invoiceDate: "2024-10-12",
			taxableValue: 50000,
			igst: 0,
			cgst: 2500, // Supplier filed 5% instead of 18%
			sgst: 2500,
			totalTax: 5000,
			filingDate: "2024-11-11",
			itcEligibility: "Y" as const,
		},
	];

	const reconcileMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/gst/reconcile-2b", {
				returnPeriod,
				purchaseInvoices: samplePurchaseInvoices,
				gstr2bInvoices: sampleGstr2bInvoices,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setReport(data.report);
			toast({
				title: "GSTR-2B Reconciled",
				description: `Matched: ${data.report.summary.matchedCount} | Blocked ITC: ₹${data.report.summary.totalBlockedItc.toLocaleString("en-IN")}`,
			});
		},
		onError: (err: any) => {
			toast({ title: "Reconciliation Failed", description: err.message, variant: "destructive" });
		},
	});

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="py-3 px-4">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<Receipt className="w-4 h-4 text-primary" /> GSTR-2B vs. Purchase Register 3-Way Reconciler
							</CardTitle>
							<CardDescription className="text-xs">
								Automates Rule 36(4) / Section 16(2)(aa) ITC matching and suggests GSTN Invoice Management System (IMS) actions.
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Input
								value={returnPeriod}
								onChange={(e) => setReturnPeriod(e.target.value)}
								placeholder="MMYYYY (e.g. 102024)"
								className="h-8 w-28 text-xs font-mono"
							/>
							<Button
								size="sm"
								className="h-8 text-xs flex items-center gap-1.5"
								disabled={reconcileMutation.isPending}
								onClick={() => reconcileMutation.mutate()}
							>
								<RefreshCw className={`w-3.5 h-3.5 ${reconcileMutation.isPending ? "animate-spin" : ""}`} />
								{reconcileMutation.isPending ? "Matching..." : "Run 3-Way Match"}
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-4 pb-4 space-y-4">
					{report ? (
						<div className="space-y-4">
							{/* Summary Cards */}
							<div className="grid grid-cols-4 gap-3">
								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Book Purchase Tax</p>
									<p className="text-base font-bold text-foreground">
										₹{report.summary.totalBookTax.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-muted-foreground">Recorded in Client Books</p>
								</Card>

								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Eligible ITC (Sec 16)</p>
									<p className="text-base font-bold text-emerald-600">
										₹{report.summary.totalEligibleItc.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-muted-foreground">{report.summary.matchedCount} invoices fully matched</p>
								</Card>

								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Blocked ITC (Rule 36(4))</p>
									<p className="text-base font-bold text-destructive">
										₹{report.summary.totalBlockedItc.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-muted-foreground">Missing in 2B or Rate Mismatch</p>
								</Card>

								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">IMS Recommended Action</p>
									<p className="text-base font-bold text-primary">
										{report.imsSubmissionPayload.acceptedInvoicesCount} Accept / {report.imsSubmissionPayload.rejectedInvoicesCount} Reject
									</p>
									<p className="text-[10px] text-muted-foreground">{report.imsSubmissionPayload.pendingInvoicesCount} Pending vendor check</p>
								</Card>
							</div>

							{/* Discrepancy Table */}
							<div className="border rounded-md overflow-hidden">
								<table className="w-full text-xs">
									<thead className="bg-muted font-medium">
										<tr>
											<th className="p-2 text-left">Supplier & Invoice</th>
											<th className="p-2 text-right">Book Tax</th>
											<th className="p-2 text-right">GSTR-2B Tax</th>
											<th className="p-2 text-right">Tax Variance</th>
											<th className="p-2 text-center">Rule 36(4) Status</th>
											<th className="p-2 text-center">IMS Action</th>
											<th className="p-2 text-left">Actionable Note</th>
										</tr>
									</thead>
									<tbody className="divide-y">
										{report.discrepancies.map((d: any, idx: number) => (
											<tr key={idx} className="hover:bg-muted/30">
												<td className="p-2">
													<p className="font-semibold">{d.supplierName}</p>
													<p className="text-[10px] text-muted-foreground font-mono">{d.supplierGstin} | #{d.invoiceNumber}</p>
												</td>
												<td className="p-2 text-right font-medium">₹{d.bookTax.toLocaleString("en-IN")}</td>
												<td className="p-2 text-right">₹{d.gstr2bTax.toLocaleString("en-IN")}</td>
												<td className={`p-2 text-right font-semibold ${d.variance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
													₹{d.variance.toLocaleString("en-IN")}
												</td>
												<td className="p-2 text-center">
													<Badge
														variant={d.itcStatus === "ELIGIBLE" ? "default" : "destructive"}
														className="text-[10px] py-0 px-1.5"
													>
														{d.itcStatus}
													</Badge>
												</td>
												<td className="p-2 text-center">
													<Badge
														variant={d.suggestedImsAction === "ACCEPT" ? "outline" : d.suggestedImsAction === "REJECT" ? "destructive" : "secondary"}
														className="text-[10px] py-0 px-1.5 font-bold"
													>
														{d.suggestedImsAction}
													</Badge>
												</td>
												<td className="p-2 text-[11px] text-muted-foreground max-w-xs">
													{d.supplierActionNote}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Compliance Alerts */}
							<div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg text-xs space-y-1">
								<p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
									<AlertTriangle className="w-4 h-4 text-amber-600" /> Statutory Input Tax Credit Notice
								</p>
								{report.complianceAdvice.map((a: string, i: number) => (
									<p key={i} className="text-amber-800/90 dark:text-amber-300/90 text-[11px]">
										• {a}
									</p>
								))}
							</div>
						</div>
					) : (
						<div className="py-12 text-center text-xs text-muted-foreground">
							Click "Run 3-Way Match" to ingest and cross-reference purchase register invoices with GSTN GSTR-2B data.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

