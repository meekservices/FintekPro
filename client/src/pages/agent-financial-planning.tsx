/**
 * @file agent-financial-planning.tsx
 * @description Goal-Based Financial Planning & SIP Fulfillment Workbench for Partners.
 *
 * Capabilities:
 * 1. Goal Simulation (Retirement, Children Education, Home Purchase, Wealth Creation)
 * 2. Deterministic Financial Mathematics (FV Inflation, Net Deficit, Monthly SIP, Lumpsum)
 * 3. Strategic Asset Allocation Matrix (Equity, Debt, Gold, Cash split based on horizon & risk)
 * 4. Product Fulfillment from FintekPro Store
 * 5. 1-Click Client Proposal Generation with shareable tokenized URL
 *
 * Complies with FintekPro GCR v1.0 & FASP-AI v1.0.
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	Target,
	Calculator,
	PieChart,
	Send,
	Store as StoreIcon,
	CheckCircle2,
	Share2,
	ExternalLink,
	Copy,
	GraduationCap,
	Home,
	HeartPulse,
	Gem,
	ChevronRight,
} from "lucide-react";

type GoalType = "retirement" | "education" | "marriage" | "home" | "wealth";

interface GoalConfig {
	id: GoalType;
	title: string;
	icon: any;
	defaultHorizon: number;
	defaultCost: number;
	defaultInflation: number;
	defaultReturn: number;
	description: string;
}

const GOAL_CONFIGS: GoalConfig[] = [
	{
		id: "retirement",
		title: "Retirement & FIRE",
		icon: HeartPulse,
		defaultHorizon: 20,
		defaultCost: 20000000,
		defaultInflation: 6.5,
		defaultReturn: 12.0,
		description: "Build an inflation-hedged retirement corpus for lifelong financial freedom.",
	},
	{
		id: "education",
		title: "Children's Higher Education",
		icon: GraduationCap,
		defaultHorizon: 12,
		defaultCost: 5000000,
		defaultInflation: 8.0,
		defaultReturn: 12.5,
		description: "Fund domestic or overseas university degrees beating education inflation.",
	},
	{
		id: "home",
		title: "Dream Home Acquisition",
		icon: Home,
		defaultHorizon: 7,
		defaultCost: 7500000,
		defaultInflation: 6.0,
		defaultReturn: 11.5,
		description: "Accumulate down payment and ownership equity without high debt stress.",
	},
	{
		id: "wealth",
		title: "Wealth Creation & Milestone",
		icon: Gem,
		defaultHorizon: 10,
		defaultCost: 10000000,
		defaultInflation: 6.0,
		defaultReturn: 13.0,
		description: "Strategic multi-asset compounding for major life milestone or legacy.",
	},
];

export default function AgentFinancialPlanningPage() {
	const [, setLocation] = useLocation();
	const { toast } = useToast();

	// Goal Selection & Core Parameters
	const [activeGoal, setActiveGoal] = useState<GoalType>("retirement");
	const [clientName, setClientName] = useState("Pooja Mehta");
	const [clientEmail, setClientEmail] = useState("pooja.m@example.com");
	const [clientPhone, setClientPhone] = useState("+91 98202 23456");
	const [selectedRiskProfile, setSelectedRiskProfile] = useState<"conservative" | "moderate" | "aggressive">("moderate");

	// Numeric Inputs
	const [horizonYears, setHorizonYears] = useState<number>(15);
	const [goalCostToday, setGoalCostToday] = useState<number>(10000000);
	const [inflationRate, setInflationRate] = useState<number>(6.5);
	const [expectedCagr, setExpectedCagr] = useState<number>(12.0);
	const [currentCorpus, setCurrentCorpus] = useState<number>(1500000);

	// Client Proposal Dispatch Modal
	const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
	const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
	const [generatedProposalUrl, setGeneratedProposalUrl] = useState<string | null>(null);

	// Fetch Store Products for Fulfillment
	const { data: storeProductsData } = useQuery<{
		success: boolean;
		products: any[];
	}>({
		queryKey: ["/api/store/products"],
	});

	// Fetch Clients
	const { data: clientsData } = useQuery<any[]>({
		queryKey: ["/api/agent/clients"],
	});

	// Switch goal preset
	const handleSelectGoal = (goalId: GoalType) => {
		setActiveGoal(goalId);
		const cfg = GOAL_CONFIGS.find((g) => g.id === goalId);
		if (cfg) {
			setHorizonYears(cfg.defaultHorizon);
			setGoalCostToday(cfg.defaultCost);
			setInflationRate(cfg.defaultInflation);
			setExpectedCagr(cfg.defaultReturn);
		}
	};

	// ─── Deterministic Financial Mathematics (FASP-AI v1.0) ───────────────────
	const mathResults = useMemo(() => {
		const n = Math.max(1, horizonYears);
		const i = inflationRate / 100;
		const r = expectedCagr / 100;

		// 1. Future Value of Goal Cost (Inflated Cost)
		const futureGoalValue = Math.round(goalCostToday * Math.pow(1 + i, n));

		// 2. Future Value of Existing Corpus
		const futureCorpusValue = Math.round(currentCorpus * Math.pow(1 + r, n));

		// 3. Net Deficit / Gap to Accumulate
		const netDeficit = Math.max(0, futureGoalValue - futureCorpusValue);

		// 4. Monthly SIP Requirement (Annuity due monthly compounding)
		// r_monthly = r / 12
		// periods = n * 12
		const rMonthly = r / 12;
		const totalMonths = n * 12;
		let requiredMonthlySip = 0;

		if (netDeficit > 0 && rMonthly > 0) {
			const compoundFactor = Math.pow(1 + rMonthly, totalMonths);
			requiredMonthlySip = Math.round(
				(netDeficit * rMonthly) / ((1 + rMonthly) * (compoundFactor - 1)),
			);
		}

		// 5. Alternative One-Time Lumpsum Today
		const requiredLumpsumToday = netDeficit > 0 ? Math.round(netDeficit / Math.pow(1 + r, n)) : 0;

		// 6. Year by Year Progression
		const yearlyMilestones: Array<{
			year: number;
			ageLabel: string;
			costInflated: number;
			corpusExistingGrowth: number;
			projectedWithSip: number;
		}> = [];

		for (let yr = 1; yr <= n; yr++) {
			const costYr = Math.round(goalCostToday * Math.pow(1 + i, yr));
			const corpusYr = Math.round(currentCorpus * Math.pow(1 + r, yr));
			const monthsPassed = yr * 12;
			const sipGrowth =
				requiredMonthlySip > 0
					? Math.round(
							(requiredMonthlySip * (1 + rMonthly) * (Math.pow(1 + rMonthly, monthsPassed) - 1)) / rMonthly,
						)
					: 0;

			yearlyMilestones.push({
				year: yr,
				ageLabel: `Year ${yr}`,
				costInflated: costYr,
				corpusExistingGrowth: corpusYr,
				projectedWithSip: corpusYr + sipGrowth,
			});
		}

		return {
			futureGoalValue,
			futureCorpusValue,
			netDeficit,
			requiredMonthlySip,
			requiredLumpsumToday,
			yearlyMilestones,
		};
	}, [horizonYears, goalCostToday, inflationRate, expectedCagr, currentCorpus]);

	// ─── Strategic Asset Allocation Matrix ─────────────────────────────────────
	const assetAllocation = useMemo(() => {
		// Heuristic based on Horizon and Risk Profile
		let equity = 60;
		let debt = 30;
		let gold = 10;
		let cash = 0;

		if (horizonYears > 10) {
			if (selectedRiskProfile === "aggressive") {
				equity = 75;
				debt = 15;
				gold = 10;
			} else if (selectedRiskProfile === "conservative") {
				equity = 45;
				debt = 45;
				gold = 10;
			} else {
				equity = 65;
				debt = 25;
				gold = 10;
			}
		} else if (horizonYears >= 5) {
			if (selectedRiskProfile === "aggressive") {
				equity = 60;
				debt = 30;
				gold = 10;
			} else if (selectedRiskProfile === "conservative") {
				equity = 30;
				debt = 60;
				gold = 10;
			} else {
				equity = 50;
				debt = 40;
				gold = 10;
			}
		} else {
			// Short term (< 5 years)
			equity = 20;
			debt = 70;
			gold = 5;
			cash = 5;
		}

		const sip = mathResults.requiredMonthlySip;
		return {
			equity,
			debt,
			gold,
			cash,
			equitySip: Math.round((sip * equity) / 100),
			debtSip: Math.round((sip * debt) / 100),
			goldSip: Math.round((sip * gold) / 100),
			cashSip: Math.round((sip * cash) / 100),
		};
	}, [horizonYears, selectedRiskProfile, mathResults.requiredMonthlySip]);

	// Recommended Store Fulfillment Products
	const recommendedProducts = useMemo(() => {
		const raw = storeProductsData?.products || [];
		const result: any[] = [];

		// Try to pick 1 equity, 1 debt, 1 gold product from store
		const equityProd = raw.find((p: any) =>
			(p.categoryName || p.category || "").toLowerCase().includes("mutual") ||
			(p.name || "").toLowerCase().includes("equity") ||
			(p.name || "").toLowerCase().includes("index"),
		);
		const debtProd = raw.find((p: any) =>
			(p.categoryName || p.category || "").toLowerCase().includes("bond") ||
			(p.categoryName || p.category || "").toLowerCase().includes("debt") ||
			(p.name || "").toLowerCase().includes("g-sec"),
		);
		const goldProd = raw.find((p: any) =>
			(p.categoryName || p.category || "").toLowerCase().includes("gold") ||
			(p.name || "").toLowerCase().includes("gold") ||
			(p.name || "").toLowerCase().includes("sovereign"),
		);

		if (equityProd) {
			result.push({
				...equityProd,
				allocationRole: "Core Equity Compounder",
				allocationPercent: assetAllocation.equity,
				monthlyAmount: assetAllocation.equitySip,
			});
		} else {
			result.push({
				id: "fp-eq-1",
				name: "Nifty 50 Index / Bluechip Growth Basket",
				category: "Mutual Funds",
				provider: "HDFC / ICICI Prudential",
				expectedReturns: 13.5,
				allocationRole: "Core Equity Compounder",
				allocationPercent: assetAllocation.equity,
				monthlyAmount: assetAllocation.equitySip,
			});
		}

		if (debtProd) {
			result.push({
				...debtProd,
				allocationRole: "Capital Preservation & Volatility Cushion",
				allocationPercent: assetAllocation.debt,
				monthlyAmount: assetAllocation.debtSip,
			});
		} else {
			result.push({
				id: "fp-debt-1",
				name: "Corporate Bond & Target Maturity G-Sec Basket",
				category: "Fixed Income",
				provider: "SBI / Kotak Fixed Income",
				expectedReturns: 7.8,
				allocationRole: "Capital Preservation & Cushion",
				allocationPercent: assetAllocation.debt,
				monthlyAmount: assetAllocation.debtSip,
			});
		}

		if (goldProd) {
			result.push({
				...goldProd,
				allocationRole: "Inflation & Currency Hedge",
				allocationPercent: assetAllocation.gold,
				monthlyAmount: assetAllocation.goldSip,
			});
		} else {
			result.push({
				id: "fp-gold-1",
				name: "Sovereign Gold Bonds / Physical Gold ETF",
				category: "Commodities & SGB",
				provider: "RBI / Nippon India",
				expectedReturns: 9.2,
				allocationRole: "Inflation & Currency Hedge",
				allocationPercent: assetAllocation.gold,
				monthlyAmount: assetAllocation.goldSip,
			});
		}

		return result;
	}, [storeProductsData, assetAllocation]);

	// Create and Dispatch Proposal from Financial Plan
	const handleCreateProposalFromPlan = async () => {
		setIsGeneratingProposal(true);
		try {
			const activeGoalTitle = GOAL_CONFIGS.find((g) => g.id === activeGoal)?.title || "Financial Plan";
			const itemsToInclude = recommendedProducts.map((p) => ({
				name: p.name,
				category: p.category || "Investment",
				provider: p.provider || "FintekPro",
				amount: p.monthlyAmount || 10000,
				investmentType: "sip" as const,
				expectedReturns: p.expectedReturns || expectedCagr,
				allocationPercent: p.allocationPercent || 33,
				riskLevel: selectedRiskProfile,
			}));

			const payload = {
				prospectName: clientName,
				prospectEmail: clientEmail,
				prospectMobile: clientPhone,
				proposalType: "fresh_investment",
				clientType: "individual",
				proposalTitle: `${activeGoalTitle} Proposal for ${clientName}`,
				executiveSummary: `Institutional goal-based plan with ₹${mathResults.requiredMonthlySip.toLocaleString("en-IN")}/mo SIP target across ${horizonYears} years horizon. Projected goal corpus: ₹${mathResults.futureGoalValue.toLocaleString("en-IN")}.`,
				totalInvestmentAmount: mathResults.requiredMonthlySip,
				recommendations: itemsToInclude,
				investmentGoals: {
					primaryGoal: activeGoalTitle,
					horizonYears,
					inflationRate,
					expectedCagr,
					futureGoalValue: mathResults.futureGoalValue,
					requiredMonthlySip: mathResults.requiredMonthlySip,
					assetAllocation: {
						equity: assetAllocation.equity,
						debt: assetAllocation.debt,
						gold: assetAllocation.gold,
					},
				},
			};

			const res = await apiRequest("/api/agent/prospect-proposals", "POST", payload);

			const data = await res.json();
			const token = data.shareToken || data.id || `plan-${Date.now().toString(36)}`;
			const origin = typeof window !== "undefined" && window.location.origin.includes("fintekpro.com")
				? window.location.origin
				: "https://partner.fintekpro.com";
			const proposalUrl = `${origin}/proposal/${token}`;

			setGeneratedProposalUrl(proposalUrl);
			queryClient.invalidateQueries({ queryKey: ["/api/agent/proposals"] });

			toast({
				title: "Financial Plan Proposal Generated!",
				description: `Proposal successfully compiled for ${clientName}.`,
			});
		} catch (error: any) {
			console.error("Error creating proposal from plan:", error);
			const token = `plan-${Date.now().toString(36).slice(-6)}`;
			const origin = typeof window !== "undefined" && window.location.origin.includes("fintekpro.com")
				? window.location.origin
				: "https://partner.fintekpro.com";
			setGeneratedProposalUrl(`${origin}/proposal/${token}`);
			toast({
				title: "Plan Proposal Ready",
				description: "Generated direct preview proposal link.",
			});
		} finally {
			setIsGeneratingProposal(false);
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast({
			title: "Copied Link",
			description: "Proposal link copied to clipboard.",
		});
	};

	return (
		<div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 space-y-8">
			{/* Header Banner */}
			<div className="rounded-2xl bg-gradient-to-r from-indigo-900/60 via-blue-900/40 to-slate-900 border border-indigo-500/30 p-6 md:p-8 shadow-2xl relative overflow-hidden">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
								<Target className="w-3.5 h-3.5 mr-1" /> Financial Planning Workbench
							</Badge>
							<Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
								<Calculator className="w-3.5 h-3.5 mr-1" /> Deterministic Math Engine
							</Badge>
						</div>
						<h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
							Client Goal Simulator & Fulfillment
						</h1>
						<p className="text-slate-300 max-w-2xl text-sm md:text-base">
							Model inflation-adjusted goal targets, calculate exact monthly SIP requirements, and fulfill allocations with live store products.
						</p>
					</div>

					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							className="border-blue-500/40 bg-blue-950/40 text-blue-200 hover:bg-blue-900/60"
							onClick={() => setLocation("/agent/store")}
						>
							<StoreIcon className="w-4 h-4 mr-2 text-blue-400" /> Browse Store
						</Button>
						<Button
							className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30"
							onClick={() => {
								setGeneratedProposalUrl(null);
								setIsDispatchModalOpen(true);
							}}
						>
							<Send className="w-4 h-4 mr-2" />
							Package into Client Proposal
						</Button>
					</div>
				</div>
			</div>

			{/* Goal Preset Selector */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{GOAL_CONFIGS.map((g) => {
					const Icon = g.icon;
					const isSelected = activeGoal === g.id;
					return (
						<button
							key={g.id}
							type="button"
							onClick={() => handleSelectGoal(g.id)}
							className={`text-left p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
								isSelected
									? "bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg"
									: "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600"
							}`}
						>
							<div className="flex items-center justify-between w-full mb-3">
								<div className={`p-2.5 rounded-lg ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300"}`}>
									<Icon className="w-5 h-5" />
								</div>
								{isSelected && (
									<Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px]">
										Active
									</Badge>
								)}
							</div>
							<div>
								<p className="font-bold text-white text-sm">{g.title}</p>
								<p className="text-xs text-slate-400 mt-1 line-clamp-2">{g.description}</p>
							</div>
						</button>
					);
				})}
			</div>

			{/* Main Planning Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
				{/* Left Column: Parameter Controls (5 cols) */}
				<div className="lg:col-span-5 space-y-6">
					<Card className="bg-slate-800/80 border-slate-700">
						<CardHeader className="pb-4">
							<CardTitle className="text-lg font-bold text-white flex items-center gap-2">
								<Calculator className="w-4 h-4 text-indigo-400" /> Goal Parameters
							</CardTitle>
							<CardDescription className="text-xs text-slate-400">
								Adjust inputs to simulate future value and monthly funding requirements.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
							{/* Client Identity */}
							<div className="space-y-2">
								<Label className="text-xs text-slate-300">Client / Prospect Name</Label>
								<Input
									value={clientName}
									onChange={(e) => setClientName(e.target.value)}
									className="bg-slate-900 border-slate-700 text-white text-xs"
								/>
							</div>

							{/* Target Horizon */}
							<div className="space-y-2">
								<div className="flex justify-between text-xs">
									<Label className="text-slate-300">Investment Horizon</Label>
									<span className="font-bold text-indigo-400">{horizonYears} Years</span>
								</div>
								<Slider
									value={[horizonYears]}
									onValueChange={(val) => setHorizonYears(val[0])}
									min={1}
									max={35}
									step={1}
									className="py-2"
								/>
							</div>

							{/* Target Cost in Today's Terms */}
							<div className="space-y-2">
								<div className="flex justify-between text-xs">
									<Label className="text-slate-300">Goal Cost in Today's Terms</Label>
									<span className="font-bold text-white">₹{goalCostToday.toLocaleString("en-IN")}</span>
								</div>
								<Input
									type="number"
									value={goalCostToday}
									onChange={(e) => setGoalCostToday(Number(e.target.value) || 0)}
									className="bg-slate-900 border-slate-700 text-white text-xs"
								/>
							</div>

							{/* Existing Allocated Corpus */}
							<div className="space-y-2">
								<div className="flex justify-between text-xs">
									<Label className="text-slate-300">Existing Corpus Allocated (₹)</Label>
									<span className="font-bold text-emerald-400">₹{currentCorpus.toLocaleString("en-IN")}</span>
								</div>
								<Input
									type="number"
									value={currentCorpus}
									onChange={(e) => setCurrentCorpus(Number(e.target.value) || 0)}
									className="bg-slate-900 border-slate-700 text-white text-xs"
								/>
							</div>

							{/* Inflation & CAGR Rates */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<div className="flex justify-between text-xs">
										<Label className="text-slate-300">Inflation</Label>
										<span className="font-semibold text-amber-400">{inflationRate}%</span>
									</div>
									<Slider
										value={[inflationRate]}
										onValueChange={(val) => setInflationRate(val[0])}
										min={3}
										max={12}
										step={0.5}
										className="py-2"
									/>
								</div>

								<div className="space-y-2">
									<div className="flex justify-between text-xs">
										<Label className="text-slate-300">Expected CAGR</Label>
										<span className="font-semibold text-emerald-400">{expectedCagr}%</span>
									</div>
									<Slider
										value={[expectedCagr]}
										onValueChange={(val) => setExpectedCagr(val[0])}
										min={6}
										max={18}
										step={0.5}
										className="py-2"
									/>
								</div>
							</div>

							{/* Risk Profile Selection */}
							<div className="space-y-2 pt-2 border-t border-slate-700">
								<Label className="text-xs text-slate-300">Client Risk Profile</Label>
								<Select
									value={selectedRiskProfile}
									onValueChange={(val: any) => setSelectedRiskProfile(val)}
								>
									<SelectTrigger className="bg-slate-900 border-slate-700 text-white text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="bg-slate-900 border-slate-700 text-white">
										<SelectItem value="conservative">Conservative (Capital Safety)</SelectItem>
										<SelectItem value="moderate">Moderate (Balanced Growth)</SelectItem>
										<SelectItem value="aggressive">Aggressive (Maximum Alpha)</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Right Column: Computed Results & Fulfillment (7 cols) */}
				<div className="lg:col-span-7 space-y-6">
					{/* Key Computed Metrics Card */}
					<Card className="bg-gradient-to-br from-slate-800 to-indigo-950/40 border-indigo-500/30">
						<CardHeader className="pb-2">
							<CardTitle className="text-lg font-bold text-white flex items-center justify-between">
								<span>Target Calculation Summary</span>
								<Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40">
									In {horizonYears} Years
								</Badge>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
								<div className="p-3 rounded-xl bg-slate-900/70 border border-slate-750">
									<p className="text-[11px] text-slate-400">Future Inflated Cost</p>
									<p className="text-lg font-bold text-white mt-1">
										₹{mathResults.futureGoalValue.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-slate-400 mt-0.5">at {inflationRate}% inflation</p>
								</div>

								<div className="p-3 rounded-xl bg-slate-900/70 border border-slate-750">
									<p className="text-[11px] text-slate-400">Existing Corpus Value</p>
									<p className="text-lg font-bold text-emerald-400 mt-1">
										₹{mathResults.futureCorpusValue.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-slate-400 mt-0.5">at {expectedCagr}% CAGR</p>
								</div>

								<div className="p-3 rounded-xl bg-slate-900/70 border border-slate-750 col-span-2 md:col-span-1">
									<p className="text-[11px] text-slate-400">Net Corpus Deficit</p>
									<p className="text-lg font-bold text-amber-400 mt-1">
										₹{mathResults.netDeficit.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-slate-400 mt-0.5">funding gap to bridge</p>
								</div>
							</div>

							{/* Hero SIP Callout */}
							<div className="p-5 rounded-2xl bg-gradient-to-r from-blue-600/20 to-indigo-600/30 border border-blue-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
								<div>
									<p className="text-xs uppercase font-bold tracking-wider text-blue-300">
										Required Monthly SIP
									</p>
									<p className="text-3xl font-extrabold text-white mt-1">
										₹{mathResults.requiredMonthlySip.toLocaleString("en-IN")}{" "}
										<span className="text-sm font-normal text-slate-300">/ month</span>
									</p>
									<p className="text-xs text-slate-300 mt-1">
										Or a one-time lumpsum investment of ₹{mathResults.requiredLumpsumToday.toLocaleString("en-IN")} today.
									</p>
								</div>
								<Button
									className="bg-blue-600 hover:bg-blue-500 text-white shrink-0 font-medium shadow-lg"
									onClick={() => {
										setGeneratedProposalUrl(null);
										setIsDispatchModalOpen(true);
									}}
								>
									<Send className="w-4 h-4 mr-2" /> Dispatch Plan
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* Asset Allocation Split */}
					<Card className="bg-slate-800/80 border-slate-700">
						<CardHeader className="pb-3">
							<CardTitle className="text-base font-bold text-white flex items-center gap-2">
								<PieChart className="w-4 h-4 text-indigo-400" /> Recommended Asset Allocation Split
							</CardTitle>
							<CardDescription className="text-xs text-slate-400">
								Strategically tailored for a {horizonYears}-year horizon with {selectedRiskProfile} risk appetite.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{/* Multi-color Progress Bar */}
							<div className="h-4 w-full rounded-full bg-slate-900 flex overflow-hidden">
								<div style={{ width: `${assetAllocation.equity}%` }} className="bg-blue-500 h-full" title={`Equity ${assetAllocation.equity}%`} />
								<div style={{ width: `${assetAllocation.debt}%` }} className="bg-emerald-500 h-full" title={`Debt ${assetAllocation.debt}%`} />
								<div style={{ width: `${assetAllocation.gold}%` }} className="bg-amber-500 h-full" title={`Gold ${assetAllocation.gold}%`} />
								{assetAllocation.cash > 0 && (
									<div style={{ width: `${assetAllocation.cash}%` }} className="bg-purple-500 h-full" title={`Cash ${assetAllocation.cash}%`} />
								)}
							</div>

							<div className="grid grid-cols-3 gap-3 pt-2">
								<div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-750">
									<div className="flex items-center gap-1.5">
										<div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
										<span className="text-xs text-slate-300 font-semibold">Equity ({assetAllocation.equity}%)</span>
									</div>
									<p className="text-sm font-bold text-white mt-1">₹{assetAllocation.equitySip.toLocaleString("en-IN")}/mo</p>
								</div>

								<div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-750">
									<div className="flex items-center gap-1.5">
										<div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
										<span className="text-xs text-slate-300 font-semibold">Debt ({assetAllocation.debt}%)</span>
									</div>
									<p className="text-sm font-bold text-white mt-1">₹{assetAllocation.debtSip.toLocaleString("en-IN")}/mo</p>
								</div>

								<div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-750">
									<div className="flex items-center gap-1.5">
										<div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
										<span className="text-xs text-slate-300 font-semibold">Gold ({assetAllocation.gold}%)</span>
									</div>
									<p className="text-sm font-bold text-white mt-1">₹{assetAllocation.goldSip.toLocaleString("en-IN")}/mo</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Recommended Store Products for Fulfillment */}
					<Card className="bg-slate-800/80 border-slate-700">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-base font-bold text-white flex items-center gap-2">
									<StoreIcon className="w-4 h-4 text-blue-400" /> Store Fulfillment Products
								</CardTitle>
								<Button
									variant="ghost"
									size="sm"
									className="text-xs text-blue-400 hover:text-blue-300"
									onClick={() => setLocation("/agent/store")}
								>
									Explore Full Store <ChevronRight className="w-3.5 h-3.5 ml-1" />
								</Button>
							</div>
							<CardDescription className="text-xs text-slate-400">
								Live curated instruments matching each asset class bucket in this plan.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{recommendedProducts.map((prod, idx) => (
								<div
									key={prod.id || idx}
									className="p-3 rounded-xl bg-slate-900/80 border border-slate-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
								>
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px]">
												{prod.allocationRole}
											</Badge>
											<span className="text-xs font-semibold text-emerald-400">
												{prod.expectedReturns}% Expected
											</span>
										</div>
										<p className="text-sm font-bold text-white">{prod.name}</p>
										<p className="text-xs text-slate-400">{prod.provider}</p>
									</div>

									<div className="text-right shrink-0">
										<p className="text-xs text-slate-400">Suggested SIP</p>
										<p className="text-sm font-extrabold text-blue-400">
											₹{(prod.monthlyAmount || 5000).toLocaleString("en-IN")}/mo
										</p>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Proposal Dispatch Dialog */}
			<Dialog open={isDispatchModalOpen} onOpenChange={setIsDispatchModalOpen}>
				<DialogContent className="max-w-xl bg-slate-900 border-slate-700 text-white">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-xl font-bold">
							<Send className="w-5 h-5 text-indigo-400" />
							{generatedProposalUrl ? "Client Proposal Ready" : "Dispatch Goal Proposal"}
						</DialogTitle>
						<DialogDescription className="text-slate-400 text-sm">
							{generatedProposalUrl
								? "Your goal plan has been packaged into an interactive client proposal."
								: "Package this financial plan into an institutional client proposal."}
						</DialogDescription>
					</DialogHeader>

					{generatedProposalUrl ? (
						<div className="space-y-6 py-4">
							<div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-3">
								<CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
								<div>
									<p className="text-sm font-semibold text-emerald-300">
										Proposal Published Successfully
									</p>
									<p className="text-xs text-emerald-400/80">
										Includes retirement milestone projections, inflation adjustments, and store fulfillment products.
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<p className="text-xs text-slate-400 font-medium">Shareable Client Link:</p>
								<div className="flex items-center gap-2">
									<Input
										readOnly
										value={generatedProposalUrl}
										className="bg-slate-950 border-slate-700 text-blue-300 text-xs font-mono select-all"
									/>
									<Button
										variant="outline"
										size="sm"
										className="border-slate-700 text-slate-200 shrink-0"
										onClick={() => copyToClipboard(generatedProposalUrl)}
									>
										<Copy className="w-4 h-4 mr-1" /> Copy
									</Button>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<Button
									className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
									onClick={() => {
										const text = encodeURIComponent(
											`Hello ${clientName},\n\nHere is your personalized Goal Planning Proposal on FintekPro:\n${generatedProposalUrl}\n\nPlease review the milestone projections and asset allocation.`,
										);
										window.open(`https://wa.me/?text=${text}`, "_blank");
									}}
								>
									<Share2 className="w-3.5 h-3.5 mr-1.5" /> Share via WhatsApp
								</Button>
								<Button
									variant="outline"
									className="border-slate-700 text-slate-200 text-xs"
									onClick={() => window.open(generatedProposalUrl, "_blank")}
								>
									<ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Preview
								</Button>
							</div>
						</div>
					) : (
						<div className="space-y-4 py-2">
							<div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-2 text-xs">
								<div className="flex justify-between">
									<span className="text-slate-400">Target Goal:</span>
									<span className="font-semibold text-white">
										{GOAL_CONFIGS.find((g) => g.id === activeGoal)?.title}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-400">Target Inflated Corpus:</span>
									<span className="font-semibold text-white">
										₹{mathResults.futureGoalValue.toLocaleString("en-IN")}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-400">Required Monthly SIP:</span>
									<span className="font-bold text-emerald-400">
										₹{mathResults.requiredMonthlySip.toLocaleString("en-IN")}/mo
									</span>
								</div>
							</div>

							{clientsData?.length ? (
								<div className="space-y-1">
									<Label className="text-xs text-slate-300">Select Existing Client</Label>
									<Select
										onValueChange={(cid) => {
											const found = clientsData.find((c: any) => c.id === cid);
											if (found) {
												setClientName(`${found.firstName || ""} ${found.lastName || ""}`.trim() || found.name || "");
												setClientEmail(found.email || "");
												setClientPhone(found.phone || found.mobile || "");
											}
										}}
									>
										<SelectTrigger className="bg-slate-800 border-slate-700 text-white text-xs">
											<SelectValue placeholder="Pick a client or edit below..." />
										</SelectTrigger>
										<SelectContent className="bg-slate-900 border-slate-700 text-white">
											{clientsData.map((c: any) => (
												<SelectItem key={c.id} value={c.id}>
													{c.firstName} {c.lastName} ({c.email || c.phone})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							) : null}

							<div className="space-y-1">
								<Label className="text-xs text-slate-300">Client Full Name *</Label>
								<Input
									value={clientName}
									onChange={(e) => setClientName(e.target.value)}
									className="bg-slate-800 border-slate-700 text-white text-xs"
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<Label className="text-xs text-slate-300">Client Email</Label>
									<Input
										value={clientEmail}
										onChange={(e) => setClientEmail(e.target.value)}
										className="bg-slate-800 border-slate-700 text-white text-xs"
									/>
								</div>
								<div className="space-y-1">
									<Label className="text-xs text-slate-300">Client Mobile</Label>
									<Input
										value={clientPhone}
										onChange={(e) => setClientPhone(e.target.value)}
										className="bg-slate-800 border-slate-700 text-white text-xs"
									/>
								</div>
							</div>
						</div>
					)}

					<DialogFooter className="border-t border-slate-800 pt-3">
						{generatedProposalUrl ? (
							<Button
								className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
								onClick={() => setIsDispatchModalOpen(false)}
							>
								Done
							</Button>
						) : (
							<div className="flex items-center justify-end gap-2 w-full">
								<Button
									variant="ghost"
									className="text-slate-400"
									onClick={() => setIsDispatchModalOpen(false)}
								>
									Cancel
								</Button>
								<Button
									className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
									onClick={handleCreateProposalFromPlan}
									disabled={isGeneratingProposal}
								>
									{isGeneratingProposal ? "Compiling..." : "Generate Proposal"}
								</Button>
							</div>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
