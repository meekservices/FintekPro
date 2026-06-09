import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	Calculator,
	Plus,
	Trash2,
	IndianRupee,
	TrendingUp,
	PieChart,
	Calendar,
	Percent,
	Wallet,
	Target,
} from "lucide-react";
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Legend,
} from "recharts";

interface CommissionRate {
	productType: string;
	trailCommission: number;
	upfrontCommission: number;
	minInvestment: number;
	description: string;
}

interface ScenarioItem {
	id: string;
	productType: string;
	aum: number;
	tenure: number;
}

const defaultCommissionRates: CommissionRate[] = [
	{
		productType: "Mutual Funds",
		trailCommission: 0.5,
		upfrontCommission: 1.0,
		minInvestment: 5000,
		description: "Equity & Debt MFs",
	},
	{
		productType: "Bonds",
		trailCommission: 0.25,
		upfrontCommission: 0.5,
		minInvestment: 10000,
		description: "Corporate & Government Bonds",
	},
	{
		productType: "Insurance",
		trailCommission: 2.0,
		upfrontCommission: 15.0,
		minInvestment: 25000,
		description: "Life & Health Insurance",
	},
	{
		productType: "Unlisted Stocks",
		trailCommission: 0.0,
		upfrontCommission: 2.5,
		minInvestment: 100000,
		description: "Pre-IPO & Private Equity",
	},
	{
		productType: "REITs",
		trailCommission: 0.3,
		upfrontCommission: 0.75,
		minInvestment: 50000,
		description: "Real Estate Investment Trusts",
	},
];

