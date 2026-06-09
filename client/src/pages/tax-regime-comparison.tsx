import { useState, useMemo } from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Calculator,
	TrendingUp,
	TrendingDown,
	CheckCircle2,
	AlertCircle,
	ArrowRight,
	RefreshCw,
	Info,
	Scale,
	IndianRupee,
	Loader2,
	Download,
	FileText,
	PieChart,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TaxCalculation {
	grossIncome: number;
	deductions: number;
	taxableIncome: number;
	tax: number;
	cess: number;
	totalTax: number;
	effectiveRate: number;
}

const OLD_REGIME_SLABS = [
	{ min: 0, max: 250000, rate: 0 },
	{ min: 250000, max: 500000, rate: 5 },
	{ min: 500000, max: 1000000, rate: 20 },
	{ min: 1000000, max: Number.POSITIVE_INFINITY, rate: 30 },
];

const NEW_REGIME_SLABS_2024 = [
	{ min: 0, max: 300000, rate: 0 },
	{ min: 300000, max: 700000, rate: 5 },
	{ min: 700000, max: 1000000, rate: 10 },
	{ min: 1000000, max: 1200000, rate: 15 },
	{ min: 1200000, max: 1500000, rate: 20 },
	{ min: 1500000, max: Number.POSITIVE_INFINITY, rate: 30 },
];

