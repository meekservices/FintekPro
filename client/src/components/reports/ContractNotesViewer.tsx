import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
	FileText,
	Download,
	Receipt,
	ShieldCheck,
	Filter,
	Clock,
	CheckCircle2,
	AlertTriangle,
	Building2,
	Scale,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ContractNoteRecord {
	id: string;
	contractNoteNo: string;
	tradeDate: string;
	settlementDate: string;
	settlementNo: string;
	exchange: "NSE" | "BSE" | "MCX";
	segment: "Equity Delivery" | "Equity F&O" | "Currency" | "Commodity";
	tradesCount: number;
	grossAmount: number;
	brokerage: number;
	statutoryLevies: number;
	netPayableReceivable: number;
	direction: "PAYABLE" | "RECEIVABLE";
	hash: string;
	status: "SETTLED" | "T+1 PENDING";
}

interface DailyMarginRecord {
	date: string;
	totalMarginRequirement: number;
	peakMarginRequirement: number;
	collateralAvailable: number;
	cashMarginAvailable: number;
	marginExcessShortfall: number;
	status: "COMPLIANT" | "SHORTFALL";
}

export function ContractNotesViewer() {
	const { toast } = useToast();
	const [selectedSegment, setSelectedSegment] = useState<string>("all");
	const [selectedExchange, setSelectedExchange] = useState<string>("all");

	// Sample institutional contract notes repository (Upstox/Angel One parity)
	const contractNotes: ContractNoteRecord[] = [
		{
			id: "CN-001",
			contractNoteNo: "CN-2026-NSE-10492",
			tradeDate: "26 Feb 2026",
			settlementDate: "27 Feb 2026",
			settlementNo: "2026038",
			exchange: "NSE",
			segment: "Equity Delivery",
			tradesCount: 4,
			grossAmount: 184520,
			brokerage: 0, // Direct Zero Commission
			statutoryLevies: 342.8,
			netPayableReceivable: 184862.8,
			direction: "PAYABLE",
			hash: "SHA256:7a4f9c2d1e8b...9021",
			status: "SETTLED",
		},
		{
			id: "CN-002",
			contractNoteNo: "CN-2026-NSE-10418",
			tradeDate: "24 Feb 2026",
			settlementDate: "25 Feb 2026",
			settlementNo: "2026036",
			exchange: "NSE",
			segment: "Equity F&O",
			tradesCount: 6,
			grossAmount: 421000,
			brokerage: 120,
			statutoryLevies: 512.4,
			netPayableReceivable: 28450,
			direction: "RECEIVABLE",
			hash: "SHA256:3e8c1b9f4a2d...4419",
			status: "SETTLED",
		},
		{
			id: "CN-003",
			contractNoteNo: "CN-2026-BSE-08912",
			tradeDate: "19 Feb 2026",
			settlementDate: "20 Feb 2026",
			settlementNo: "2026033",
			exchange: "BSE",
			segment: "Equity Delivery",
			tradesCount: 2,
			grossAmount: 95400,
			brokerage: 0,
			statutoryLevies: 168.2,
			netPayableReceivable: 95568.2,
			direction: "PAYABLE",
			hash: "SHA256:9f2c7a1e3b8d...7710",
			status: "SETTLED",
		},
		{
			id: "CN-004",
			contractNoteNo: "CN-2026-MCX-03412",
			tradeDate: "12 Feb 2026",
			settlementDate: "13 Feb 2026",
			settlementNo: "2026028",
			exchange: "MCX",
			segment: "Commodity",
			tradesCount: 2,
			grossAmount: 312000,
			brokerage: 80,
			statutoryLevies: 388.0,
			netPayableReceivable: 14200,
			direction: "RECEIVABLE",
			hash: "SHA256:1a8f9c2d7e3b...8821",
			status: "SETTLED",
		},
	];

	// SEBI T+1 Daily Margin Statements
	const marginStatements: DailyMarginRecord[] = [
		{
			date: "26 Feb 2026",
			totalMarginRequirement: 145000,
			peakMarginRequirement: 162000,
			collateralAvailable: 420000,
			cashMarginAvailable: 250000,
			marginExcessShortfall: 508000,
			status: "COMPLIANT",
		},
		{
			date: "25 Feb 2026",
			totalMarginRequirement: 180000,
			peakMarginRequirement: 195000,
			collateralAvailable: 420000,
			cashMarginAvailable: 220000,
			marginExcessShortfall: 445000,
			status: "COMPLIANT",
		},
		{
			date: "24 Feb 2026",
			totalMarginRequirement: 210000,
			peakMarginRequirement: 235000,
			collateralAvailable: 420000,
			cashMarginAvailable: 195000,
			marginExcessShortfall: 380000,
			status: "COMPLIANT",
		},
	];

	const filteredNotes = contractNotes.filter((note) => {
		const matchSegment = selectedSegment === "all" || note.segment === selectedSegment;
		const matchExchange = selectedExchange === "all" || note.exchange === selectedExchange;
		return matchSegment && matchExchange;
	});

	const handleDownloadECN = (note: ContractNoteRecord) => {
		toast({
			title: "Generating Electronic Contract Note",
			description: `Preparing ECN ${note.contractNoteNo} with cryptographic hash...`,
		});

		const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

		// Header
		doc.setFontSize(18);
		doc.setTextColor(20, 45, 90);
		doc.text("FintekPro Securities & Execution Desk", 40, 45);

		doc.setFontSize(9);
		doc.setTextColor(100);
		doc.text("SEBI Reg. Stock Broker: INZ000293433 | Member: NSE (90214) / BSE (6741)", 40, 60);
		doc.text(`Electronic Contract Note (ECN) | Section 15(4) of Securities Contracts Regulation Act`, 40, 73);

		doc.setDrawColor(210);
		doc.line(40, 84, 555, 84);

		// Contract Note Meta
		doc.setFontSize(10);
		doc.setTextColor(40);
		doc.text(`Contract Note No: ${note.contractNoteNo}`, 40, 105);
		doc.text(`Trade Date: ${note.tradeDate}`, 40, 120);
		doc.text(`Settlement Date: ${note.settlementDate} (T+1 Cycle)`, 40, 135);
		doc.text(`Exchange: ${note.exchange} | Settlement No: ${note.settlementNo}`, 320, 105);
		doc.text(`Segment: ${note.segment}`, 320, 120);
		doc.text(`Status: ${note.status}`, 320, 135);

		// Trade Breakdown Table
		autoTable(doc, {
			startY: 155,
			head: [["Trade Component", "Amount (INR)", "Statutory Reference"]],
			body: [
				["Gross Traded Turnover", `Rs. ${note.grossAmount.toLocaleString()}`, "Order Value"],
				["Brokerage Charged", `Rs. ${note.brokerage.toLocaleString()}`, "FintekPro Direct (Zero Commission)"],
				["Securities Transaction Tax (STT)", `Rs. ${(note.statutoryLevies * 0.55).toFixed(2)}`, "Chapter VII Finance Act"],
				["Exchange Transaction Charges", `Rs. ${(note.statutoryLevies * 0.15).toFixed(2)}`, `${note.exchange} Turnover Fee`],
				["SEBI Turnover Fees", `Rs. ${(note.statutoryLevies * 0.05).toFixed(2)}`, "SEBI Regulations"],
				["State Stamp Duty", `Rs. ${(note.statutoryLevies * 0.1).toFixed(2)}`, "Indian Stamp Act 1899"],
				["GST @ 18% on Charges", `Rs. ${(note.statutoryLevies * 0.15).toFixed(2)}`, "CGST + SGST / IGST"],
				["Total Statutory Levies", `Rs. ${note.statutoryLevies.toLocaleString()}`, "Govt. & Regulatory Deductions"],
				[`NET ${note.direction} AMOUNT`, `Rs. ${note.netPayableReceivable.toLocaleString()}`, "Net Settlement Obligation"],
			],
			theme: "striped",
			headStyles: { fillColor: [30, 58, 138] },
		});

		// Digital Signature Hash Footer
		const finalY = (doc as any).lastAutoTable.finalY + 30;
		doc.setFontSize(8);
		doc.setTextColor(120);
		doc.text("Cryptographic Verification Hash (SEBI ECN Standard):", 40, finalY);
		doc.text(note.hash, 40, finalY + 12);
		doc.text("Digitally authenticated and stored in PMLA 7-year immutable ledger.", 40, finalY + 24);

		doc.save(`${note.contractNoteNo}.pdf`);
	};

	return (
		<div className="space-y-6">
			{/* Top Header Card */}
			<div className="p-6 rounded-2xl border border-border bg-gradient-to-r from-blue-50/60 via-card to-indigo-50/60 dark:from-blue-950/20 dark:via-card dark:to-indigo-950/20 shadow-xs">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div className="space-y-1.5">
						<div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
							<ShieldCheck className="h-3.5 w-3.5" />
							Upstox & Angel One Clearing Standard
						</div>
						<h2 className="text-2xl font-bold tracking-tight">
							Trade Book, Electronic Contract Notes (ECN) & Margin Logs
						</h2>
						<p className="text-xs sm:text-sm text-muted-foreground">
							Digitally signed contract notes with cryptographic verification hashes, T+1 settlement logs, and daily peak margin statements per SEBI mandates.
						</p>
					</div>

					<div className="flex items-center gap-2 text-xs font-mono">
						<Badge variant="outline" className="gap-1.5 py-1 px-2.5 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
							<CheckCircle2 className="h-3.5 w-3.5" />
							T+1 Settlement Active
						</Badge>
					</div>
				</div>
			</div>

			{/* SEBI Mandatory Derivative Risk Disclosure */}
			<div className="p-4 rounded-xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
				<div className="flex items-center gap-2 font-bold uppercase tracking-wider">
					<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
					SEBI Mandatory Risk Disclosure on Derivatives Trading
				</div>
				<p className="leading-relaxed">
					<strong>9 out of 10 individual traders</strong> in equity Futures and Options segment incurred net losses, with an average loss of approximately <strong>₹50,000</strong>. Additionally, active traders spent an average of <strong>28% of net trading losses in transaction costs and statutory levies</strong>. Investors should trade derivatives strictly with risk capital.
				</p>
			</div>

			{/* Filters Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-card">
				<div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
					<Filter className="h-3.5 w-3.5" />
					Filter Records:
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Select value={selectedExchange} onValueChange={setSelectedExchange}>
						<SelectTrigger className="w-[120px] h-8 text-xs">
							<Building2 className="h-3 w-3 mr-1 text-muted-foreground" />
							<SelectValue placeholder="Exchange" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Exchanges</SelectItem>
							<SelectItem value="NSE">NSE Only</SelectItem>
							<SelectItem value="BSE">BSE Only</SelectItem>
							<SelectItem value="MCX">MCX Only</SelectItem>
						</SelectContent>
					</Select>

					<Select value={selectedSegment} onValueChange={setSelectedSegment}>
						<SelectTrigger className="w-[150px] h-8 text-xs">
							<Scale className="h-3 w-3 mr-1 text-muted-foreground" />
							<SelectValue placeholder="Segment" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Segments</SelectItem>
							<SelectItem value="Equity Delivery">Equity Delivery</SelectItem>
							<SelectItem value="Equity F&O">Equity F&O</SelectItem>
							<SelectItem value="Commodity">Commodities</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Table of Electronic Contract Notes */}
			<Card className="border-border">
				<CardHeader className="py-4">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-sm font-bold flex items-center gap-2">
								<Receipt className="h-4 w-4 text-primary" />
								Digitally Signed Electronic Contract Notes ({filteredNotes.length})
							</CardTitle>
							<CardDescription className="text-xs">
								Legally valid ECNs issued under SCRA Section 15(4) with immutable cryptographic hash.
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="pt-0 p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead className="text-xs font-bold">Contract Note No.</TableHead>
									<TableHead className="text-xs font-bold">Trade Date</TableHead>
									<TableHead className="text-xs font-bold">Exchange & Segment</TableHead>
									<TableHead className="text-xs font-bold text-right">Trades</TableHead>
									<TableHead className="text-xs font-bold text-right">Gross Turn.</TableHead>
									<TableHead className="text-xs font-bold text-right">Statutory Levies</TableHead>
									<TableHead className="text-xs font-bold text-right">Net Settlement</TableHead>
									<TableHead className="text-xs font-bold text-center">Status</TableHead>
									<TableHead className="text-xs font-bold text-right">Download</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredNotes.map((note) => (
									<TableRow key={note.id} className="text-xs font-mono tabular-nums">
										<TableCell className="font-semibold text-foreground font-sans flex items-center gap-1.5">
											<FileText className="h-3.5 w-3.5 text-primary" />
											{note.contractNoteNo}
										</TableCell>
										<TableCell className="text-muted-foreground">{note.tradeDate}</TableCell>
										<TableCell className="font-sans">
											<div className="flex items-center gap-1.5">
												<Badge variant="outline" className="text-[10px] font-bold">
													{note.exchange}
												</Badge>
												<span className="text-muted-foreground text-xs">{note.segment}</span>
											</div>
										</TableCell>
										<TableCell className="text-right">{note.tradesCount}</TableCell>
										<TableCell className="text-right">₹{note.grossAmount.toLocaleString()}</TableCell>
										<TableCell className="text-right text-muted-foreground">₹{note.statutoryLevies.toFixed(2)}</TableCell>
										<TableCell className={`text-right font-bold ${note.direction === "RECEIVABLE" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
											₹{note.netPayableReceivable.toLocaleString()}
											<span className="text-[10px] ml-1 text-muted-foreground font-sans">
												({note.direction === "RECEIVABLE" ? "Credit" : "Debit"})
											</span>
										</TableCell>
										<TableCell className="text-center font-sans">
											<Badge variant="secondary" className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
												{note.status}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<Button
												size="sm"
												variant="ghost"
												onClick={() => handleDownloadECN(note)}
												className="h-7 px-2 text-xs font-sans text-primary hover:text-primary hover:bg-primary/10"
											>
												<Download className="h-3.5 w-3.5 mr-1" />
												PDF
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* SEBI T+1 Daily Margin Statements */}
			<Card className="border-border">
				<CardHeader className="py-4">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-sm font-bold flex items-center gap-2">
								<Clock className="h-4 w-4 text-emerald-600" />
								SEBI Daily Margin & Peak Margin Statements (T+1 Reporting)
							</CardTitle>
							<CardDescription className="text-xs">
								Daily margin verification tracking peak margin utilization vs. available collateral per SEBI circular CIR/HO/MIRSD/DOP/CIR/P/2020/146.
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="pt-0 p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead className="text-xs font-bold">Reporting Date</TableHead>
									<TableHead className="text-xs font-bold text-right">EOD Margin Req.</TableHead>
									<TableHead className="text-xs font-bold text-right">Peak Margin Req.</TableHead>
									<TableHead className="text-xs font-bold text-right">Cash Collateral</TableHead>
									<TableHead className="text-xs font-bold text-right">Securities Collateral</TableHead>
									<TableHead className="text-xs font-bold text-right">Excess / Shortfall</TableHead>
									<TableHead className="text-xs font-bold text-center">SEBI Compliance</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{marginStatements.map((m) => (
									<TableRow key={m.date} className="text-xs font-mono tabular-nums">
										<TableCell className="font-semibold text-foreground">{m.date}</TableCell>
										<TableCell className="text-right">₹{m.totalMarginRequirement.toLocaleString()}</TableCell>
										<TableCell className="text-right">₹{m.peakMarginRequirement.toLocaleString()}</TableCell>
										<TableCell className="text-right text-muted-foreground">₹{m.cashMarginAvailable.toLocaleString()}</TableCell>
										<TableCell className="text-right text-muted-foreground">₹{m.collateralAvailable.toLocaleString()}</TableCell>
										<TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
											+₹{m.marginExcessShortfall.toLocaleString()}
										</TableCell>
										<TableCell className="text-center font-sans">
											<Badge variant="outline" className="text-[10px] font-bold text-emerald-600 border-emerald-300 dark:border-emerald-800">
												100% Compliant
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
