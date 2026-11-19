import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Shield,
	CheckCircle2,
	AlertTriangle,
	TrendingUp,
	PieChart as PieIcon,
	Calendar,
	MessageCircle,
	ArrowRight,
	Loader2,
	DollarSign,
	Sparkles,
	Coins,
	FileText,
	Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DiagnosticReport {
	engine_version: string;
	calculation_timestamp: string;
	summary: {
		totalPortfolioValue: number;
		formattedTotal: string;
		healthScore: number;
		healthCategory: "Excellent" | "Good" | "Needs Attention" | "High Risk";
		primaryRiskProfile: "conservative" | "balanced" | "aggressive";
	};
	assetAllocation: {
		equityPct: number;
		debtPct: number;
		goldPct: number;
		cashPct: number;
		idealEquityPct: number;
		idealDebtPct: number;
		idealGoldPct: number;
		idealCashPct: number;
		imbalancePct: number;
	};
	feeDragAnalysis: {
		estimatedRegularExpenseRatioPct: number;
		estimatedDirectExpenseRatioPct: number;
		annualExpenseLeakage: number;
		fiveYearCompoundedLeakage: number;
		tenYearCompoundedLeakage: number;
	};
	diagnostics: {
		strengths: string[];
		redFlags: string[];
		recommendedActions: string[];
	};
	disclaimer: string;
}