export default function AgentCommissionCalculator() {
	const [aum, setAum] = useState<string>("1000000");
	const [productType, setProductType] = useState<string>("Mutual Funds");
	const [tenure, setTenure] = useState<string>("12");
	const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);

	const { data: commissionRatesResponse } = useQuery<{
		rates: Record<
			string,
			{
				trailPercent: number;
				upfrontPercent: number;
				minInvestment: number;
				description: string;
			}
		>;
	}>({
		queryKey: ["/api/agent/commission-rates"],
	});

	// Transform API response from object format to array format
	const rates = useMemo(() => {
		if (!commissionRatesResponse?.rates) {
			return defaultCommissionRates;
		}

		const productTypeMapping: Record<string, string> = {
			mutual_funds: "Mutual Funds",
			bonds: "Bonds",
			insurance: "Insurance",
			unlisted_stocks: "Unlisted Stocks",
			reits: "REITs",
		};

		const transformed: CommissionRate[] = Object.entries(
			commissionRatesResponse.rates,
		).map(([key, value]) => ({
			productType: productTypeMapping[key] || key,
			trailCommission: value.trailPercent || 0,
			upfrontCommission: value.upfrontPercent || 0,
			minInvestment: value.minInvestment || 0,
			description: value.description || "",
		}));

		return transformed.length > 0 ? transformed : defaultCommissionRates;
	}, [commissionRatesResponse]);

	const formatCurrency = (value: number) => {
		if (value >= 10000000) {
			return `₹${(value / 10000000).toFixed(2)} Cr`;
		}
		if (value >= 100000) {
			return `₹${(value / 100000).toFixed(2)} L`;
		}
		if (value >= 1000) {
			return `₹${(value / 1000).toFixed(1)} K`;
		}
		return `₹${value.toLocaleString("en-IN")}`;
	};

	const formatInputCurrency = (value: string) => {
		const numValue = value.replace(/[^0-9]/g, "");
		if (!numValue) return "";
		return Number.parseInt(numValue).toLocaleString("en-IN");
	};

	const parseInputCurrency = (value: string) => {
		return value.replace(/[^0-9]/g, "");
	};

	const handleAumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const rawValue = parseInputCurrency(e.target.value);
		setAum(rawValue);
	};

	const ratesArray = Array.isArray(rates) ? rates : defaultCommissionRates;
	const currentRate =
		ratesArray.find((r) => r.productType === productType) ||
		ratesArray[0] ||
		defaultCommissionRates[0];
	const aumNumber = Number.parseInt(aum) || 0;
	const tenureMonths = Number.parseInt(tenure) || 12;

	const calculations = useMemo(() => {
		const trailAnnual = (aumNumber * currentRate.trailCommission) / 100;
		const upfront = (aumNumber * currentRate.upfrontCommission) / 100;
		const trailTotal = (trailAnnual / 12) * tenureMonths;
		const totalEarnings = upfront + trailTotal;
		const monthlyAverage = totalEarnings / tenureMonths;

		return {
			trailAnnual,
			upfront,
			trailTotal,
			totalEarnings,
			monthlyAverage,
		};
	}, [aumNumber, currentRate, tenureMonths]);

	const projectionData = useMemo(() => {
		const data = [];
		const monthlyTrail = calculations.trailAnnual / 12;
		let cumulative = calculations.upfront;

		for (let month = 1; month <= Math.min(tenureMonths, 60); month++) {
			cumulative += monthlyTrail;
			data.push({
				month: `M${month}`,
				earnings: Math.round(cumulative),
				trail: Math.round(monthlyTrail * month),
				upfront: Math.round(calculations.upfront),
			});
		}
		return data;
	}, [calculations, tenureMonths]);

	const addScenario = () => {
		const newScenario: ScenarioItem = {
			id: Date.now().toString(),
			productType,
			aum: aumNumber,
			tenure: tenureMonths,
		};
		setScenarios([...scenarios, newScenario]);
	};

	const removeScenario = (id: string) => {
		setScenarios(scenarios.filter((s) => s.id !== id));
	};

	const scenarioCalculations = useMemo(() => {
		return scenarios.map((scenario) => {
			const rate =
				rates.find((r) => r.productType === scenario.productType) || rates[0];
			const trailAnnual = (scenario.aum * rate.trailCommission) / 100;
			const upfront = (scenario.aum * rate.upfrontCommission) / 100;
			const trailTotal = (trailAnnual / 12) * scenario.tenure;
			const totalEarnings = upfront + trailTotal;
			return {
				...scenario,
				rate,
				trailAnnual,
				upfront,
				totalEarnings,
			};
		});
	}, [scenarios, rates]);

	const totalScenarioEarnings = scenarioCalculations.reduce(
		(sum, s) => sum + s.totalEarnings,
		0,
	);

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
					<div>
						<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
							<Calculator className="h-7 w-7 text-emerald-500" />
							Commission Calculator
						</h1>
						<p className="text-muted-foreground mt-1">
							Calculate your projected earnings based on AUM and product type
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<Card className="bg-background/50 border-border lg:col-span-1">
						<CardHeader>
							<CardTitle className="text-foreground flex items-center gap-2">
								<Target className="h-5 w-5 text-emerald-500" />
								Calculate Commission
							</CardTitle>
							<CardDescription className="text-muted-foreground">
								Enter investment details to see projections
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="aum" className="text-muted-foreground">
									AUM Amount
								</Label>
								<div className="relative">
									<IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										id="aum"
										type="text"
										value={formatInputCurrency(aum)}
										onChange={handleAumChange}
										placeholder="10,00,000"
										className="pl-9 bg-card border-border text-foreground"
										data-testid="input-aum"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="product-type" className="text-muted-foreground">
									Product Type
								</Label>
								<Select value={productType} onValueChange={setProductType}>
									<SelectTrigger
										className="bg-card border-border text-foreground"
										data-testid="select-product-type"
									>
										<SelectValue placeholder="Select product" />
									</SelectTrigger>
									<SelectContent className="bg-card border-border">
										{rates.map((rate) => (
											<SelectItem
												key={rate.productType}
												value={rate.productType}
											>
												{rate.productType}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="tenure" className="text-muted-foreground">
									Investment Tenure (months)
								</Label>
								<div className="relative">
									<Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										id="tenure"
										type="number"
										value={tenure}
										onChange={(e) => setTenure(e.target.value)}
										min="1"
										max="120"
										placeholder="12"
										className="pl-9 bg-card border-border text-foreground"
										data-testid="input-tenure"
									/>
								</div>
							</div>

							<Button
								onClick={addScenario}
								className="w-full bg-emerald-600 hover:bg-emerald-700"
								data-testid="button-add-scenario"
							>
								<Plus className="h-4 w-4 mr-2" />
								Add to Scenario Builder
							</Button>
						</CardContent>
					</Card>

					<Card className="bg-background/50 border-border lg:col-span-2">
						<CardHeader>
							<CardTitle className="text-foreground flex items-center gap-2">
								<Wallet className="h-5 w-5 text-emerald-500" />
								Projected Earnings
							</CardTitle>
							<CardDescription className="text-muted-foreground">
								Commission breakdown for {productType}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
								<div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 p-4 rounded-lg border border-emerald-700/50">
									<div className="flex items-center gap-2 mb-1">
										<Percent className="h-4 w-4 text-emerald-400" />
										<span className="text-sm text-emerald-300">
											Trail Commission
										</span>
									</div>
									<p
										className="text-xl font-bold text-foreground"
										data-testid="text-trail-rate"
									>
										{currentRate.trailCommission}% p.a.
									</p>
									<p
										className="text-sm text-muted-foreground"
										data-testid="text-trail-amount"
									>
										{formatCurrency(calculations.trailAnnual)}/year
									</p>
								</div>

								<div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 p-4 rounded-lg border border-blue-700/50">
									<div className="flex items-center gap-2 mb-1">
										<TrendingUp className="h-4 w-4 text-blue-400" />
										<span className="text-sm text-blue-300">
											Upfront Commission
										</span>
									</div>
									<p
										className="text-xl font-bold text-foreground"
										data-testid="text-upfront-rate"
									>
										{currentRate.upfrontCommission}%
									</p>
									<p
										className="text-sm text-muted-foreground"
										data-testid="text-upfront-amount"
									>
										{formatCurrency(calculations.upfront)} (one-time)
									</p>
								</div>

								<div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 p-4 rounded-lg border border-purple-700/50">
									<div className="flex items-center gap-2 mb-1">
										<PieChart className="h-4 w-4 text-purple-400" />
										<span className="text-sm text-purple-300">
											Total Earnings
										</span>
									</div>
									<p
										className="text-xl font-bold text-foreground"
										data-testid="text-total-earnings"
									>
										{formatCurrency(calculations.totalEarnings)}
									</p>
									<p className="text-sm text-muted-foreground">
										Over {tenureMonths} months
									</p>
								</div>

								<div className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 p-4 rounded-lg border border-amber-700/50">
									<div className="flex items-center gap-2 mb-1">
										<IndianRupee className="h-4 w-4 text-amber-400" />
										<span className="text-sm text-amber-300">
											Monthly Average
										</span>
									</div>
									<p
										className="text-xl font-bold text-foreground"
										data-testid="text-monthly-avg"
									>
										{formatCurrency(calculations.monthlyAverage)}
									</p>
									<p className="text-sm text-muted-foreground">Per month</p>
								</div>
							</div>

							<div className="h-64">
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart data={projectionData}>
										<defs>
											<linearGradient
												id="colorEarnings"
												x1="0"
												y1="0"
												x2="0"
												y2="1"
											>
												<stop
													offset="5%"
													stopColor="#10b981"
													stopOpacity={0.4}
												/>
												<stop
													offset="95%"
													stopColor="#10b981"
													stopOpacity={0}
												/>
											</linearGradient>
										</defs>
										<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
										<XAxis
											dataKey="month"
											stroke="#9ca3af"
											tick={{ fontSize: 12 }}
											interval={Math.floor(tenureMonths / 6)}
										/>
										<YAxis
											stroke="#9ca3af"
											tickFormatter={(value) => formatCurrency(value)}
											tick={{ fontSize: 12 }}
										/>
										<Tooltip
											contentStyle={{
												backgroundColor: "#1e293b",
												border: "1px solid #475569",
												borderRadius: "8px",
											}}
											labelStyle={{ color: "#fff" }}
											formatter={(value: number) => [
												formatCurrency(value),
												"Cumulative Earnings",
											]}
										/>
										<Area
											type="monotone"
											dataKey="earnings"
											stroke="#10b981"
											strokeWidth={2}
											fillOpacity={1}
											fill="url(#colorEarnings)"
											name="Cumulative Earnings"
										/>
									</AreaChart>
								</ResponsiveContainer>
							</div>
						</CardContent>
					</Card>
				</div>

				<Card className="bg-background/50 border-border">
					<CardHeader>
						<CardTitle className="text-foreground flex items-center gap-2">
							<IndianRupee className="h-5 w-5 text-emerald-500" />
							Commission Rate Reference
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							Standard commission rates by product category
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow className="border-border">
									<TableHead className="text-muted-foreground">
										Product Type
									</TableHead>
									<TableHead className="text-muted-foreground">
										Description
									</TableHead>
									<TableHead className="text-muted-foreground text-center">
										Trail Commission
									</TableHead>
									<TableHead className="text-muted-foreground text-center">
										Upfront Commission
									</TableHead>
									<TableHead className="text-muted-foreground text-right">
										Min Investment
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rates.map((rate) => (
									<TableRow
										key={rate.productType}
										className={`border-border ${rate.productType === productType ? "bg-emerald-900/20" : ""}`}
										data-testid={`row-rate-${rate.productType.toLowerCase().replace(/\s+/g, "-")}`}
									>
										<TableCell className="text-foreground font-medium">
											<div className="flex items-center gap-2">
												{rate.productType}
												{rate.productType === productType && (
													<Badge className="bg-emerald-600 text-xs">
														Selected
													</Badge>
												)}
											</div>
										</TableCell>
										<TableCell className="text-muted-foreground">
											{rate.description}
										</TableCell>
										<TableCell className="text-center">
											<Badge
												variant="outline"
												className="border-emerald-600 text-emerald-400"
											>
												{rate.trailCommission}% p.a.
											</Badge>
										</TableCell>
										<TableCell className="text-center">
											<Badge
												variant="outline"
												className="border-blue-600 text-blue-400"
											>
												{rate.upfrontCommission}%
											</Badge>
										</TableCell>
										<TableCell className="text-right text-muted-foreground">
											{formatCurrency(rate.minInvestment)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{scenarios.length > 0 && (
					<Card className="bg-background/50 border-border">
						<CardHeader>
							<CardTitle className="text-foreground flex items-center gap-2">
								<Calculator className="h-5 w-5 text-emerald-500" />
								What-If Scenario Builder
							</CardTitle>
							<CardDescription className="text-muted-foreground">
								Compare earnings across multiple product combinations
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow className="border-border">
										<TableHead className="text-muted-foreground">
											Product
										</TableHead>
										<TableHead className="text-muted-foreground text-right">
											AUM
										</TableHead>
										<TableHead className="text-muted-foreground text-center">
											Tenure
										</TableHead>
										<TableHead className="text-muted-foreground text-right">
											Upfront
										</TableHead>
										<TableHead className="text-muted-foreground text-right">
											Trail (Annual)
										</TableHead>
										<TableHead className="text-muted-foreground text-right">
											Total Earnings
										</TableHead>
										<TableHead className="text-muted-foreground w-12" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{scenarioCalculations.map((scenario) => (
										<TableRow
											key={scenario.id}
											className="border-border"
											data-testid={`row-scenario-${scenario.id}`}
										>
											<TableCell className="text-foreground font-medium">
												{scenario.productType}
											</TableCell>
											<TableCell className="text-right text-muted-foreground">
												{formatCurrency(scenario.aum)}
											</TableCell>
											<TableCell className="text-center text-muted-foreground">
												{scenario.tenure} mo
											</TableCell>
											<TableCell className="text-right text-blue-400">
												{formatCurrency(scenario.upfront)}
											</TableCell>
											<TableCell className="text-right text-emerald-400">
												{formatCurrency(scenario.trailAnnual)}
											</TableCell>
											<TableCell className="text-right text-foreground font-bold">
												{formatCurrency(scenario.totalEarnings)}
											</TableCell>
											<TableCell>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => removeScenario(scenario.id)}
													className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
													data-testid={`button-remove-scenario-${scenario.id}`}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TableCell>
										</TableRow>
									))}
									<TableRow className="border-border bg-emerald-900/20">
										<TableCell
											colSpan={5}
											className="text-right text-emerald-300 font-medium"
										>
											Total Projected Earnings:
										</TableCell>
										<TableCell
											className="text-right text-foreground font-bold text-lg"
											data-testid="text-scenario-total"
										>
											{formatCurrency(totalScenarioEarnings)}
										</TableCell>
										<TableCell />
									</TableRow>
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
