import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
	FileText,
	Upload,
	TrendingUp,
	ShieldCheck,
	CheckCircle2,
	AlertCircle,
	IndianRupee,
	Percent,
	Calendar,
	Building2,
	ArrowUpRight,
	Clock,
} from "lucide-react";

interface CommissionSchedule {
	equityDeliveryPct?: number;
	equityIntradayPct?: number;
	fnoOptionsPct?: number;
	mutualFundsTrailPct?: number;
	bondsPct?: number;
	pmsPct?: number;
	insurancePct?: number;
}

interface AgreementRevenueData {
	agreementId: string;
	partnerId: string;
	agreementType: string;
	agreementStatus: string;
	documentHash: string;
	effectiveFrom: string;
	effectiveTo: string | null;
	totalTransactionVolume: number;
	totalGrossCommission: number;
	totalPartnerEarnings: number;
	totalPlatformRetention: number;
	estimatedTdsDeducted: number;
	netPayableToPartner: number;
	totalUniqueClients: number;
	totalTransactions: number;
	breakdownByInstrument: Array<{
		productType: string;
		grossVolume: number;
		grossCommission: number;
		partnerEarnings: number;
		platformRetention: number;
		transactionCount: number;
	}>;
	commissionSchedule: CommissionSchedule;
	lastUpdated: string;
}

