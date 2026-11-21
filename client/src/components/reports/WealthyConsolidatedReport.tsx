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
import { Progress } from "@/components/ui/progress";
import {
	Building2,
	TrendingUp,
	TrendingDown,
	PieChart,
	ShieldCheck,
	Layers,
	Share2,
	Download,
	Send,
	Users,
	CheckCircle2,
	Calendar,
	Sparkles,
	Clock,
	ArrowUpRight,
	IndianRupee,
	FileSpreadsheet,
	FileText,
	AlertCircle,
	Coins,
	Landmark,
	ExternalLink,
	MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AssetClassMetric {
	name: string;
	category: string;
	currentValue: number;
	investedValue: number;
	allocationPct: number;
	xirr: number;
	unrealizedGain: number;
	icon: any;
	color: string;
}

export function WealthyConsolidatedReport() {
	const { toast } = useToast();
	const [familyMember, setFamilyMember] = useState("consolidated");
	const [activeSubView, setActiveSubView] = useState<"overview" | "aif-pms" | "asset-xray" | "sip-cashflow">("overview");

	// Asset class allocation dataset (Consolidated Family Wealth)
	const assetClasses: AssetClassMetric[] = [
		{
			name: "Mutual Funds",
			category: "MF",
			currentValue: 8450000,
			investedValue: 6200000,
			allocationPct: 44.5,
			xirr: 17.4,
			unrealizedGain: 2250000,
			icon: TrendingUp,
			color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
		},
		{
			name: "Portfolio Management (PMS)",
			category: "PMS",
			currentValue: 5600000,
			investedValue: 4500000,
			allocationPct: 29.5,
			xirr: 18.8,
			unrealizedGain: 1100000,
			icon: Building2,
			color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900",
		},
		{
			name: "Alternative Funds (AIF)",
			category: "AIF",
			currentValue: 2850000,
			investedValue: 2400000,
			allocationPct: 15.0,
			xirr: 19.5,
			unrealizedGain: 450000,
			icon: Layers,
			color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900",
		},
		{
			name: "Pre-IPO & Unlisted Shares",
			category: "UNLISTED",
			currentValue: 1150000,
			investedValue: 850000,
			allocationPct: 6.0,
			xirr: 24.2,
			unrealizedGain: 300000,
			icon: Sparkles,
			color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
		},
		{
			name: "Corporate Debt & Bonds",
			category: "DEBT",
			currentValue: 650000,
			investedValue: 650000,
			allocationPct: 3.4,
			xirr: 8.8,
			unrealizedGain: 42000,
			icon: Landmark,
			color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
		},
		{
			name: "Sovereign Gold Bonds (SGB)",
			category: "GOLD",
			currentValue: 300000,
			investedValue: 210000,
			allocationPct: 1.6,
			xirr: 15.1,
			unrealizedGain: 90000,
			icon: Coins,
			color: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-900",
		},
	];

	const totalNetWorth = assetClasses.reduce((acc, a) => acc + a.currentValue, 0);
	const totalInvested = assetClasses.reduce((acc, a) => acc + a.investedValue, 0);
	const totalUnrealizedGains = totalNetWorth - totalInvested;
	const weightedXirr = 17.8;

	// AIF Capital Commitment Tracker (Wealthy.in signature feature)
	const aifCommitments = [
		{
			fundName: "Kotak India Growth Fund Series V (Cat II PE)",
			committedCapital: 5000000,
			calledCapital: 3250000,
			uncalledCapital: 1750000,
			currentNav: 3820000,
			calledPct: 65,
			tvpi: 1.17,
			vintage: "2023",
		},
		{
			fundName: "Avendus Absolute Return Fund (Cat III Long-Short)",
			committedCapital: 3000000,
			calledCapital: 3000000,
			uncalledCapital: 0,
			currentNav: 3480000,
			calledPct: 100,
			tvpi: 1.16,
			vintage: "2024",
		},
	];

	// PMS Direct Equity & Benchmark Alpha (Wealthy.in benchmark feature)
	const pmsStrategies = [
		{
			strategyName: "Marcellus Consistent Compounders",
			manager: "Marcellus Investment Managers",
			currentValue: 3200000,
			investedValue: 2500000,
			xirr: 19.2,
			benchmark: "Nifty 50 TRI (14.2%)",
			alpha: "+5.0%",
			hwmNav: 142.8,
			feeModel: "Fixed 1.5% + Nil Performance",
		},
		{
			strategyName: "WhiteOak India Pioneers Equity",
			manager: "WhiteOak Capital Management",
			currentValue: 2400000,
			investedValue: 2000000,
			xirr: 18.1,
			benchmark: "BSE 500 TRI (15.1%)",
			alpha: "+3.0%",
			hwmNav: 128.4,
			feeModel: "1.0% + 15% above 10% Hurdle",
		},
	];

	const handleDownloadConsolidatedPdf = () => {
		toast({
			title: "Generating Statement",
			description: "Generating white-labeled Consolidated Family Wealth Statement...",
		});

		const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

		// Institutional Header (Wealthy.in style)
		doc.setFontSize(20);
		doc.setTextColor(20, 45, 90);
		doc.text("FintekPro Private Wealth", 40, 45);

		doc.setFontSize(10);
		doc.setTextColor(100);
		doc.text("SEBI Registered Intermediary | AMFI Registered Mutual Fund Distributor", 40, 62);
		doc.text(`Statement Date: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, 40, 76);

		doc.setDrawColor(220);
		doc.line(40, 88, 555, 88);

		// Client & Family Summary Box
		doc.setFontSize(14);
		doc.setTextColor(30, 40, 60);
		doc.text("Consolidated Family Portfolio Statement", 40, 110);

		doc.setFontSize(10);
		doc.setTextColor(80);
		doc.text(`Family Group: Mohanty Family Trust & HUF`, 40, 126);
		doc.text(`Consolidated Net Worth: Rs. ${(totalNetWorth / 10000000).toFixed(2)} Crores | Aggregate XIRR: ${weightedXirr}%`, 40, 140);

		// Table: Asset Class Allocation
		const tableData = assetClasses.map((a) => [
			a.name,
			`Rs. ${(a.currentValue / 100000).toFixed(2)} L`,
			`Rs. ${(a.investedValue / 100000).toFixed(2)} L`,
			`Rs. ${(a.unrealizedGain / 100000).toFixed(2)} L`,
			`${a.allocationPct}%`,
			`${a.xirr}%`,
		]);

		autoTable(doc, {
			startY: 155,
			head: [["Asset Class", "Current Value", "Invested Cost", "Unrealized Gain", "Allocation", "XIRR"]],
			body: tableData,
			theme: "striped",
			headStyles: { fillColor: [30, 58, 138] },
			foot: [["Total Portfolio", `Rs. ${(totalNetWorth / 100000).toFixed(2)} L`, `Rs. ${(totalInvested / 100000).toFixed(2)} L`, `Rs. ${(totalUnrealizedGains / 100000).toFixed(2)} L`, "100%", `${weightedXirr}%`]],
			footStyles: { fillColor: [240, 245, 255], textColor: [20, 40, 80], fontStyle: "bold" },
		});

		// Table: AIF Capital Commitment
		const aifRows = aifCommitments.map((f) => [
			f.fundName,
			`Rs. ${(f.committedCapital / 100000).toFixed(1)} L`,
			`Rs. ${(f.calledCapital / 100000).toFixed(1)} L`,
			`Rs. ${(f.uncalledCapital / 100000).toFixed(1)} L`,
			`Rs. ${(f.currentNav / 100000).toFixed(1)} L`,
			`${f.tvpi}x`,
		]);

		autoTable(doc, {
			startY: (doc as any).lastAutoTable.finalY + 25,
			head: [["Alternative Investment Fund (AIF)", "Committed", "Called", "Uncalled", "Current Value", "TVPI"]],
			body: aifRows,
			theme: "grid",
			headStyles: { fillColor: [109, 40, 217] },
		});

		doc.save("FintekPro_Consolidated_Wealth_Statement.pdf");

		toast({
			title: "Statement Ready",
			description: "Downloaded FintekPro_Consolidated_Wealth_Statement.pdf",
		});
	};

	const handleShareWhatsApp = () => {
		const message = encodeURIComponent(
			`*FintekPro Consolidated Wealth Health Report*\n` +
			`Client: Mohanty Family Group\n` +
			`Total Net Worth: ₹${(totalNetWorth / 10000000).toFixed(2)} Cr\n` +
			`Consolidated XIRR: ${weightedXirr}% (Nifty Alpha: +3.6%)\n` +
			`Asset Mix: Mutual Funds (${assetClasses[0].allocationPct}%), PMS (${assetClasses[1].allocationPct}%), AIF (${assetClasses[2].allocationPct}%)\n` +
			`Prepared by FintekPro Wealth Advisory.`
		);
		window.open(`https://api.whatsapp.com/send?text=${message}`, "_blank");
	};

	return (
		<div className="space-y-6">
			{/* Wealthy.in Hero Banner */}
			<div className="p-6 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/80 via-card to-purple-50/80 dark:from-indigo-950/30 dark:via-card dark:to-purple-950/30 shadow-sm space-y-4">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div className="space-y-1">
						<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-xs">
							<Users className="h-3.5 w-3.5" />
							Family Office & Multi-Asset Wealth Hub
						</div>
						<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
							Consolidated Family Wealth Statement
						</h2>
						<p className="text-xs sm:text-sm text-muted-foreground">
							Inspired by Wealthy.in: Single-dashboard tracking across Mutual Funds, PMS, Cat II/III AIFs, Unlisted Equities, SGBs, and Bonds.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{/* Family Member Switcher */}
						<Select value={familyMember} onValueChange={setFamilyMember}>
							<SelectTrigger className="w-[200px] h-9 text-xs bg-card border-indigo-200 dark:border-indigo-800">
								<Users className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
								<SelectValue placeholder="Select Member / Entity" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="consolidated">All Family (Consolidated)</SelectItem>
								<SelectItem value="primary">Self (Individual)</SelectItem>
								<SelectItem value="spouse">Spouse</SelectItem>
								<SelectItem value="huf">Family HUF Account</SelectItem>
								<SelectItem value="entity">Corporate Investment Co.</SelectItem>
							</SelectContent>
						</Select>

						<Button
							size="sm"
							onClick={handleDownloadConsolidatedPdf}
							className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-9 shadow-sm"
						>
							<Download className="h-4 w-4" />
							Download Statement
						</Button>

						<Button
							size="sm"
							variant="outline"
							onClick={handleShareWhatsApp}
							className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 gap-1.5 text-xs h-9 bg-card"
						>
							<MessageSquare className="h-4 w-4" />
							Share WhatsApp
						</Button>
					</div>
				</div>

				{/* High-Level Net Worth Strip */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-950">
					<div className="p-3.5 rounded-xl bg-card border border-border">
						<span className="text-xs text-muted-foreground font-semibold">Total Net Worth</span>
						<div className="text-xl sm:text-2xl font-black text-indigo-950 dark:text-indigo-200 mt-1">
							₹{(totalNetWorth / 10000000).toFixed(2)} Cr
						</div>
						<span className="text-[11px] text-muted-foreground">Invested ₹{(totalInvested / 10000000).toFixed(2)} Cr</span>
					</div>

					<div className="p-3.5 rounded-xl bg-card border border-border">
						<span className="text-xs text-muted-foreground font-semibold">Consolidated XIRR</span>
						<div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
							<ArrowUpRight className="h-5 w-5" />
							{weightedXirr}%
						</div>
						<span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Alpha vs Nifty: +3.6%</span>
					</div>

					<div className="p-3.5 rounded-xl bg-card border border-border">
						<span className="text-xs text-muted-foreground font-semibold">Unrealized Wealth Gain</span>
						<div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
							₹{(totalUnrealizedGains / 100000).toFixed(2)} L
						</div>
						<span className="text-[11px] text-muted-foreground">Absolute Gain: +{((totalUnrealizedGains / totalInvested) * 100).toFixed(1)}%</span>
					</div>

					<div className="p-3.5 rounded-xl bg-card border border-border">
						<span className="text-xs text-muted-foreground font-semibold">Asset Classes Covered</span>
						<div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
							6 Vehicles
						</div>
						<span className="text-[11px] text-muted-foreground">MF, PMS, AIF, Unlisted, Debt, SGB</span>
					</div>
				</div>
			</div>

			{/* Sub Navigation Tabs */}
			<div className="flex border-b border-border gap-2">
				<Button
					variant={activeSubView === "overview" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveSubView("overview")}
					className="text-xs gap-1.5 h-8"
				>
					<PieChart className="h-3.5 w-3.5" />
					Multi-Asset Breakdown
				</Button>
				<Button
					variant={activeSubView === "aif-pms" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveSubView("aif-pms")}
					className="text-xs gap-1.5 h-8"
				>
					<Layers className="h-3.5 w-3.5" />
					AIF & PMS Capital Ledger
				</Button>
				<Button
					variant={activeSubView === "asset-xray" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveSubView("asset-xray")}
					className="text-xs gap-1.5 h-8"
				>
					<ShieldCheck className="h-3.5 w-3.5" />
					Asset Allocation & Overlap X-Ray
				</Button>
			</div>

			{/* VIEW 1: MULTI-ASSET BREAKDOWN */}
			{activeSubView === "overview" && (
				<div className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{assetClasses.map((item) => {
							const Icon = item.icon;
							return (
								<Card key={item.name} className="border border-border hover:shadow-md transition-shadow">
									<CardHeader className="p-4 pb-2">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2.5">
												<div className={`p-2 rounded-xl border ${item.color}`}>
													<Icon className="h-4 w-4" />
												</div>
												<div>
													<CardTitle className="text-sm font-bold">{item.name}</CardTitle>
													<span className="text-[10px] text-muted-foreground uppercase font-semibold">
														{item.category} • {item.allocationPct}% of Portfolio
													</span>
												</div>
											</div>
											<Badge variant="secondary" className="text-xs font-black text-emerald-600 dark:text-emerald-400">
												{item.xirr}% XIRR
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="p-4 pt-2 space-y-3">
										<div className="flex items-baseline justify-between">
											<span className="text-xs text-muted-foreground">Current Value</span>
											<span className="text-base font-extrabold text-foreground">
												₹{(item.currentValue / 100000).toFixed(2)} Lakhs
											</span>
										</div>

										<Progress value={item.allocationPct * 2} className="h-1.5" />

										<div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/60 text-muted-foreground">
											<div>
												<span>Cost: </span>
												<strong className="text-foreground">₹{(item.investedValue / 100000).toFixed(2)} L</strong>
											</div>
											<div className="text-right">
												<span>Gain: </span>
												<strong className="text-emerald-600">+₹{(item.unrealizedGain / 100000).toFixed(2)} L</strong>
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</div>
			)}

			{/* VIEW 2: AIF & PMS CAPITAL LEDGER */}
			{activeSubView === "aif-pms" && (
				<div className="space-y-6">
					{/* AIF Capital Commitment Tracker */}
					<Card className="border-border">
						<CardHeader className="py-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Layers className="h-4 w-4 text-purple-600" />
									<CardTitle className="text-sm font-bold">
										Alternative Investment Funds (AIF) Commitment & Drawdown Tracker
									</CardTitle>
								</div>
								<Badge variant="outline" className="text-[10px] uppercase font-bold text-purple-600 border-purple-300">
									SEBI Cat II & Cat III AIF
								</Badge>
							</div>
							<CardDescription className="text-xs">
								Tracking committed capital, cumulative drawdowns, and uncalled liability across institutional private funds.
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-0 p-0">
							<div className="divide-y divide-border">
								{aifCommitments.map((aif) => (
									<div key={aif.fundName} className="p-4 space-y-3">
										<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
											<div>
												<h4 className="font-bold text-sm text-foreground">{aif.fundName}</h4>
												<p className="text-xs text-muted-foreground">Vintage: {aif.vintage} • TVPI Multiple: {aif.tvpi}x</p>
											</div>
											<div className="text-right">
												<div className="text-sm font-black text-purple-600 dark:text-purple-400">
													Current NAV: ₹{(aif.currentNav / 100000).toFixed(2)} L
												</div>
												<span className="text-[11px] text-muted-foreground">Called: {aif.calledPct}%</span>
											</div>
										</div>

										<div className="space-y-1">
											<div className="flex justify-between text-xs text-muted-foreground">
												<span>Capital Drawn: ₹{(aif.calledCapital / 100000).toFixed(2)} L</span>
												<span>Uncalled Commitment: ₹{(aif.uncalledCapital / 100000).toFixed(2)} L</span>
											</div>
											<Progress value={aif.calledPct} className="h-2 bg-purple-100 dark:bg-purple-950" />
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* PMS Direct Equity Strategies */}
					<Card className="border-border">
						<CardHeader className="py-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Building2 className="h-4 w-4 text-indigo-600" />
									<CardTitle className="text-sm font-bold">
										Portfolio Management Services (PMS) Direct Equity Alpha
									</CardTitle>
								</div>
								<Badge variant="outline" className="text-[10px] uppercase font-bold text-indigo-600 border-indigo-300">
									SEBI Reg. PMS (₹50L Min)
								</Badge>
							</div>
							<CardDescription className="text-xs">
								Direct Demat stock portfolios managed by accredited Portfolio Managers with hurdle rates and High Water Mark (HWM) tracking.
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-0 p-0">
							<div className="divide-y divide-border">
								{pmsStrategies.map((pms) => (
									<div key={pms.strategyName} className="p-4 space-y-2">
										<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
											<div>
												<h4 className="font-bold text-sm text-foreground">{pms.strategyName}</h4>
												<p className="text-xs text-muted-foreground">{pms.manager} • Fee: {pms.feeModel}</p>
											</div>
											<div className="text-right">
												<div className="text-sm font-black text-emerald-600">
													XIRR: {pms.xirr}% (Alpha: {pms.alpha})
												</div>
												<span className="text-[11px] text-muted-foreground">Benchmark: {pms.benchmark}</span>
											</div>
										</div>
										<div className="p-2.5 rounded-lg bg-muted/40 text-xs flex justify-between items-center text-muted-foreground">
											<span>Current Value: <strong>₹{(pms.currentValue / 100000).toFixed(2)} L</strong> (Cost: ₹{(pms.investedValue / 100000).toFixed(2)} L)</span>
											<span>High Water Mark NAV: <strong>₹{pms.hwmNav}</strong></span>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* VIEW 3: ASSET ALLOCATION & OVERLAP X-RAY */}
			{activeSubView === "asset-xray" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Market Cap & Asset Tilt */}
					<Card className="border-border">
						<CardHeader className="py-4">
							<CardTitle className="text-sm font-bold flex items-center gap-2">
								<PieChart className="h-4 w-4 text-primary" />
								Market Cap Exposure & Equity Tilt
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 pt-0">
							<div className="space-y-1.5">
								<div className="flex justify-between text-xs font-semibold">
									<span>Large Cap Bluechips (Nifty 100)</span>
									<span>42%</span>
								</div>
								<Progress value={42} className="h-2 bg-blue-100 dark:bg-blue-950" />
							</div>
							<div className="space-y-1.5">
								<div className="flex justify-between text-xs font-semibold">
									<span>Mid Cap Compounders (Nifty Midcap 150)</span>
									<span>36%</span>
								</div>
								<Progress value={36} className="h-2 bg-indigo-100 dark:bg-indigo-950" />
							</div>
							<div className="space-y-1.5">
								<div className="flex justify-between text-xs font-semibold">
									<span>Small Cap / Emerging High Growth</span>
									<span>22%</span>
								</div>
								<Progress value={22} className="h-2 bg-purple-100 dark:bg-purple-950" />
							</div>
						</CardContent>
					</Card>

					{/* Cross-AMC Portfolio Stock Overlap Sentinel */}
					<Card className="border-border">
						<CardHeader className="py-4">
							<CardTitle className="text-sm font-bold flex items-center gap-2">
								<ShieldCheck className="h-4 w-4 text-emerald-600" />
								Cross-Fund Portfolio Overlap Diagnostics
							</CardTitle>
							<CardDescription className="text-xs">
								Underlying scrip concentration across your active Mutual Funds and PMS mandates.
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-0 space-y-2.5">
							<div className="p-2.5 rounded-lg border border-border bg-card/60 flex items-center justify-between text-xs">
								<span className="font-semibold">HDFC Bank Limited</span>
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground">Held in 4 funds</span>
									<Badge variant="secondary" className="font-bold">7.8% weight</Badge>
								</div>
							</div>
							<div className="p-2.5 rounded-lg border border-border bg-card/60 flex items-center justify-between text-xs">
								<span className="font-semibold">Reliance Industries Limited</span>
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground">Held in 3 funds</span>
									<Badge variant="secondary" className="font-bold">6.4% weight</Badge>
								</div>
							</div>
							<div className="p-2.5 rounded-lg border border-border bg-card/60 flex items-center justify-between text-xs">
								<span className="font-semibold">ICICI Bank Limited</span>
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground">Held in 3 funds</span>
									<Badge variant="secondary" className="font-bold">5.9% weight</Badge>
								</div>
							</div>
							<p className="text-[11px] text-muted-foreground pt-1 italic">
								Total top 10 scrip concentration is 38.4%, well within the prudent 45% concentration ceiling.
							</p>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
