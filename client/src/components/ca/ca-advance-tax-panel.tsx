import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Calendar,
	Calculator,
	ExternalLink,
	Clock,
} from "lucide-react";

export function CAAdvanceTaxPanel() {
	const { toast } = useToast();

	const [financialYear, setFinancialYear] = useState("2024-25");
	const [estimatedGrossTax, setEstimatedGrossTax] = useState<number>(350000);
	const [estimatedTds, setEstimatedTds] = useState<number>(120000);
	const [q1Paid, setQ1Paid] = useState<number>(30000);
	const [q2Paid, setQ2Paid] = useState<number>(40000);
	const [q3Paid, setQ3Paid] = useState<number>(0);
	const [q4Paid, setQ4Paid] = useState<number>(0);

	const [report, setReport] = useState<any>(null);

	const calculateMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/tools/advance-tax/calculate", {
				financialYear,
				estimatedGrossTax,
				estimatedTdsTcs: estimatedTds,
				actualPayments: [
					{ installment: 1, datePaid: "2024-06-14", amount: q1Paid },
					{ installment: 2, datePaid: "2024-09-12", amount: q2Paid },
					{ installment: 3, datePaid: "2024-12-10", amount: q3Paid },
					{ installment: 4, datePaid: "2025-03-12", amount: q4Paid },
				].filter((p) => p.amount > 0),
			});
			return res.json();
		},
		onSuccess: (data) => {
			setReport(data.report);
			toast({
				title: "Advance Tax Simulated",
				description: `Assessed Tax: ₹${data.report.summary.assessedTax.toLocaleString("en-IN")}`,
			});
		},
		onError: (err: any) => {
			toast({
				title: "Simulation Failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="py-3 px-4">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<Calendar className="w-4 h-4 text-primary" /> Advance Tax Schedule & Section 234B/234C Simulator
							</CardTitle>
							<CardDescription className="text-xs">
								Simulates quarterly statutory installments (Sec 211) and penalty interest for deferment (Sec 234C) or default (Sec 234B).
							</CardDescription>
						</div>
						<Button
							size="sm"
							className="h-8 text-xs"
							disabled={calculateMutation.isPending}
							onClick={() => calculateMutation.mutate()}
						>
							<Calculator className="w-3.5 h-3.5 mr-1" />
							{calculateMutation.isPending ? "Simulating..." : "Calculate Schedule"}
						</Button>
					</div>
				</CardHeader>
				<CardContent className="px-4 pb-4 space-y-4">
					{/* Input Parameters */}
					<div className="grid grid-cols-3 gap-3">
						<div>
							<Label className="text-xs">Financial Year</Label>
							<Input
								value={financialYear}
								onChange={(e) => setFinancialYear(e.target.value)}
								className="h-8 text-xs mt-1"
							/>
						</div>
						<div>
							<Label className="text-xs">Estimated Gross Tax Liability (₹)</Label>
							<Input
								type="number"
								value={estimatedGrossTax}
								onChange={(e) => setEstimatedGrossTax(Number(e.target.value))}
								className="h-8 text-xs mt-1"
							/>
						</div>
						<div>
							<Label className="text-xs">Projected TDS / TCS Credit (₹)</Label>
							<Input
								type="number"
								value={estimatedTds}
								onChange={(e) => setEstimatedTds(Number(e.target.value))}
								className="h-8 text-xs mt-1"
							/>
						</div>
					</div>

					{/* Payments Recorded */}
					<div>
						<Label className="text-xs font-semibold">Advance Tax Payments Paid So Far</Label>
						<div className="grid grid-cols-4 gap-2 mt-1.5">
							<div>
								<Label className="text-[11px] text-muted-foreground">Q1 (by Jun 15)</Label>
								<Input
									type="number"
									value={q1Paid}
									onChange={(e) => setQ1Paid(Number(e.target.value))}
									className="h-7 text-xs mt-0.5"
								/>
							</div>
							<div>
								<Label className="text-[11px] text-muted-foreground">Q2 (by Sep 15)</Label>
								<Input
									type="number"
									value={q2Paid}
									onChange={(e) => setQ2Paid(Number(e.target.value))}
									className="h-7 text-xs mt-0.5"
								/>
							</div>
							<div>
								<Label className="text-[11px] text-muted-foreground">Q3 (by Dec 15)</Label>
								<Input
									type="number"
									value={q3Paid}
									onChange={(e) => setQ3Paid(Number(e.target.value))}
									className="h-7 text-xs mt-0.5"
								/>
							</div>
							<div>
								<Label className="text-[11px] text-muted-foreground">Q4 (by Mar 15)</Label>
								<Input
									type="number"
									value={q4Paid}
									onChange={(e) => setQ4Paid(Number(e.target.value))}
									className="h-7 text-xs mt-0.5"
								/>
							</div>
						</div>
					</div>

					{/* Results Summary */}
					{report && (
						<div className="space-y-4 pt-2">
							<Separator />

							<div className="grid grid-cols-4 gap-3">
								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Net Assessed Tax</p>
									<p className="text-base font-bold text-foreground">₹{report.summary.assessedTax.toLocaleString("en-IN")}</p>
									<p className="text-[10px] text-muted-foreground">Gross minus TDS credit</p>
								</Card>

								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Total Advance Tax Paid</p>
									<p className="text-base font-bold text-emerald-600">₹{report.summary.totalAdvanceTaxPaid.toLocaleString("en-IN")}</p>
									<p className="text-[10px] text-muted-foreground">{Math.round((report.summary.totalAdvanceTaxPaid / (report.summary.assessedTax || 1)) * 100)}% of liability</p>
								</Card>

								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Remaining Shortfall</p>
									<p className="text-base font-bold text-destructive">₹{report.summary.totalShortfall.toLocaleString("en-IN")}</p>
									<p className="text-[10px] text-muted-foreground">Due before March 15</p>
								</Card>

								<Card className="p-3 bg-muted/20 border">
									<p className="text-[11px] text-muted-foreground">Penal Interest (§ 234B/C)</p>
									<p className="text-base font-bold text-amber-600">
										₹{(report.summary.totalInterest234C + report.summary.totalInterest234B).toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-muted-foreground">234C: ₹{report.summary.totalInterest234C} | 234B: ₹{report.summary.totalInterest234B}</p>
								</Card>
							</div>

							{/* Quarterly Installment Breakdown */}
							<div className="border rounded-md overflow-hidden">
								<table className="w-full text-xs">
									<thead className="bg-muted font-medium">
										<tr>
											<th className="p-2 text-left">Installment & Due Date</th>
											<th className="p-2 text-center">Required %</th>
											<th className="p-2 text-right">Target (Cumulative)</th>
											<th className="p-2 text-right">Paid (Cumulative)</th>
											<th className="p-2 text-right">Shortfall</th>
											<th className="p-2 text-right">Sec 234C Interest</th>
											<th className="p-2 text-center">Status</th>
										</tr>
									</thead>
									<tbody className="divide-y">
										{report.schedule.map((item: any) => (
											<tr key={item.installmentNumber} className="hover:bg-muted/30">
												<td className="p-2">
													<p className="font-semibold">{item.quarterName}</p>
													<p className="text-[10px] text-muted-foreground flex items-center gap-1">
														<Clock className="w-3 h-3" /> Due: {item.dueDate}
													</p>
												</td>
												<td className="p-2 text-center font-mono">{item.statutoryPercentage}%</td>
												<td className="p-2 text-right font-medium">₹{item.cumulativeTargetAmount.toLocaleString("en-IN")}</td>
												<td className="p-2 text-right">₹{item.cumulativePaidAmount.toLocaleString("en-IN")}</td>
												<td className="p-2 text-right font-semibold text-destructive">
													{item.shortfall > 0 ? `₹${item.shortfall.toLocaleString("en-IN")}` : "Nil"}
												</td>
												<td className="p-2 text-right font-medium text-amber-600">
													{item.interestSec234C > 0 ? `₹${item.interestSec234C.toLocaleString("en-IN")}` : "₹0"}
												</td>
												<td className="p-2 text-center">
													<Badge
														variant={item.status === "PAID" ? "default" : "destructive"}
														className="text-[10px] py-0 px-2"
													>
														{item.status}
													</Badge>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Actions & Links */}
							<div className="flex items-center justify-between p-3 bg-primary/5 rounded border border-primary/20">
								<div>
									<p className="text-xs font-semibold text-primary">Ready to Pay Advance Tax Challan (ITNS 280)?</p>
									<p className="text-[11px] text-muted-foreground">
										Direct client to Income Tax e-Pay Tax service under Major Head 0021 / Minor Head 100.
									</p>
								</div>
								<a
									href={report.ePayTaxPaymentUrl}
									target="_blank"
									rel="noreferrer"
								>
									<Button size="sm" className="h-8 text-xs flex items-center gap-1.5">
										e-Pay Tax Portal <ExternalLink className="w-3.5 h-3.5" />
									</Button>
								</a>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