export default function PublicPortfolioXRayPage() {
	const { code } = useParams<{ code?: string }>();
	const [location] = useLocation();
	const { toast } = useToast();

	// Read ref from query param if available
	const partnerCode = useMemo(() => {
		if (code) return code;
		const searchParams = new URLSearchParams(window.location.search);
		return searchParams.get("ref") || "default";
	}, [code]);

	// Fetch partner details for co-branding
	const { data: partnerData } = useQuery<{
		success: boolean;
		partner: {
			id: string;
			name: string;
			designation: string;
			phone?: string;
			email?: string;
			initials: string;
		};
	}>({
		queryKey: [`/api/public/portfolio-xray/partner/${partnerCode}`],
		queryFn: async () => {
			const res = await apiRequest(`/api/public/portfolio-xray/partner/${partnerCode}`);
			return res;
		},
	});

	// Form State
	const [fullName, setFullName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [riskProfile, setRiskProfile] = useState<"conservative" | "balanced" | "aggressive">("balanced");

	// Portfolio Values in ₹
	const [equityMF, setEquityMF] = useState(600000);
	const [stocks, setStocks] = useState(250000);
	const [debtFD, setDebtFD] = useState(250000);
	const [gold, setGold] = useState(50000);
	const [cash, setCash] = useState(50000);

	const [report, setReport] = useState<DiagnosticReport | null>(null);

	const diagnoseMutation = useMutation({
		mutationFn: async (payload: any) => {
			const res = await apiRequest("/api/public/portfolio-xray/diagnose", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: { "Content-Type": "application/json" },
			});
			return res;
		},
		onSuccess: (data: any) => {
			if (data.report) {
				setReport(data.report);
				toast({
					title: "Audit Report Generated!",
					description: "Your personalized Portfolio X-Ray is ready below.",
				});
				// Smooth scroll to report
				setTimeout(() => {
					document.getElementById("xray-report-section")?.scrollIntoView({ behavior: "smooth" });
				}, 100);
			}
		},
		onError: (err: any) => {
			toast({
				title: "Submission Error",
				description: err.message || "Failed to generate report",
				variant: "destructive",
			});
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!fullName.trim() || !phone.trim() || phone.replace(/\D/g, "").length < 10) {
			toast({
				title: "Required Details",
				description: "Please enter your name and a valid 10-digit mobile number.",
				variant: "destructive",
			});
			return;
		}

		diagnoseMutation.mutate({
			partnerCode,
			name: fullName.trim(),
			phone: phone.trim(),
			email: email.trim() || undefined,
			equityMutualFunds: Number(equityMF) || 0,
			directStocks: Number(stocks) || 0,
			debtAndFD: Number(debtFD) || 0,
			goldAndCommodities: Number(gold) || 0,
			cashAndLiquid: Number(cash) || 0,
			riskProfile,
			primaryGoal: "wealth_growth",
		});
	};

	// Presets
	const applyPreset = (preset: "starter" | "balanced" | "hni") => {
		if (preset === "starter") {
			setEquityMF(300000);
			setStocks(100000);
			setDebtFD(150000);
			setGold(30000);
			setCash(20000);
			setRiskProfile("balanced");
		} else if (preset === "balanced") {
			setEquityMF(1200000);
			setStocks(500000);
			setDebtFD(600000);
			setGold(150000);
			setCash(50000);
			setRiskProfile("balanced");
		} else if (preset === "hni") {
			setEquityMF(4500000);
			setStocks(2500000);
			setDebtFD(2000000);
			setGold(700000);
			setCash(300000);
			setRiskProfile("aggressive");
		}
	};

	const partner = partnerData?.partner || {
		name: "FintekPro Wealth Advisory",
		designation: "SEBI Registered Advisory Partner",
		initials: "FP",
		phone: "",
	};

	const totalEntered = equityMF + stocks + debtFD + gold + cash;

	return (
		<div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
			<div className="max-w-4xl mx-auto space-y-8">
				{/* Top Co-Branded Partner Banner */}
				<div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border shadow-sm flex-wrap gap-4">
					<div className="flex items-center gap-3">
						<div className="h-12 w-12 rounded-full bg-emerald-600/20 text-emerald-600 font-bold flex items-center justify-center text-lg border border-emerald-500/30">
							{partner.initials}
						</div>
						<div>
							<div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
								Advisory Consultation Sponosored by
							</div>
							<div className="text-base font-bold text-foreground flex items-center gap-2">
								{partner.name}
								<Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-xs py-0">
									Verified Partner
								</Badge>
							</div>
							<div className="text-xs text-muted-foreground">{partner.designation}</div>
						</div>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Shield className="h-4 w-4 text-emerald-600" />
						<span>Bank-Grade Encryption • Zero Spam</span>
					</div>
				</div>

				{/* Hero Header */}
				<div className="text-center space-y-3">
					<Badge className="bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 border-emerald-500/20 px-3 py-1 text-sm font-medium">
						<Sparkles className="h-3.5 w-3.5 mr-1.5" />
						FintekPro Financial Health-Check & Fee X-Ray
					</Badge>
					<h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
						Is Your Portfolio Bleeding Hidden Commission Fees?
					</h1>
					<p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
						Uncover hidden distributor commission drag, asset allocation imbalances, and risk concentration in 60 seconds with our algorithmic audit.
					</p>
				</div>

				{/* Input Form Card */}
				<Card className="border-border bg-card shadow-lg">
					<CardHeader>
						<div className="flex items-center justify-between flex-wrap gap-2">
							<div>
								<CardTitle className="text-xl">Step 1: Enter Your Portfolio Snapshot</CardTitle>
								<CardDescription>
									Provide approximate values across assets to analyze compounding leakage
								</CardDescription>
							</div>
							<div className="flex items-center gap-1.5 text-xs">
								<span className="text-muted-foreground">Presets:</span>
								<Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => applyPreset("starter")}>
									₹6L Starter
								</Button>
								<Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => applyPreset("balanced")}>
									₹25L Growth
								</Button>
								<Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => applyPreset("hni")}>
									₹1Cr HNI
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-6">
							{/* Investor Contact Details */}
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/40 border border-border">
								<div className="space-y-1.5">
									<Label htmlFor="input-full-name">Your Full Name *</Label>
									<Input
										id="input-full-name"
										placeholder="e.g. Rahul Sharma"
										value={fullName}
										onChange={(e) => setFullName(e.target.value)}
										required
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="input-phone">WhatsApp Mobile *</Label>
									<Input
										id="input-phone"
										placeholder="10-digit mobile"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										maxLength={10}
										required
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="input-email">Email (Optional)</Label>
									<Input
										id="input-email"
										type="email"
										placeholder="rahul@example.com"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
									/>
								</div>
							</div>

							{/* Risk Appetite Selection */}
							<div className="space-y-2">
								<Label className="text-sm font-semibold">Your Risk Profile</Label>
								<div className="grid grid-cols-3 gap-3">
									<button
										type="button"
										onClick={() => setRiskProfile("conservative")}
										className={`p-3 rounded-lg border text-left transition-all ${
											riskProfile === "conservative"
												? "border-emerald-500 bg-emerald-500/10 font-semibold"
												: "border-border hover:border-muted-foreground/40"
										}`}
									>
										<div className="text-sm font-bold">🛡️ Conservative</div>
										<div className="text-xs text-muted-foreground">Capital preservation & debt</div>
									</button>
									<button
										type="button"
										onClick={() => setRiskProfile("balanced")}
										className={`p-3 rounded-lg border text-left transition-all ${
											riskProfile === "balanced"
												? "border-emerald-500 bg-emerald-500/10 font-semibold"
												: "border-border hover:border-muted-foreground/40"
										}`}
									>
										<div className="text-sm font-bold">⚖️ Balanced</div>
										<div className="text-xs text-muted-foreground">Growth with debt cushion</div>
									</button>
									<button
										type="button"
										onClick={() => setRiskProfile("aggressive")}
										className={`p-3 rounded-lg border text-left transition-all ${
											riskProfile === "aggressive"
												? "border-emerald-500 bg-emerald-500/10 font-semibold"
												: "border-border hover:border-muted-foreground/40"
										}`}
									>
										<div className="text-sm font-bold">🚀 Aggressive</div>
										<div className="text-xs text-muted-foreground">Maximum equity compounding</div>
									</button>
								</div>
							</div>

							{/* Asset Value Sliders / Inputs */}
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<Label className="text-sm font-semibold">Asset Breakdown (in ₹)</Label>
									<div className="text-sm font-bold text-emerald-600">
										Total Portfolio: ₹{totalEntered.toLocaleString("en-IN")}
									</div>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div className="space-y-1.5 p-3 rounded-lg bg-card border border-border">
										<div className="flex justify-between text-xs">
											<span className="font-semibold text-foreground">📈 Equity Mutual Funds</span>
											<span className="text-muted-foreground">Regular & Direct</span>
										</div>
										<Input
											type="number"
											value={equityMF}
											onChange={(e) => setEquityMF(Number(e.target.value))}
											step={50000}
											min={0}
										/>
									</div>

									<div className="space-y-1.5 p-3 rounded-lg bg-card border border-border">
										<div className="flex justify-between text-xs">
											<span className="font-semibold text-foreground">📊 Direct Stocks</span>
											<span className="text-muted-foreground">Demat Holdings</span>
										</div>
										<Input
											type="number"
											value={stocks}
											onChange={(e) => setStocks(Number(e.target.value))}
											step={50000}
											min={0}
										/>
									</div>

									<div className="space-y-1.5 p-3 rounded-lg bg-card border border-border">
										<div className="flex justify-between text-xs">
											<span className="font-semibold text-foreground">🏛️ Fixed Deposits & Debt</span>
											<span className="text-muted-foreground">Bonds, PPF, FDs</span>
										</div>
										<Input
											type="number"
											value={debtFD}
											onChange={(e) => setDebtFD(Number(e.target.value))}
											step={50000}
											min={0}
										/>
									</div>

									<div className="space-y-1.5 p-3 rounded-lg bg-card border border-border">
										<div className="flex justify-between text-xs">
											<span className="font-semibold text-foreground">🪙 Gold & Commodities</span>
											<span className="text-muted-foreground">SGB, Physical, ETF</span>
										</div>
										<Input
											type="number"
											value={gold}
											onChange={(e) => setGold(Number(e.target.value))}
											step={25000}
											min={0}
										/>
									</div>
								</div>
							</div>

							<Button
								type="submit"
								size="lg"
								className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-base shadow-md"
								disabled={diagnoseMutation.isPending}
							>
								{diagnoseMutation.isPending ? (
									<>
										<Loader2 className="h-5 w-5 mr-2 animate-spin" />
										Analyzing Portfolio Diagnostics...
									</>
								) : (
									<>
										<Sparkles className="h-5 w-5 mr-2" />
										Generate Instant Portfolio X-Ray
										<ArrowRight className="h-5 w-5 ml-2" />
									</>
								)}
							</Button>
						</form>
					</CardContent>
				</Card>

				{/* Report Section */}
				{report && (
					<div id="xray-report-section" className="space-y-6 pt-4">
						<div className="flex items-center justify-between flex-wrap gap-2">
							<div>
								<h2 className="text-2xl font-bold flex items-center gap-2">
									<Award className="h-6 w-6 text-emerald-600" />
									Your Portfolio Diagnostic Scorecard
								</h2>
								<p className="text-sm text-muted-foreground">
									Audited for {fullName} • Total Assets: {report.summary.formattedTotal}
								</p>
							</div>
							<Badge
								variant="outline"
								className={`text-sm px-3 py-1 font-bold ${
									report.summary.healthScore >= 80
										? "bg-emerald-500/10 text-emerald-600 border-emerald-500"
										: report.summary.healthScore >= 60
											? "bg-amber-500/10 text-amber-600 border-amber-500"
											: "bg-red-500/10 text-red-600 border-red-500"
								}`}
							>
								Health Score: {report.summary.healthScore} / 100 ({report.summary.healthCategory})
							</Badge>
						</div>

						{/* Highlight 1: The Expense Drag Leakage Box (High Conversion Hook) */}
						<Card className="border-red-500/30 bg-red-950/20 shadow-md">
							<CardHeader className="pb-3">
								<CardTitle className="text-red-400 text-lg flex items-center gap-2">
									<AlertTriangle className="h-5 w-5" />
									Hidden Distributor Fee Leakage Detected
								</CardTitle>
								<CardDescription className="text-red-200/80">
									Regular Mutual Funds charge ~1.10% annual distributor commissions that silently eat into your compounding returns.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
									<div className="p-3 rounded-lg bg-background/60 border border-border">
										<div className="text-xs text-muted-foreground">Estimated Annual Leakage</div>
										<div className="text-xl font-extrabold text-red-400 mt-1">
											₹{report.feeDragAnalysis.annualExpenseLeakage.toLocaleString("en-IN")} / year
										</div>
										<div className="text-xs text-muted-foreground mt-0.5">Paid in hidden distributor trailing commissions</div>
									</div>

									<div className="p-3 rounded-lg bg-background/60 border border-border">
										<div className="text-xs text-muted-foreground">5-Year Compounded Loss</div>
										<div className="text-xl font-extrabold text-red-400 mt-1">
											₹{(report.feeDragAnalysis.fiveYearCompoundedLeakage / 100000).toFixed(2)} Lakhs
										</div>
										<div className="text-xs text-muted-foreground mt-0.5">At 12% expected compounding</div>
									</div>

									<div className="p-3 rounded-lg bg-background/60 border border-border">
										<div className="text-xs text-muted-foreground">10-Year Compounded Loss</div>
										<div className="text-2xl font-extrabold text-red-500 mt-1">
											₹{(report.feeDragAnalysis.tenYearCompoundedLeakage / 100000).toFixed(2)} Lakhs
										</div>
										<div className="text-xs text-muted-foreground mt-0.5">Potential wealth lost to fees</div>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Highlight 2: Asset Allocation Health */}
						<Card className="border-border bg-card">
							<CardHeader>
								<CardTitle className="text-lg flex items-center gap-2">
									<PieIcon className="h-5 w-5 text-blue-500" />
									Asset Allocation Breakdown vs. Target Profile
								</CardTitle>
								<CardDescription>
									Targeting a {report.summary.primaryRiskProfile} portfolio strategy
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<div>
										<div className="flex justify-between text-xs font-semibold mb-1">
											<span>📈 Equity ({report.assetAllocation.equityPct}%)</span>
											<span className="text-muted-foreground">Target: {report.assetAllocation.idealEquityPct}%</span>
										</div>
										<Progress value={report.assetAllocation.equityPct} className="h-2.5 bg-muted" />
									</div>

									<div>
										<div className="flex justify-between text-xs font-semibold mb-1">
											<span>🏛️ Debt & Fixed Income ({report.assetAllocation.debtPct}%)</span>
											<span className="text-muted-foreground">Target: {report.assetAllocation.idealDebtPct}%</span>
										</div>
										<Progress value={report.assetAllocation.debtPct} className="h-2.5 bg-muted" />
									</div>

									<div>
										<div className="flex justify-between text-xs font-semibold mb-1">
											<span>🪙 Gold & Sovereign ({report.assetAllocation.goldPct}%)</span>
											<span className="text-muted-foreground">Target: {report.assetAllocation.idealGoldPct}%</span>
										</div>
										<Progress value={report.assetAllocation.goldPct} className="h-2.5 bg-muted" />
									</div>

									<div>
										<div className="flex justify-between text-xs font-semibold mb-1">
											<span>💵 Cash & Liquid ({report.assetAllocation.cashPct}%)</span>
											<span className="text-muted-foreground">Target: {report.assetAllocation.idealCashPct}%</span>
										</div>
										<Progress value={report.assetAllocation.cashPct} className="h-2.5 bg-muted" />
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Highlight 3: Strengths & Recommended Actions */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Card className="border-border bg-card">
								<CardHeader className="pb-2">
									<CardTitle className="text-base text-emerald-600 flex items-center gap-2">
										<CheckCircle2 className="h-4 w-4" />
										Portfolio Strengths
									</CardTitle>
								</CardHeader>
								<CardContent className="text-xs space-y-2">
									{report.diagnostics.strengths.map((str, i) => (
										<div key={i} className="flex items-start gap-2">
											<span className="text-emerald-500 font-bold">•</span>
											<span>{str}</span>
										</div>
									))}
								</CardContent>
							</Card>

							<Card className="border-border bg-card">
								<CardHeader className="pb-2">
									<CardTitle className="text-base text-blue-500 flex items-center gap-2">
										<TrendingUp className="h-4 w-4" />
										Actionable Optimization Steps
									</CardTitle>
								</CardHeader>
								<CardContent className="text-xs space-y-2">
									{report.diagnostics.recommendedActions.map((act, i) => (
										<div key={i} className="flex items-start gap-2">
											<span className="text-blue-500 font-bold">•</span>
											<span>{act}</span>
										</div>
									))}
								</CardContent>
							</Card>
						</div>

						{/* Consultation Call-To-Action (Direct Meeting / WhatsApp) */}
						<Card className="border-emerald-500/40 bg-emerald-950/20 p-6 text-center space-y-4">
							<h3 className="text-xl font-bold">
								Ready to Stop the Leakage & Optimize Your Portfolio?
							</h3>
							<p className="text-sm text-muted-foreground max-w-xl mx-auto">
								Connect with {partner.name} for a complimentary, confidential 1-on-1 portfolio consultation via Google Meet or WhatsApp.
							</p>
							<div className="flex items-center justify-center gap-4 flex-wrap">
								<Button
									size="lg"
									className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2"
									onClick={() => {
										// Opens meetings hub or booking form
										window.open(`/agent/meetings`, "_blank");
									}}
								>
									<Calendar className="h-4 w-4" />
									Book 1-on-1 Video Consultation
								</Button>
								{partner.phone && (
									<Button
										size="lg"
										variant="outline"
										className="border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-2"
										onClick={() => {
											const cleanPhone = partner.phone?.replace(/\D/g, "");
											const text = encodeURIComponent(
												`Hi ${partner.name}, I just completed my FintekPro Portfolio X-Ray (${report.summary.formattedTotal} portfolio, Health Score: ${report.summary.healthScore}/100). I'd like to schedule a review consultation.`,
											);
											window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
										}}
									>
										<MessageCircle className="h-4 w-4" />
										Discuss on WhatsApp
									</Button>
								)}
							</div>
							<p className="text-xs text-muted-foreground pt-2">
								{report.disclaimer}
							</p>
						</Card>
					</div>
				)}
			</div>
		</div>
	);
}
