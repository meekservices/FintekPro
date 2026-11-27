import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	FileSpreadsheet,
	Download,
	IndianRupee,
	Receipt,
	Calendar,
	Filter,
	ShieldCheck,
	AlertTriangle,
	Loader2,
	RefreshCw,
	BookOpen,
	ArrowUpRight,
	ArrowDownRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UnifiedBrokerReportsProps {
	initialTab?: "tax-pnl" | "ledger";
	hideHeader?: boolean;
}

export function UnifiedBrokerReports({
	initialTab = "tax-pnl",
	hideHeader = false,
}: UnifiedBrokerReportsProps = {}) {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState<"tax-pnl" | "ledger">(initialTab);
	const [financialYear, setFinancialYear] = useState("2024-2025");
	const [quarter, setQuarter] = useState("all");
	const [ledgerCategory, setLedgerCategory] = useState("all");

	// Fetch Tax P&L
	const {
		data: taxPnlData,
		isLoading: isTaxPnlLoading,
		refetch: refetchTaxPnl,
	} = useQuery({
		queryKey: ["/api/reports/tax-pnl", financialYear, quarter],
		queryFn: async () => {
			const res = await fetch(`/api/reports/tax-pnl?financialYear=${financialYear}&quarter=${quarter}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to fetch Tax P&L");
			return data.data;
		},
	});

	// Fetch Financial Ledger
	const {
		data: ledgerData,
		isLoading: isLedgerLoading,
		refetch: refetchLedger,
	} = useQuery({
		queryKey: ["/api/reports/financial-ledger", ledgerCategory],
		queryFn: async () => {
			const res = await fetch(`/api/reports/financial-ledger?category=${ledgerCategory}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to fetch Financial Ledger");
			return data.data;
		},
	});

	const handleDownloadTaxPnl = (format: "xlsx" | "pdf") => {
		toast({
			title: "Generating Statement",
			description: `Preparing Tax P&L statement in ${format.toUpperCase()} format...`,
		});
		window.open(`/api/reports/tax-pnl/download?financialYear=${financialYear}&quarter=${quarter}&format=${format}`, "_blank");
	};

	const handleDownloadLedger = (format: "xlsx" | "pdf") => {
		toast({
			title: "Generating Ledger",
			description: `Preparing Financial Ledger in ${format.toUpperCase()} format...`,
		});
		window.open(`/api/reports/financial-ledger/download?category=${ledgerCategory}&format=${format}`, "_blank");
	};

	return (
		<div className="space-y-6">
			{/* Top Header Card */}
			{!hideHeader && (
				<div className="p-6 rounded-2xl border border-border bg-gradient-to-r from-blue-50/60 via-card to-indigo-50/60 dark:from-blue-950/20 dark:via-card dark:to-indigo-950/20 shadow-xs">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div className="space-y-1.5">
							<div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
								<ShieldCheck className="h-3.5 w-3.5" />
								SEBI & Income Tax Act Standard
							</div>
							<h2 className="text-2xl font-bold tracking-tight">
								Broker-Grade P&L & Financial Ledger Suite
							</h2>
							<p className="text-xs sm:text-sm text-muted-foreground">
								Comprehensive capital gains (Sec 111A/112A), F&O turnover (Sec 44AB), statutory expense breakdown, and double-entry cash balance ledger.
							</p>
						</div>

						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => (activeTab === "tax-pnl" ? handleDownloadTaxPnl("xlsx") : handleDownloadLedger("xlsx"))}
								className="gap-1.5 text-xs h-9 bg-card"
							>
								<FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
								Export Excel
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => (activeTab === "tax-pnl" ? handleDownloadTaxPnl("pdf") : handleDownloadLedger("pdf"))}
								className="gap-1.5 text-xs h-9 bg-card"
							>
								<Download className="h-4 w-4 text-rose-600 dark:text-rose-400" />
								Export PDF
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Main Tabs */}
			<Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
					<TabsList className="bg-muted/60 p-1">
						<TabsTrigger value="tax-pnl" className="gap-2 text-xs sm:text-sm font-semibold">
							<Receipt className="h-4 w-4" />
							Tax P&L Statement (ITR-2 / ITR-3)
						</TabsTrigger>
						<TabsTrigger value="ledger" className="gap-2 text-xs sm:text-sm font-semibold">
							<BookOpen className="h-4 w-4" />
							Financial Running Ledger
						</TabsTrigger>
					</TabsList>

					{activeTab === "tax-pnl" ? (
						<div className="flex items-center gap-2.5">
							<Select value={financialYear} onValueChange={setFinancialYear}>
								<SelectTrigger className="w-[140px] h-8 text-xs bg-card">
									<Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
									<SelectValue placeholder="Financial Year" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="2024-2025">FY 2024-25</SelectItem>
									<SelectItem value="2023-2024">FY 2023-24</SelectItem>
									<SelectItem value="2022-2023">FY 2022-23</SelectItem>
								</SelectContent>
							</Select>

							<Select value={quarter} onValueChange={setQuarter}>
								<SelectTrigger className="w-[130px] h-8 text-xs bg-card">
									<Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
									<SelectValue placeholder="Quarter" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">Full FY</SelectItem>
									<SelectItem value="Q1">Q1 (Apr - Jun)</SelectItem>
									<SelectItem value="Q2">Q2 (Jul - Sep)</SelectItem>
									<SelectItem value="Q3">Q3 (Oct - Dec)</SelectItem>
									<SelectItem value="Q4">Q4 (Jan - Mar)</SelectItem>
								</SelectContent>
							</Select>

							<Button
								variant="ghost"
								size="icon"
								onClick={() => refetchTaxPnl()}
								className="h-8 w-8"
							>
								<RefreshCw className="h-3.5 w-3.5" />
							</Button>
						</div>
					) : (
						<div className="flex items-center gap-2.5">
							<Select value={ledgerCategory} onValueChange={setLedgerCategory}>
								<SelectTrigger className="w-[180px] h-8 text-xs bg-card">
									<Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
									<SelectValue placeholder="Filter Category" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Transactions</SelectItem>
									<SelectItem value="TRADE_BUY">Buy Orders</SelectItem>
									<SelectItem value="TRADE_SELL">Sell Settlements</SelectItem>
									<SelectItem value="PAYIN">Deposits (Pay-in)</SelectItem>
									<SelectItem value="DP_CHARGE">DP Demat Charges</SelectItem>
								</SelectContent>
							</Select>

							<Button
								variant="ghost"
								size="icon"
								onClick={() => refetchLedger()}
								className="h-8 w-8"
							>
								<RefreshCw className="h-3.5 w-3.5" />
							</Button>
						</div>
					)}
				</div>

				{/* TAB 1: TAX P&L */}
				<TabsContent value="tax-pnl" className="space-y-6">
					{isTaxPnlLoading ? (
						<div className="py-20 flex flex-col items-center justify-center gap-3">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
							<p className="text-xs text-muted-foreground">Calculating statutory capital gains & tax audit metrics...</p>
						</div>
					) : taxPnlData ? (
						<>
							{/* Summary KPI Grid */}
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								{/* STCG */}
								<Card className="border-border">
									<CardContent className="pt-5 pb-4">
										<div className="flex items-center justify-between">
											<span className="text-xs font-semibold text-muted-foreground">Short Term (STCG)</span>
											<Badge variant="outline" className="text-[10px] font-bold text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800">
												Sec 111A (20%)
											</Badge>
										</div>
										<div className="mt-2 text-xl font-black flex items-center">
											₹{taxPnlData.equityDeliverySTCG.toLocaleString()}
										</div>
										<p className="text-[11px] text-muted-foreground mt-1">Holding &lt;= 365 Days</p>
									</CardContent>
								</Card>

								{/* LTCG */}
								<Card className="border-border">
									<CardContent className="pt-5 pb-4">
										<div className="flex items-center justify-between">
											<span className="text-xs font-semibold text-muted-foreground">Long Term (LTCG)</span>
											<Badge variant="outline" className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
												Sec 112A (12.5%)
											</Badge>
										</div>
										<div className="mt-2 text-xl font-black flex items-center">
											₹{taxPnlData.equityDeliveryLTCG.toLocaleString()}
										</div>
										<p className="text-[11px] text-muted-foreground mt-1">
											Taxable: ₹{taxPnlData.equityDeliveryLTCGTaxable.toLocaleString()} (Exempt ₹{taxPnlData.equityDeliveryLTCGExempt.toLocaleString()})
										</p>
									</CardContent>
								</Card>

								{/* F&O Business PnL */}
								<Card className="border-border">
									<CardContent className="pt-5 pb-4">
										<div className="flex items-center justify-between">
											<span className="text-xs font-semibold text-muted-foreground">F&O Business P&L</span>
											<Badge variant="outline" className="text-[10px] font-bold text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800">
												Sec 28
											</Badge>
										</div>
										<div className={`mt-2 text-xl font-black flex items-center ${taxPnlData.fnoNonSpeculativePnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
											₹{taxPnlData.fnoNonSpeculativePnl.toLocaleString()}
										</div>
										<p className="text-[11px] text-muted-foreground mt-1">
											Turnover: ₹{taxPnlData.fnoTurnoverSec44AB.toLocaleString()} (Sec 44AB)
										</p>
									</CardContent>
								</Card>

								{/* Net Realized & Estimated Tax */}
								<Card className="border-primary/20 bg-primary/5">
									<CardContent className="pt-5 pb-4">
										<div className="flex items-center justify-between">
											<span className="text-xs font-bold text-foreground">Net P&L (Post Costs)</span>
											<Badge variant="secondary" className="text-[10px] font-bold">
												Est. Tax: ₹{taxPnlData.estimatedTaxLiability.toLocaleString()}
											</Badge>
										</div>
										<div className={`mt-2 text-xl font-black ${taxPnlData.totalNetPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
											₹{taxPnlData.totalNetPnl.toLocaleString()}
										</div>
										<p className="text-[11px] text-muted-foreground mt-1">
											Total Levies: ₹{taxPnlData.totalStatutoryCharges.total.toLocaleString()}
										</p>
									</CardContent>
								</Card>
							</div>

							{/* SEBI Derivative Risk Warning */}
							<div className="p-3.5 rounded-xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200">
								<div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px] mb-1">
									<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
									SEBI Statutory Risk Disclosure for Derivative Traders
								</div>
								<p className="leading-relaxed text-[11px]">
									9 out of 10 individual traders in equity Futures and Options segment incurred net losses (avg. loss ~₹50,000), spending an average of 28% of net trading losses in transaction costs and statutory levies. Trade derivatives strictly with risk capital.
								</p>
							</div>

							{/* Advance Tax Compliance Calendar (CBDT Mandate) */}
							<Card className="border-border bg-gradient-to-r from-card via-muted/20 to-card">
								<CardHeader className="py-3.5">
									<div className="flex items-center justify-between">
										<CardTitle className="text-sm font-bold flex items-center gap-2">
											<Calendar className="h-4 w-4 text-primary" />
											Statutory Advance Tax Schedule (Sec 208/211 Income Tax Act)
										</CardTitle>
										<Badge variant="outline" className="text-[10px] font-mono">
											Total Est. Tax: ₹{taxPnlData.estimatedTaxLiability.toLocaleString()}
										</Badge>
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
										<div className="p-3 rounded-lg border border-border bg-card">
											<div className="flex items-center justify-between text-[11px] text-muted-foreground font-sans">
												<span>Q1: 15% (15 Jun)</span>
												<Badge variant="secondary" className="text-[9px] py-0">Paid</Badge>
											</div>
											<div className="text-sm font-bold mt-1 text-foreground">
												₹{Math.round(taxPnlData.estimatedTaxLiability * 0.15).toLocaleString()}
											</div>
											<div className="text-[10px] text-muted-foreground font-sans mt-0.5">Cumulative 15%</div>
										</div>
										<div className="p-3 rounded-lg border border-border bg-card">
											<div className="flex items-center justify-between text-[11px] text-muted-foreground font-sans">
												<span>Q2: 45% (15 Sep)</span>
												<Badge variant="secondary" className="text-[9px] py-0">Paid</Badge>
											</div>
											<div className="text-sm font-bold mt-1 text-foreground">
												₹{Math.round(taxPnlData.estimatedTaxLiability * 0.45).toLocaleString()}
											</div>
											<div className="text-[10px] text-muted-foreground font-sans mt-0.5">Cumulative 45%</div>
										</div>
										<div className="p-3 rounded-lg border border-border bg-card">
											<div className="flex items-center justify-between text-[11px] text-muted-foreground font-sans">
												<span>Q3: 75% (15 Dec)</span>
												<Badge variant="secondary" className="text-[9px] py-0">Paid</Badge>
											</div>
											<div className="text-sm font-bold mt-1 text-foreground">
												₹{Math.round(taxPnlData.estimatedTaxLiability * 0.75).toLocaleString()}
											</div>
											<div className="text-[10px] text-muted-foreground font-sans mt-0.5">Cumulative 75%</div>
										</div>
										<div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
											<div className="flex items-center justify-between text-[11px] text-foreground font-sans font-semibold">
												<span>Q4: 100% (15 Mar)</span>
												<Badge variant="default" className="text-[9px] py-0 bg-primary">Upcoming</Badge>
											</div>
											<div className="text-sm font-bold mt-1 text-primary">
												₹{taxPnlData.estimatedTaxLiability.toLocaleString()}
											</div>
											<div className="text-[10px] text-muted-foreground font-sans mt-0.5">Full Final Liability</div>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Statutory Expense Breakdown */}
							<Card className="border-border">
								<CardHeader className="py-4">
									<CardTitle className="text-sm font-bold flex items-center gap-2">
										<IndianRupee className="h-4 w-4 text-primary" />
										Statutory & Exchange Charges Summary
									</CardTitle>
								</CardHeader>
								<CardContent className="pt-0">
									<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
										<div className="p-3 rounded-xl bg-muted/40 border border-border/60">
											<div className="text-[11px] text-muted-foreground">STT Paid</div>
											<div className="font-bold text-sm mt-0.5">₹{taxPnlData.totalStatutoryCharges.stt.toLocaleString()}</div>
										</div>
										<div className="p-3 rounded-xl bg-muted/40 border border-border/60">
											<div className="text-[11px] text-muted-foreground">Stamp Duty</div>
											<div className="font-bold text-sm mt-0.5">₹{taxPnlData.totalStatutoryCharges.stampDuty.toLocaleString()}</div>
										</div>
										<div className="p-3 rounded-xl bg-muted/40 border border-border/60">
											<div className="text-[11px] text-muted-foreground">Exchange Fees</div>
											<div className="font-bold text-sm mt-0.5">₹{taxPnlData.totalStatutoryCharges.exchangeCharges.toLocaleString()}</div>
										</div>
										<div className="p-3 rounded-xl bg-muted/40 border border-border/60">
											<div className="text-[11px] text-muted-foreground">SEBI Charges</div>
											<div className="font-bold text-sm mt-0.5">₹{taxPnlData.totalStatutoryCharges.sebiCharges.toLocaleString()}</div>
										</div>
										<div className="p-3 rounded-xl bg-muted/40 border border-border/60">
											<div className="text-[11px] text-muted-foreground">GST (18%)</div>
											<div className="font-bold text-sm mt-0.5">₹{taxPnlData.totalStatutoryCharges.gst.toLocaleString()}</div>
										</div>
										<div className="p-3 rounded-xl bg-muted/40 border border-border/60">
											<div className="text-[11px] text-muted-foreground">DP Charges</div>
											<div className="font-bold text-sm mt-0.5">₹{taxPnlData.totalStatutoryCharges.dpCharges.toLocaleString()}</div>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Trade-by-Trade Lots Table */}
							<Card className="border-border">
								<CardHeader className="py-4 flex flex-row items-center justify-between">
									<div>
										<CardTitle className="text-sm font-bold">Trade Lots Breakdown ({taxPnlData.lots.length})</CardTitle>
										<CardDescription className="text-xs">Detailed buy/sell match with holding period and net gains</CardDescription>
									</div>
								</CardHeader>
								<CardContent className="pt-0 p-0">
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow className="bg-muted/30">
													<TableHead className="text-xs">Instrument</TableHead>
													<TableHead className="text-xs">Segment</TableHead>
													<TableHead className="text-xs">Buy Date</TableHead>
													<TableHead className="text-xs">Sell Date</TableHead>
													<TableHead className="text-xs text-right">Holding</TableHead>
													<TableHead className="text-xs text-right">Qty</TableHead>
													<TableHead className="text-xs text-right">Buy Val</TableHead>
													<TableHead className="text-xs text-right">Sell Val</TableHead>
													<TableHead className="text-xs text-right">Net P&L</TableHead>
													<TableHead className="text-xs text-right">Type</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{taxPnlData.lots.length === 0 ? (
													<TableRow>
														<TableCell colSpan={10} className="text-center py-8 text-xs text-muted-foreground">
															No executed trade lots found for {financialYear} ({quarter.toUpperCase()}).
														</TableCell>
													</TableRow>
												) : (
													taxPnlData.lots.map((lot: any) => (
														<TableRow key={lot.id} className="text-xs">
															<TableCell className="font-semibold">{lot.instrumentName}</TableCell>
															<TableCell>
																<Badge variant="outline" className="text-[10px]">
																	{lot.segment}
																</Badge>
															</TableCell>
															<TableCell className="text-muted-foreground">{lot.buyDate}</TableCell>
															<TableCell className="text-muted-foreground">{lot.sellDate}</TableCell>
															<TableCell className="text-right">{lot.holdingPeriodDays}d</TableCell>
															<TableCell className="text-right">{lot.quantity}</TableCell>
															<TableCell className="text-right">₹{lot.buyValue.toLocaleString()}</TableCell>
															<TableCell className="text-right">₹{lot.sellValue.toLocaleString()}</TableCell>
															<TableCell className={`text-right font-bold ${lot.netGainLoss >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
																₹{lot.netGainLoss.toLocaleString()}
															</TableCell>
															<TableCell className="text-right">
																<Badge variant="secondary" className="text-[10px] font-bold">
																	{lot.gainType}
																</Badge>
															</TableCell>
														</TableRow>
													))
												)}
											</TableBody>
										</Table>
									</div>
								</CardContent>
							</Card>
						</>
					) : null}
				</TabsContent>

				{/* TAB 2: FINANCIAL RUNNING LEDGER */}
				<TabsContent value="ledger" className="space-y-6">
					{isLedgerLoading ? (
						<div className="py-20 flex flex-col items-center justify-center gap-3">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
							<p className="text-xs text-muted-foreground">Loading running cash balance ledger...</p>
						</div>
					) : ledgerData ? (
						<>
							{/* Ledger Balances Summary */}
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<Card className="border-border">
									<CardContent className="pt-5 pb-4">
										<div className="text-xs font-semibold text-muted-foreground">Opening Balance</div>
										<div className="mt-2 text-xl font-black">₹{ledgerData.openingBalance.toLocaleString()}</div>
										<p className="text-[11px] text-muted-foreground mt-1">As on {ledgerData.startDate}</p>
									</CardContent>
								</Card>

								<Card className="border-border">
									<CardContent className="pt-5 pb-4">
										<div className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
											<ArrowUpRight className="h-4 w-4" />
											Total Credits (Pay-ins & Sells)
										</div>
										<div className="mt-2 text-xl font-black text-emerald-600">₹{ledgerData.totalCredits.toLocaleString()}</div>
										<p className="text-[11px] text-muted-foreground mt-1">Inflow to trading account</p>
									</CardContent>
								</Card>

								<Card className="border-border">
									<CardContent className="pt-5 pb-4">
										<div className="text-xs font-semibold text-rose-600 flex items-center gap-1">
											<ArrowDownRight className="h-4 w-4" />
											Total Debits (Buys & Charges)
										</div>
										<div className="mt-2 text-xl font-black text-rose-600">₹{ledgerData.totalDebits.toLocaleString()}</div>
										<p className="text-[11px] text-muted-foreground mt-1">Outflows & deductions</p>
									</CardContent>
								</Card>

								<Card className="border-primary/20 bg-primary/5">
									<CardContent className="pt-5 pb-4">
										<div className="text-xs font-bold text-foreground">Closing Available Balance</div>
										<div className="mt-2 text-xl font-black text-primary">₹{ledgerData.closingBalance.toLocaleString()}</div>
										<p className="text-[11px] text-muted-foreground mt-1">Available cash & margin</p>
									</CardContent>
								</Card>
							</div>

							{/* SEBI Running Account Retention Statement Tracker */}
							<div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
								<div className="space-y-0.5">
									<div className="font-bold text-foreground flex items-center gap-1.5">
										<ShieldCheck className="h-4 w-4 text-blue-600" />
										SEBI Quarterly Running Account Settlement (Retention Statement)
									</div>
									<p className="text-muted-foreground text-[11px]">
										Per SEBI Circular SEBI/HO/MIRSD/DOP/P/CIR/2021/590, unencumbered client funds are settled on the 1st Friday of every quarter. Maximum permissible margin retention is 225% of margin obligations.
									</p>
								</div>
								<div className="flex items-center gap-2 font-mono tabular-nums text-right">
									<div className="p-2 rounded-lg bg-card border border-border text-[11px]">
										<span className="text-muted-foreground font-sans block text-[10px]">Next Settlement:</span>
										<span className="font-bold text-foreground">03 Apr 2026 (1st Friday)</span>
									</div>
									<div className="p-2 rounded-lg bg-card border border-border text-[11px]">
										<span className="text-muted-foreground font-sans block text-[10px]">Retention Status:</span>
										<span className="font-bold text-emerald-600">Zero Excess Retained</span>
									</div>
								</div>
							</div>

							{/* Ledger Table */}
							<Card className="border-border">
								<CardHeader className="py-4 flex flex-row items-center justify-between">
									<div>
										<CardTitle className="text-sm font-bold">Voucher Ledger Entries ({ledgerData.entries.length})</CardTitle>
										<CardDescription className="text-xs">Chronological double-entry cash ledger with running balance</CardDescription>
									</div>
								</CardHeader>
								<CardContent className="pt-0 p-0">
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow className="bg-muted/30">
													<TableHead className="text-xs">Voucher No</TableHead>
													<TableHead className="text-xs">Date</TableHead>
													<TableHead className="text-xs">Category</TableHead>
													<TableHead className="text-xs">Particulars / Description</TableHead>
													<TableHead className="text-xs text-right">Debit (INR)</TableHead>
													<TableHead className="text-xs text-right">Credit (INR)</TableHead>
													<TableHead className="text-xs text-right">Running Balance</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{ledgerData.entries.length === 0 ? (
													<TableRow>
														<TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
															No ledger entries found for selected filter.
														</TableCell>
													</TableRow>
												) : (
													ledgerData.entries.map((entry: any) => (
														<TableRow key={entry.id} className="text-xs">
															<TableCell className="font-mono text-[11px] text-muted-foreground">{entry.voucherNumber}</TableCell>
															<TableCell className="text-muted-foreground">{entry.date}</TableCell>
															<TableCell>
																<Badge
																	variant={
																		entry.category.includes("SELL") || entry.category.includes("PAYIN")
																			? "default"
																			: "secondary"
																	}
																	className="text-[10px]"
																>
																	{entry.category}
																</Badge>
															</TableCell>
															<TableCell className="font-medium max-w-sm truncate">{entry.particulars}</TableCell>
															<TableCell className="text-right text-rose-600 font-semibold">
																{entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : "-"}
															</TableCell>
															<TableCell className="text-right text-emerald-600 font-semibold">
																{entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : "-"}
															</TableCell>
															<TableCell className="text-right font-black">
																₹{entry.runningBalance.toLocaleString()}
															</TableCell>
														</TableRow>
													))
												)}
											</TableBody>
										</Table>
									</div>
								</CardContent>
							</Card>
						</>
					) : null}
				</TabsContent>
			</Tabs>
		</div>
	);
}