export function PartnerAgreementManager({ partnerId }: { partnerId: string }) {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [isUploadOpen, setIsUploadOpen] = useState(false);
	const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);

	// Form State
	const [agreementType, setAgreementType] = useState<string>("SUB_BROKER");
	const [fileName, setFileName] = useState("");
	const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
	const [effectiveTo, setEffectiveTo] = useState("");
	const [eSignReference, setESignReference] = useState("");
	const [notes, setNotes] = useState("");

	// Commission Schedule State
	const [schedule, setSchedule] = useState<CommissionSchedule>({
		equityDeliveryPct: 60,
		equityIntradayPct: 60,
		fnoOptionsPct: 60,
		mutualFundsTrailPct: 70,
		bondsPct: 50,
		pmsPct: 60,
		insurancePct: 70,
	});

	// Query: Fetch agreements for partner
	const { data: agreementsData, isLoading: isLoadingAgreements } = useQuery<{
		success: boolean;
		data: any[];
	}>({
		queryKey: [`/api/partner/agreements/partner/${partnerId}`],
		enabled: !!partnerId,
	});

	const agreements = agreementsData?.data || [];
	const activeAgreement = agreements.find((a) => a.agreementStatus === "ACTIVE") || agreements[0];
	const currentViewAgreementId = selectedAgreementId || activeAgreement?.id;

	// Query: Revenue metrics for the active agreement
	const { data: revenueData, isLoading: isLoadingRevenue } = useQuery<{
		success: boolean;
		data: AgreementRevenueData;
	}>({
		queryKey: [`/api/partner/agreements/${currentViewAgreementId}/revenue`],
		enabled: !!currentViewAgreementId,
	});

	const revenueMetrics = revenueData?.data;

	// Mutation: Upload Agreement
	const uploadMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await fetch("/api/partner/agreements/upload", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Upload failed");
			}
			return res.json();
		},
		onSuccess: () => {
			toast({
				title: "Agreement Uploaded Successfully",
				description: "Agreement recorded with SHA-256 tamper-proof hash and queued for audit.",
			});
			setIsUploadOpen(false);
			queryClient.invalidateQueries({ queryKey: [`/api/partner/agreements/partner/${partnerId}`] });
		},
		onError: (err: any) => {
			toast({
				title: "Upload Failed",
				description: err.message || "Please verify agreement parameters.",
				variant: "destructive",
			});
		},
	});

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setFileName(file.name);
		}
	};

	const handleUploadSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!fileName) {
			toast({ title: "Document required", description: "Please specify or attach the agreement file.", variant: "destructive" });
			return;
		}

		uploadMutation.mutate({
			partnerId,
			agreementType,
			fileName,
			documentUrl: `https://storage.fintekpro.com/agreements/${partnerId}/${encodeURIComponent(fileName)}`,
			effectiveFrom,
			effectiveTo: effectiveTo || undefined,
			eSignReference: eSignReference || undefined,
			notes: notes || undefined,
			commissionSchedule: schedule,
			autoApprove: true,
		});
	};

	return (
		<div className="space-y-6">
			{/* Top Header Card */}
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border rounded-2xl p-6 shadow-sm">
				<div>
					<div className="flex items-center gap-2">
						<Building2 className="h-5 w-5 text-blue-600" />
						<h2 className="text-xl font-bold tracking-tight">Commercial Agreements & Revenue Tracking</h2>
						<Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950/40 border-blue-200">
							SEBI & AMFI Compliant
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground mt-1">
						Upload executed Sub-Broker / Distributor contracts, configure instrument commission sharing, and track cumulative realized revenue.
					</p>
				</div>
				<Button
					onClick={() => setIsUploadOpen(!isUploadOpen)}
					className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
				>
					<Upload className="h-4 w-4 mr-2" />
					{isUploadOpen ? "Close Upload Form" : "Upload New Agreement"}
				</Button>
			</div>

			{/* Upload Agreement Form Drawer / Card */}
			{isUploadOpen && (
				<Card className="border-blue-200 dark:border-blue-900 shadow-md">
					<CardHeader>
						<CardTitle className="text-lg flex items-center gap-2">
							<FileText className="h-5 w-5 text-blue-600" />
							Upload Executed Commercial Agreement
						</CardTitle>
						<CardDescription>
							Record contract details, set instrument-category revenue sharing ratios, and bind the agreement to real-time payouts.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleUploadSubmit} className="space-y-5">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div>
									<Label className="text-xs font-semibold">Agreement Type</Label>
									<select
										className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
										value={agreementType}
										onChange={(e) => setAgreementType(e.target.value)}
									>
										<option value="SUB_BROKER">Sub-Broker (Authorized Person AP Franchise)</option>
										<option value="DISTRIBUTOR">Financial Product Distributor (MF / Bonds / Insurance)</option>
										<option value="FRANCHISEE">Full Branch Franchisee Agreement</option>
										<option value="CORPORATE_B2B">Corporate B2B Distribution Partner</option>
										<option value="REFERRAL_AGENT">Referral Partner Agreement</option>
									</select>
								</div>

								<div>
									<Label className="text-xs font-semibold">Select Agreement Document</Label>
									<Input
										type="file"
										className="mt-1.5 cursor-pointer text-xs"
										accept=".pdf,.doc,.docx"
										onChange={handleFileSelect}
									/>
									{fileName && (
										<p className="text-[11px] text-muted-foreground mt-1 truncate">
											Selected: <strong>{fileName}</strong>
										</p>
									)}
								</div>

								<div>
									<Label className="text-xs font-semibold">Aadhaar / Digio e-Sign Reference</Label>
									<Input
										className="mt-1.5 text-xs"
										placeholder="e.g. DIGIO-ESIGN-849204"
										value={eSignReference}
										onChange={(e) => setESignReference(e.target.value)}
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<Label className="text-xs font-semibold">Effective Start Date</Label>
									<Input
										type="date"
										className="mt-1.5 text-xs"
										value={effectiveFrom}
										onChange={(e) => setEffectiveFrom(e.target.value)}
									/>
								</div>
								<div>
									<Label className="text-xs font-semibold">Effective End Date (Optional)</Label>
									<Input
										type="date"
										className="mt-1.5 text-xs"
										value={effectiveTo}
										onChange={(e) => setEffectiveTo(e.target.value)}
									/>
								</div>
							</div>

							<Separator />

							{/* Instrument Category Revenue Sharing Rates */}
							<div>
								<div className="flex items-center justify-between mb-3">
									<h4 className="text-sm font-semibold flex items-center gap-1.5">
										<Percent className="h-4 w-4 text-emerald-600" />
										Partner Commission Sharing Schedule (% Payout to Sub-Broker / Distributor)
									</h4>
									<span className="text-xs text-muted-foreground">Remaining % is retained by FintekPro</span>
								</div>

								<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
									<div className="bg-muted/40 p-2.5 rounded-lg border">
										<Label className="text-[11px] text-muted-foreground">Equity Delivery Share</Label>
										<div className="flex items-center gap-1 mt-1">
											<Input
												type="number"
												min={0}
												max={100}
												className="h-8 text-xs font-semibold"
												value={schedule.equityDeliveryPct}
												onChange={(e) => setSchedule({ ...schedule, equityDeliveryPct: Number(e.target.value) })}
											/>
											<span className="font-semibold">%</span>
										</div>
									</div>

									<div className="bg-muted/40 p-2.5 rounded-lg border">
										<Label className="text-[11px] text-muted-foreground">Equity Intraday Share</Label>
										<div className="flex items-center gap-1 mt-1">
											<Input
												type="number"
												min={0}
												max={100}
												className="h-8 text-xs font-semibold"
												value={schedule.equityIntradayPct}
												onChange={(e) => setSchedule({ ...schedule, equityIntradayPct: Number(e.target.value) })}
											/>
											<span className="font-semibold">%</span>
										</div>
									</div>

									<div className="bg-muted/40 p-2.5 rounded-lg border">
										<Label className="text-[11px] text-muted-foreground">F&O Options Share</Label>
										<div className="flex items-center gap-1 mt-1">
											<Input
												type="number"
												min={0}
												max={100}
												className="h-8 text-xs font-semibold"
												value={schedule.fnoOptionsPct}
												onChange={(e) => setSchedule({ ...schedule, fnoOptionsPct: Number(e.target.value) })}
											/>
											<span className="font-semibold">%</span>
										</div>
									</div>

									<div className="bg-muted/40 p-2.5 rounded-lg border">
										<Label className="text-[11px] text-muted-foreground">Mutual Funds Trail Share</Label>
										<div className="flex items-center gap-1 mt-1">
											<Input
												type="number"
												min={0}
												max={100}
												className="h-8 text-xs font-semibold"
												value={schedule.mutualFundsTrailPct}
												onChange={(e) => setSchedule({ ...schedule, mutualFundsTrailPct: Number(e.target.value) })}
											/>
											<span className="font-semibold">%</span>
										</div>
									</div>

									<div className="bg-muted/40 p-2.5 rounded-lg border">
										<Label className="text-[11px] text-muted-foreground">Bonds / NCDs Share</Label>
										<div className="flex items-center gap-1 mt-1">
											<Input
												type="number"
												min={0}
												max={100}
												className="h-8 text-xs font-semibold"
												value={schedule.bondsPct}
												onChange={(e) => setSchedule({ ...schedule, bondsPct: Number(e.target.value) })}
											/>
											<span className="font-semibold">%</span>
										</div>
									</div>

									<div className="bg-muted/40 p-2.5 rounded-lg border">
										<Label className="text-[11px] text-muted-foreground">PMS Distribution Share</Label>
										<div className="flex items-center gap-1 mt-1">
											<Input
												type="number"
												min={0}
												max={100}
												className="h-8 text-xs font-semibold"
												value={schedule.pmsPct}
												onChange={(e) => setSchedule({ ...schedule, pmsPct: Number(e.target.value) })}
											/>
											<span className="font-semibold">%</span>
										</div>
									</div>

									<div className="bg-muted/40 p-2.5 rounded-lg border">
										<Label className="text-[11px] text-muted-foreground">Insurance Commission</Label>
										<div className="flex items-center gap-1 mt-1">
											<Input
												type="number"
												min={0}
												max={100}
												className="h-8 text-xs font-semibold"
												value={schedule.insurancePct}
												onChange={(e) => setSchedule({ ...schedule, insurancePct: Number(e.target.value) })}
											/>
											<span className="font-semibold">%</span>
										</div>
									</div>
								</div>
							</div>

							<div className="flex justify-end gap-3 pt-2">
								<Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
									Cancel
								</Button>
								<Button
									type="submit"
									className="bg-emerald-600 hover:bg-emerald-700 text-white"
									disabled={uploadMutation.isPending}
								>
									{uploadMutation.isPending ? "Hashing & Uploading..." : "Upload & Activate Agreement"}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			)}

			{/* Revenue Tracking Cards */}
			{revenueMetrics && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-base font-bold flex items-center gap-2">
							<TrendingUp className="h-4 w-4 text-blue-600" />
							Real-Time Revenue Realized Under Agreement
							<Badge className="bg-green-600 text-white text-[11px]">
								{revenueMetrics.agreementType.replace(/_/g, " ")} • {revenueMetrics.agreementStatus}
							</Badge>
						</h3>
						<span className="text-xs text-muted-foreground flex items-center gap-1">
							<Clock className="h-3.5 w-3.5" />
							Updated: {new Date(revenueMetrics.lastUpdated).toLocaleTimeString()}
						</span>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
						<Card className="bg-muted/30">
							<CardContent className="p-4 space-y-1">
								<div className="text-[11px] text-muted-foreground font-medium">Gross Transaction Volume</div>
								<div className="text-lg font-extrabold text-foreground font-mono">
									₹{revenueMetrics.totalTransactionVolume.toLocaleString("en-IN")}
								</div>
								<div className="text-[10px] text-muted-foreground">{revenueMetrics.totalTransactions} Trades / Orders</div>
							</CardContent>
						</Card>

						<Card className="bg-muted/30">
							<CardContent className="p-4 space-y-1">
								<div className="text-[11px] text-muted-foreground font-medium">Total Commission Pool</div>
								<div className="text-lg font-extrabold text-blue-600 dark:text-blue-400 font-mono">
									₹{revenueMetrics.totalGrossCommission.toLocaleString("en-IN")}
								</div>
								<div className="text-[10px] text-muted-foreground">Gross Generated Pool</div>
							</CardContent>
						</Card>

						<Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200">
							<CardContent className="p-4 space-y-1">
								<div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">Partner Accrued Earnings</div>
								<div className="text-lg font-extrabold text-emerald-600 font-mono">
									₹{revenueMetrics.totalPartnerEarnings.toLocaleString("en-IN")}
								</div>
								<div className="text-[10px] text-emerald-600/80">Agreement Payout Share</div>
							</CardContent>
						</Card>

						<Card className="bg-muted/30">
							<CardContent className="p-4 space-y-1">
								<div className="text-[11px] text-muted-foreground font-medium">Platform Retention</div>
								<div className="text-lg font-extrabold text-foreground font-mono">
									₹{revenueMetrics.totalPlatformRetention.toLocaleString("en-IN")}
								</div>
								<div className="text-[10px] text-muted-foreground">FintekPro Clearing Share</div>
							</CardContent>
						</Card>

						<Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200">
							<CardContent className="p-4 space-y-1">
								<div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">TDS Deducted (5% u/s 194H)</div>
								<div className="text-lg font-extrabold text-amber-600 font-mono">
									₹{revenueMetrics.estimatedTdsDeducted.toLocaleString("en-IN")}
								</div>
								<div className="text-[10px] text-amber-700/80">Statutory Tax Withholding</div>
							</CardContent>
						</Card>

						<Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200">
							<CardContent className="p-4 space-y-1">
								<div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold">Net Payable to Partner</div>
								<div className="text-lg font-extrabold text-blue-600 font-mono">
									₹{revenueMetrics.netPayableToPartner.toLocaleString("en-IN")}
								</div>
								<div className="text-[10px] text-blue-700/80">Disbursed on 10th of Month</div>
							</CardContent>
						</Card>
					</div>

					{/* Instrument-Wise Breakdown Table */}
					<Card>
						<CardHeader className="py-4">
							<CardTitle className="text-sm font-bold flex items-center justify-between">
								<span>Instrument Category Revenue Breakdown</span>
								<span className="text-xs font-normal text-muted-foreground">
									{revenueMetrics.breakdownByInstrument.length} Instrument Types Active
								</span>
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<div className="overflow-x-auto">
								<table className="w-full text-xs">
									<thead>
										<tr className="border-b bg-muted/30 text-muted-foreground">
											<th className="text-left py-2 px-3 font-semibold">Instrument Category</th>
											<th className="text-right py-2 px-3 font-semibold">Order Count</th>
											<th className="text-right py-2 px-3 font-semibold">Turnover / Volume</th>
											<th className="text-right py-2 px-3 font-semibold">Gross Commission</th>
											<th className="text-right py-2 px-3 font-semibold text-emerald-600">Partner Earnings</th>
											<th className="text-right py-2 px-3 font-semibold">Platform Retention</th>
										</tr>
									</thead>
									<tbody>
										{revenueMetrics.breakdownByInstrument.map((inst) => (
											<tr key={inst.productType} className="border-b hover:bg-muted/20">
												<td className="py-2.5 px-3 font-medium capitalize">
													{inst.productType.replace(/_/g, " ")}
												</td>
												<td className="py-2.5 px-3 text-right font-mono">{inst.transactionCount}</td>
												<td className="py-2.5 px-3 text-right font-mono">₹{inst.grossVolume.toLocaleString("en-IN")}</td>
												<td className="py-2.5 px-3 text-right font-mono">₹{inst.grossCommission.toLocaleString("en-IN")}</td>
												<td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
													₹{inst.partnerEarnings.toLocaleString("en-IN")}
												</td>
												<td className="py-2.5 px-3 text-right font-mono">₹{inst.platformRetention.toLocaleString("en-IN")}</td>
											</tr>
										))}
										{revenueMetrics.breakdownByInstrument.length === 0 && (
											<tr>
												<td colSpan={6} className="text-center py-6 text-muted-foreground">
													No transactions recorded under this agreement yet. Orders will automatically reflect here in real-time.
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>

					{/* Cryptographic SHA-256 Audit Box */}
					<div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground flex flex-col md:flex-row items-start md:items-center justify-between gap-2 border border-border/80">
						<div className="flex items-center gap-2">
							<ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
							<span>
								<strong>Non-Repudiation Audit Hash (SHA-256):</strong>{" "}
								<span className="font-mono text-[11px] text-foreground select-all">{revenueMetrics.documentHash}</span>
							</span>
						</div>
						<div className="text-[11px]">
							Effective: {new Date(revenueMetrics.effectiveFrom).toLocaleDateString()} {revenueMetrics.effectiveTo ? `to ${new Date(revenueMetrics.effectiveTo).toLocaleDateString()}` : "(Perpetual)"}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
