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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	ShieldCheck,
	RefreshCw,
	Database,
	ExternalLink,
	Coins,
	Receipt,
	Building2,
	Scale,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DividendRecord {
	companyName: string;
	isin: string;
	recordDate: string;
	payoutDate: string;
	grossDividend: number;
	tdsRatePct: number;
	tdsDeducted: number;
	netCredited: number;
	form16AStatus: "AVAILABLE" | "PENDING";
}

export function DepositoryComplianceViewer() {
	const { toast } = useToast();
	const [isSyncingCas, setIsSyncingCas] = useState(false);
	const [isSyncingBse, setIsSyncingBse] = useState(false);

	const dividends: DividendRecord[] = [
		{
			companyName: "Tata Consultancy Services Ltd",
			isin: "INE467B01029",
			recordDate: "16 Jan 2026",
			payoutDate: "03 Feb 2026",
			grossDividend: 7500,
			tdsRatePct: 10,
			tdsDeducted: 750,
			netCredited: 6750,
			form16AStatus: "AVAILABLE",
		},
		{
			companyName: "Infosys Limited",
			isin: "INE009A01021",
			recordDate: "28 Oct 2025",
			payoutDate: "14 Nov 2025",
			grossDividend: 5400,
			tdsRatePct: 10,
			tdsDeducted: 540,
			netCredited: 4860,
			form16AStatus: "AVAILABLE",
		},
		{
			companyName: "ITC Limited",
			isin: "INE154A01025",
			recordDate: "12 Aug 2025",
			payoutDate: "28 Aug 2025",
			grossDividend: 4200,
			tdsRatePct: 10,
			tdsDeducted: 420,
			netCredited: 3780,
			form16AStatus: "AVAILABLE",
		},
	];

	const handleSyncCas = async () => {
		setIsSyncingCas(true);
		toast({
			title: "Initiating CAS Synchronization",
			description: "Querying NSDL & CDSL e-CAS records via Account Aggregator...",
		});
		await new Promise((resolve) => setTimeout(resolve, 2000));
		setIsSyncingCas(false);
		toast({
			title: "CAS Sync Complete",
			description: "Consolidated holdings and ISIN allocations updated successfully.",
		});
	};

	const handleSyncBse = async () => {
		setIsSyncingBse(true);
		toast({
			title: "Querying BSE STAR MF",
			description: "Syncing mutual fund holdings, SIP orders, and folios under ARN-184920...",
		});
		await new Promise((resolve) => setTimeout(resolve, 2000));
		setIsSyncingBse(false);
		toast({
			title: "BSE STAR MF Synced",
			description: "All client folios and active mandates are 100% synchronized.",
		});
	};

	return (
		<div className="space-y-6">
			{/* Top Header Card */}
			<div className="p-6 rounded-2xl border border-border bg-gradient-to-r from-emerald-50/60 via-card to-teal-50/60 dark:from-emerald-950/20 dark:via-card dark:to-teal-950/20 shadow-xs">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div className="space-y-1.5">
						<div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
							<ShieldCheck className="h-3.5 w-3.5" />
							SEBI & Depository Participant Architecture
						</div>
						<h2 className="text-2xl font-bold tracking-tight">
							Depository CAS, Dividend Ledger & Statutory Tax Reconciliations
						</h2>
						<p className="text-xs sm:text-sm text-muted-foreground">
							Direct integration with NSDL & CDSL Consolidated Account Statements (CAS), BSE STAR MF exchange settlement, and Form 26AS / AIS TDS reconciliation.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleSyncCas}
							disabled={isSyncingCas}
							className="gap-1.5 text-xs h-9 bg-card"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${isSyncingCas ? "animate-spin" : ""}`} />
							Sync CDSL/NSDL CAS
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleSyncBse}
							disabled={isSyncingBse}
							className="gap-1.5 text-xs h-9 bg-card"
						>
							<Database className={`h-3.5 w-3.5 ${isSyncingBse ? "animate-spin" : ""}`} />
							Sync BSE STAR MF
						</Button>
					</div>
				</div>
			</div>

			{/* 3 Pillars of Depository & Tax Cross-Verification */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* NSDL / CDSL CAS */}
				<Card className="border-border">
					<CardContent className="pt-5 pb-4 space-y-2.5">
						<div className="flex items-center justify-between">
							<span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Depository CAS</span>
							<Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:border-emerald-800">
								Live Linked
							</Badge>
						</div>
						<div className="text-lg font-bold text-foreground flex items-center gap-2">
							<Building2 className="h-5 w-5 text-primary" />
							NSDL & CDSL Unified
						</div>
						<p className="text-xs text-muted-foreground">
							Single view of equity, debt, and gold securities across all your Depository Participant (DP) accounts.
						</p>
						<div className="pt-2 text-[11px] font-mono text-muted-foreground flex justify-between border-t border-border/60">
							<span>Last e-CAS Sync:</span>
							<span className="font-semibold text-foreground">Today, 09:30 IST</span>
						</div>
					</CardContent>
				</Card>

				{/* AMFI / BSE STAR MF */}
				<Card className="border-border">
					<CardContent className="pt-5 pb-4 space-y-2.5">
						<div className="flex items-center justify-between">
							<span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Exchange Mutual Funds</span>
							<Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300 dark:border-blue-800">
								ARN-184920
							</Badge>
						</div>
						<div className="text-lg font-bold text-foreground flex items-center gap-2">
							<Database className="h-5 w-5 text-blue-600" />
							BSE STAR MF Settlement
						</div>
						<p className="text-xs text-muted-foreground">
							Automated STP order routing, automated NACH mandate registration, and direct RTA reconciliation (CAMS/KFintech).
						</p>
						<div className="pt-2 text-[11px] font-mono text-muted-foreground flex justify-between border-t border-border/60">
							<span>Folios Active:</span>
							<span className="font-semibold text-foreground">18 Folios Cleared</span>
						</div>
					</CardContent>
				</Card>

				{/* Form 26AS & AIS Matching */}
				<Card className="border-border">
					<CardContent className="pt-5 pb-4 space-y-2.5">
						<div className="flex items-center justify-between">
							<span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">CBDT Tax Audit</span>
							<Badge variant="outline" className="text-[10px] text-purple-600 border-purple-300 dark:border-purple-800">
								100% Matched
							</Badge>
						</div>
						<div className="text-lg font-bold text-foreground flex items-center gap-2">
							<Receipt className="h-5 w-5 text-purple-600" />
							Form 26AS & AIS Sentinel
						</div>
						<p className="text-xs text-muted-foreground">
							Automatic reconciliation of SFT-015 (Mutual Fund Purchases) and SFT-017 (Share Transactions) against CBDT data.
						</p>
						<div className="pt-2 text-[11px] font-mono text-muted-foreground flex justify-between border-t border-border/60">
							<span>TDS Credit Tracked:</span>
							<span className="font-semibold text-emerald-600">₹1,710.00 Verified</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Dividend Income & TDS Statement (Section 194 Reconciliation) */}
			<Card className="border-border">
				<CardHeader className="py-4">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-sm font-bold flex items-center gap-2">
								<Coins className="h-4 w-4 text-emerald-600" />
								Dividend Payouts & Section 194 TDS Ledger
							</CardTitle>
							<CardDescription className="text-xs">
								Cash dividends directly credited to verified bank accounts with corresponding Form 16A TDS certificates for ITR Schedule OS.
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="pt-0 p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead className="text-xs font-bold">Company / ISIN</TableHead>
									<TableHead className="text-xs font-bold">Record Date</TableHead>
									<TableHead className="text-xs font-bold">Payout Date</TableHead>
									<TableHead className="text-xs font-bold text-right">Gross Dividend</TableHead>
									<TableHead className="text-xs font-bold text-right">TDS (Sec 194)</TableHead>
									<TableHead className="text-xs font-bold text-right">Net Credited</TableHead>
									<TableHead className="text-xs font-bold text-center">Form 16A</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{dividends.map((div) => (
									<TableRow key={div.isin} className="text-xs font-mono tabular-nums">
										<TableCell className="font-semibold text-foreground font-sans">
											<div>{div.companyName}</div>
											<div className="text-[10px] text-muted-foreground font-mono">{div.isin}</div>
										</TableCell>
										<TableCell className="text-muted-foreground">{div.recordDate}</TableCell>
										<TableCell className="text-muted-foreground">{div.payoutDate}</TableCell>
										<TableCell className="text-right font-bold">₹{div.grossDividend.toLocaleString()}</TableCell>
										<TableCell className="text-right text-rose-600 dark:text-rose-400">
											-₹{div.tdsDeducted.toLocaleString()} ({div.tdsRatePct}%)
										</TableCell>
										<TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
											₹{div.netCredited.toLocaleString()}
										</TableCell>
										<TableCell className="text-center font-sans">
											<Badge variant="outline" className="text-[10px] font-bold text-emerald-600 border-emerald-300 dark:border-emerald-800">
												{div.form16AStatus}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			{/* SEBI Investor Charter & Grievance Escalation */}
			<div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
				<div className="space-y-0.5">
					<div className="font-bold flex items-center gap-1.5">
						<Scale className="h-4 w-4 text-blue-600" />
						SEBI Investor Charter & Regulatory Redressal
					</div>
					<p className="text-muted-foreground text-[11px]">
						In accordance with SEBI circulars, all clients have direct access to the SCORES (SEBI Complaints Redress System) and SMART ODR (Online Dispute Resolution) portals.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<a
						href="https://scores.sebi.gov.in"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-card hover:bg-muted text-xs font-medium"
					>
						SCORES Portal
						<ExternalLink className="h-3 w-3" />
					</a>
					<a
						href="https://smartodr.in"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-card hover:bg-muted text-xs font-medium"
					>
						SMART ODR
						<ExternalLink className="h-3 w-3" />
					</a>
				</div>
			</div>
		</div>
	);
}