export default function TaxRegimeComparison() {
	const { isAuthenticated } = useAuth();

	const [grossIncome, setGrossIncome] = useState<string>("1500000");
	const [section80C, setSection80C] = useState<string>("150000");
	const [section80D, setSection80D] = useState<string>("25000");
	const [hra, setHra] = useState<string>("200000");
	const [homeLoan, setHomeLoan] = useState<string>("100000");
	const [nps, setNps] = useState<string>("50000");
	const [otherDeductions, setOtherDeductions] = useState<string>("0");

	const calculateTax = (
		income: number,
		slabs: typeof OLD_REGIME_SLABS,
	): number => {
		let tax = 0;
		let remaining = income;

		for (const slab of slabs) {
			if (remaining <= 0) break;
			const taxableInSlab = Math.min(remaining, slab.max - slab.min);
			tax += taxableInSlab * (slab.rate / 100);
			remaining -= taxableInSlab;
		}

		return tax;
	};

	const oldRegimeCalc = useMemo((): TaxCalculation => {
		const gross = Number.parseFloat(grossIncome) || 0;
		const deductions =
			(Number.parseFloat(section80C) || 0) +
			(Number.parseFloat(section80D) || 0) +
			(Number.parseFloat(hra) || 0) +
			(Number.parseFloat(homeLoan) || 0) +
			(Number.parseFloat(nps) || 0) +
			(Number.parseFloat(otherDeductions) || 0);

		const standardDeduction = 50000;
		const taxableIncome = Math.max(0, gross - deductions - standardDeduction);
		const tax = calculateTax(taxableIncome, OLD_REGIME_SLABS);

		const rebate = taxableIncome <= 500000 ? Math.min(tax, 12500) : 0;
		const taxAfterRebate = tax - rebate;
		const cess = taxAfterRebate * 0.04;
		const totalTax = taxAfterRebate + cess;
		const effectiveRate = gross > 0 ? (totalTax / gross) * 100 : 0;

		return {
			grossIncome: gross,
			deductions: deductions + standardDeduction,
			taxableIncome,
			tax: taxAfterRebate,
			cess,
			totalTax,
			effectiveRate,
		};
	}, [
		grossIncome,
		section80C,
		section80D,
		hra,
		homeLoan,
		nps,
		otherDeductions,
	]);

	const newRegimeCalc = useMemo((): TaxCalculation => {
		const gross = Number.parseFloat(grossIncome) || 0;
		const standardDeduction = 75000;
		const taxableIncome = Math.max(0, gross - standardDeduction);
		const tax = calculateTax(taxableIncome, NEW_REGIME_SLABS_2024);

		const rebate = taxableIncome <= 700000 ? Math.min(tax, 25000) : 0;
		const taxAfterRebate = tax - rebate;
		const cess = taxAfterRebate * 0.04;
		const totalTax = taxAfterRebate + cess;
		const effectiveRate = gross > 0 ? (totalTax / gross) * 100 : 0;

		return {
			grossIncome: gross,
			deductions: standardDeduction,
			taxableIncome,
			tax: taxAfterRebate,
			cess,
			totalTax,
			effectiveRate,
		};
	}, [grossIncome]);

	const savings = newRegimeCalc.totalTax - oldRegimeCalc.totalTax;
	const recommendation = savings > 0 ? "old" : savings < 0 ? "new" : "either";

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(value);
	};

	const { toast } = useToast();

	const regimeComparisonMutation = useMutation({
		mutationFn: async (data: {
			salaryIncome: number;
			otherIncome: number;
			deductions80C: number;
			deductions80D: number;
			homeLoanInterest: number;
		}) => {
			const response = await apiRequest("/api/tax/regime-comparison", {
				method: "POST",
				body: JSON.stringify(data),
			});
			return response;
		},
		onSuccess: (data) => {
			toast({
				title: "Comparison Complete",
				description: `${data.recommendation?.regime === "new" ? "New" : "Old"} regime saves you ${formatCurrency(data.recommendation?.savings || 0)}`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Comparison Failed",
				description: error.message || "Could not compare tax regimes",
				variant: "destructive",
			});
		},
	});

	const taxPnlMutation = useMutation({
		mutationFn: async () => {
			const response = await apiRequest("/api/tax/pnl-report", {
				method: "POST",
				body: JSON.stringify({ format: "json" }),
			});
			return response;
		},
		onSuccess: (data) => {
			const blob = new Blob([JSON.stringify(data.data, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `tax-pnl-report-${data.data?.fiscalYear || "current"}.json`;
			a.click();
			URL.revokeObjectURL(url);
			toast({
				title: "Report Downloaded",
				description: "Your Tax P&L report has been downloaded",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Download Failed",
				description: error.message || "Could not generate report",
				variant: "destructive",
			});
		},
	});

	const handleServerComparison = () => {
		regimeComparisonMutation.mutate({
			salaryIncome: Number.parseFloat(grossIncome) || 0,
			otherIncome: 0,
			deductions80C: Number.parseFloat(section80C) || 0,
			deductions80D: Number.parseFloat(section80D) || 0,
			homeLoanInterest: Number.parseFloat(homeLoan) || 0,
		});
	};

	const capitalGainsBreakdown =
		regimeComparisonMutation.data?.capitalGainsBreakdown;
	const serverComparison = regimeComparisonMutation.data?.comparison;
	const serverRecommendation = regimeComparisonMutation.data?.recommendation;

	const displayOldRegime = serverComparison?.oldRegime || oldRegimeCalc;
	const displayNewRegime = serverComparison?.newRegime || newRegimeCalc;
	const displayRecommendation = serverRecommendation?.regime || recommendation;
	const displaySavings =
		serverRecommendation?.savings !== undefined
			? serverRecommendation.savings
			: Math.abs(savings);
	const hasServerData = !!serverComparison;

	return (
		<div
			className="container py-8 space-y-6"
			data-testid="tax-regime-comparison-page"
		>
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-2">
						<Scale className="h-8 w-8 text-blue-500" />
						Tax Regime Comparison
					</h1>
					<p className="text-muted-foreground mt-1">
						Compare old vs new tax regime to optimize your tax liability
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={handleServerComparison}
						disabled={regimeComparisonMutation.isPending}
						variant="default"
						data-testid="btn-compare-with-portfolio"
					>
						{regimeComparisonMutation.isPending && (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						)}
						<PieChart className="h-4 w-4 mr-2" />
						Include Portfolio Gains
					</Button>
					<Button
						onClick={() => taxPnlMutation.mutate()}
						disabled={taxPnlMutation.isPending}
						variant="outline"
						data-testid="btn-download-pnl"
					>
						{taxPnlMutation.isPending && (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						)}
						<Download className="h-4 w-4 mr-2" />
						Tax P&L Report
					</Button>
				</div>
			</div>

			{hasServerData && (
				<Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
					<CheckCircle2 className="h-4 w-4 text-blue-600" />
					<AlertTitle>Portfolio-Inclusive Comparison</AlertTitle>
					<AlertDescription>
						Results below include your realized capital gains from investments.{" "}
						{serverRecommendation?.explanation}
					</AlertDescription>
				</Alert>
			)}

			{capitalGainsBreakdown && (
				<Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
					<CardHeader className="pb-2">
						<CardTitle className="text-base flex items-center gap-2">
							<PieChart className="h-4 w-4 text-orange-600" />
							Capital Gains from Your Portfolio
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
							<div>
								<p className="text-muted-foreground">Short Term (STCG)</p>
								<p className="font-semibold">
									{formatCurrency(capitalGainsBreakdown.stcg?.amount || 0)}
								</p>
								<p className="text-xs text-orange-600">
									Tax: {formatCurrency(capitalGainsBreakdown.stcg?.tax || 0)} @
									20%
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Long Term (LTCG)</p>
								<p className="font-semibold">
									{formatCurrency(capitalGainsBreakdown.ltcg?.amount || 0)}
								</p>
								<p className="text-xs text-orange-600">
									Tax: {formatCurrency(capitalGainsBreakdown.ltcg?.tax || 0)} @
									12.5%
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">LTCG Exemption</p>
								<p className="font-semibold text-green-600">
									-{formatCurrency(capitalGainsBreakdown.ltcg?.exemption || 0)}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Total CG Tax</p>
								<p className="font-semibold text-red-600">
									{formatCurrency(capitalGainsBreakdown.totalTax || 0)}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Calculator className="h-5 w-5" />
							Income & Deductions
						</CardTitle>
						<CardDescription>
							Enter your income and eligible deductions
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="grossIncome">Gross Annual Income</Label>
							<div className="relative">
								<IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									id="grossIncome"
									type="number"
									value={grossIncome}
									onChange={(e) => setGrossIncome(e.target.value)}
									className="pl-9"
									data-testid="input-gross-income"
								/>
							</div>
						</div>

						<div className="pt-2 border-t">
							<p className="text-sm font-medium mb-3 text-muted-foreground">
								Old Regime Deductions
							</p>

							<div className="space-y-3">
								<div className="space-y-1">
									<Label htmlFor="section80C" className="text-sm">
										Section 80C (max 1.5L)
									</Label>
									<Input
										id="section80C"
										type="number"
										value={section80C}
										onChange={(e) => setSection80C(e.target.value)}
										placeholder="PPF, ELSS, LIC, etc."
										data-testid="input-80c"
									/>
								</div>

								<div className="space-y-1">
									<Label htmlFor="section80D" className="text-sm">
										Section 80D (Health Insurance)
									</Label>
									<Input
										id="section80D"
										type="number"
										value={section80D}
										onChange={(e) => setSection80D(e.target.value)}
										placeholder="Health insurance premium"
										data-testid="input-80d"
									/>
								</div>

								<div className="space-y-1">
									<Label htmlFor="hra" className="text-sm">
										HRA Exemption
									</Label>
									<Input
										id="hra"
										type="number"
										value={hra}
										onChange={(e) => setHra(e.target.value)}
										placeholder="House Rent Allowance"
										data-testid="input-hra"
									/>
								</div>

								<div className="space-y-1">
									<Label htmlFor="homeLoan" className="text-sm">
										Home Loan Interest (80EEA)
									</Label>
									<Input
										id="homeLoan"
										type="number"
										value={homeLoan}
										onChange={(e) => setHomeLoan(e.target.value)}
										placeholder="Max 2L under 24(b)"
										data-testid="input-home-loan"
									/>
								</div>

								<div className="space-y-1">
									<Label htmlFor="nps" className="text-sm">
										NPS (80CCD(1B))
									</Label>
									<Input
										id="nps"
										type="number"
										value={nps}
										onChange={(e) => setNps(e.target.value)}
										placeholder="Additional 50K NPS"
										data-testid="input-nps"
									/>
								</div>

								<div className="space-y-1">
									<Label htmlFor="otherDeductions" className="text-sm">
										Other Deductions
									</Label>
									<Input
										id="otherDeductions"
										type="number"
										value={otherDeductions}
										onChange={(e) => setOtherDeductions(e.target.value)}
										placeholder="80G, 80E, etc."
										data-testid="input-other"
									/>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card
					className={`border-2 ${displayRecommendation === "old" ? "border-green-500 bg-green-50/50 dark:bg-green-950/50" : ""}`}
				>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-lg">Old Tax Regime</CardTitle>
							{displayRecommendation === "old" && (
								<Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
									<CheckCircle2 className="h-3 w-3 mr-1" />
									Recommended
								</Badge>
							)}
						</div>
						<CardDescription>
							With deductions under various sections
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Gross Income</span>
								<span>{formatCurrency(oldRegimeCalc.grossIncome)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Total Deductions</span>
								<span className="text-green-600">
									- {formatCurrency(oldRegimeCalc.deductions)}
								</span>
							</div>
							<div className="flex justify-between font-medium border-t pt-2">
								<span>Taxable Income</span>
								<span>{formatCurrency(oldRegimeCalc.taxableIncome)}</span>
							</div>
						</div>

						<div className="p-4 bg-muted rounded-lg space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Income Tax</span>
								<span>{formatCurrency(oldRegimeCalc.tax)}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Cess (4%)</span>
								<span>{formatCurrency(oldRegimeCalc.cess)}</span>
							</div>
							<div className="flex justify-between font-bold text-lg border-t pt-2">
								<span>Total Tax</span>
								<span className="text-red-600">
									{formatCurrency(oldRegimeCalc.totalTax)}
								</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Effective Rate</span>
								<span>{oldRegimeCalc.effectiveRate.toFixed(1)}%</span>
							</div>
						</div>

						<div className="text-xs text-muted-foreground">
							<p className="font-medium mb-1">Tax Slabs:</p>
							<p>0-2.5L: 0% | 2.5-5L: 5% | 5-10L: 20% | 10L+: 30%</p>
						</div>
					</CardContent>
				</Card>

				<Card
					className={`border-2 ${displayRecommendation === "new" ? "border-green-500 bg-green-50/50 dark:bg-green-950/50" : ""}`}
				>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-lg">New Tax Regime (2024)</CardTitle>
							{displayRecommendation === "new" && (
								<Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
									<CheckCircle2 className="h-3 w-3 mr-1" />
									Recommended
								</Badge>
							)}
						</div>
						<CardDescription>
							Simplified slabs, limited deductions
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Gross Income</span>
								<span>{formatCurrency(newRegimeCalc.grossIncome)}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									Standard Deduction
								</span>
								<span className="text-green-600">
									- {formatCurrency(newRegimeCalc.deductions)}
								</span>
							</div>
							<div className="flex justify-between font-medium border-t pt-2">
								<span>Taxable Income</span>
								<span>{formatCurrency(newRegimeCalc.taxableIncome)}</span>
							</div>
						</div>

						<div className="p-4 bg-muted rounded-lg space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Income Tax</span>
								<span>{formatCurrency(newRegimeCalc.tax)}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Cess (4%)</span>
								<span>{formatCurrency(newRegimeCalc.cess)}</span>
							</div>
							<div className="flex justify-between font-bold text-lg border-t pt-2">
								<span>Total Tax</span>
								<span className="text-red-600">
									{formatCurrency(newRegimeCalc.totalTax)}
								</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Effective Rate</span>
								<span>{newRegimeCalc.effectiveRate.toFixed(1)}%</span>
							</div>
						</div>

						<div className="text-xs text-muted-foreground">
							<p className="font-medium mb-1">Tax Slabs:</p>
							<p>
								0-3L: 0% | 3-7L: 5% | 7-10L: 10% | 10-12L: 15% | 12-15L: 20% |
								15L+: 30%
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card
				className={`${
					displayRecommendation === "old"
						? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950"
						: displayRecommendation === "new"
							? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950"
							: ""
				}`}
			>
				<CardContent className="pt-6">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div className="flex items-center gap-4">
							{displayRecommendation === "old" ? (
								<TrendingDown className="h-10 w-10 text-green-600 dark:text-green-400" />
							) : displayRecommendation === "new" ? (
								<TrendingUp className="h-10 w-10 text-blue-600 dark:text-blue-400" />
							) : (
								<Scale className="h-10 w-10 text-muted-foreground" />
							)}
							<div>
								<h3 className="text-xl font-bold">
									{displayRecommendation === "old" &&
										"Old Regime saves you more!"}
									{displayRecommendation === "new" &&
										"New Regime is better for you!"}
									{displayRecommendation === "either" &&
										"Both regimes result in same tax"}
								</h3>
								<p className="text-muted-foreground">
									{displaySavings !== 0 && (
										<>
											You save {formatCurrency(displaySavings)} by choosing the{" "}
											{displayRecommendation === "old" ? "Old" : "New"} Regime
											{hasServerData && (
												<span className="ml-1 text-blue-600">
													(including portfolio)
												</span>
											)}
										</>
									)}
								</p>
							</div>
						</div>
						<div className="text-right">
							<p className="text-sm text-muted-foreground">
								Tax Difference{" "}
								{hasServerData && (
									<Badge variant="outline" className="ml-1 text-xs">
										With Portfolio
									</Badge>
								)}
							</p>
							<p
								className={`text-2xl font-bold ${displaySavings > 0 ? "text-green-600" : displaySavings < 0 ? "text-blue-600" : ""}`}
							>
								{displayRecommendation === "old"
									? "+"
									: displayRecommendation === "new"
										? "-"
										: ""}
								{formatCurrency(displaySavings)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Alert>
				<Info className="h-4 w-4" />
				<AlertTitle>Important Notes</AlertTitle>
				<AlertDescription>
					<ul className="list-disc list-inside mt-2 space-y-1 text-sm">
						<li>
							This is a simplified calculator for illustrative purposes only
						</li>
						<li>
							Actual tax liability may vary based on surcharge, specific
							exemptions, and other factors
						</li>
						<li>Consult a tax professional before making any decisions</li>
						<li>
							The new regime is the default option from FY 2023-24 onwards
						</li>
					</ul>
				</AlertDescription>
			</Alert>
		</div>
	);
}
