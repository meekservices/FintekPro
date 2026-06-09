import { useState, useEffect } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Search,
	TrendingUp,
	TrendingDown,
	Star,
	Plus,
	X,
	BarChart3,
	PieChart,
	Target,
	AlertCircle,
	CheckCircle,
	ArrowUpRight,
	ArrowDownRight,
	Shuffle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
	useMutualFunds,
	useSearchMutualFunds,
	type MutualFundData,
} from "@/hooks/use-mutual-funds";
import { useToast } from "@/hooks/use-toast";

interface FundComparisonResult {
	funds: Array<{
		schemeCode: string;
		schemeName: string;
		fundHouse: string;
		category: string;
		currentNAV: number;
		returns: {
			"1M": number;
			"6M": number;
			"1Y": number;
			"3Y": number;
			"5Y": number;
		};
		volatility: number;
		sharpeRatio: number;
		alpha: number;
		beta: number;
		maxDrawdown: number;
		expenseRatio: number;
		aum: number;
		smartRating: number;
	}>;
	summary: {
		bestPerformer: string;
		mostStable: string;
		highestSharpe: string;
		lowestExpense: string;
	};
	aiInsights: string;
	recommendationScore: number;
}

function FundSearchInput({
	onFundSelect,
	selectedFunds,
}: {
	onFundSelect: (fund: MutualFundData) => void;
	selectedFunds: MutualFundData[];
}) {
	const [searchTerm, setSearchTerm] = useState("");
	const { data: searchResults, isLoading } = useSearchMutualFunds(searchTerm);

	const filteredResults =
		searchResults
			?.filter(
				(fund) =>
					!selectedFunds.some(
						(selected) => selected.schemeCode === fund.schemeCode,
					),
			)
			.slice(0, 5) || [];

	return (
		<div className="relative">
			<div className="relative">
				<Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
				<Input
					placeholder="Search for mutual funds to compare..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="pl-10"
					data-testid="input-fund-search"
				/>
			</div>

			{searchTerm && (
				<div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
					{isLoading ? (
						<div className="p-4">
							<Skeleton className="h-4 w-full mb-2" />
							<Skeleton className="h-4 w-3/4" />
						</div>
					) : filteredResults.length > 0 ? (
						filteredResults.map((fund) => (
							<button
								key={fund.schemeCode}
								onClick={() => {
									onFundSelect(fund);
									setSearchTerm("");
								}}
								className="w-full text-left p-3 hover:bg-muted border-b border-border last:border-b-0"
								data-testid={`fund-option-${fund.schemeCode}`}
							>
								<div className="font-medium text-foreground">
									{fund.schemeName}
								</div>
								<div className="text-sm text-muted-foreground">
									{fund.fundHouse} • NAV: ₹{fund.nav}
								</div>
							</button>
						))
					) : (
						<div className="p-4 text-center text-muted-foreground">
							No funds found
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function SelectedFundCard({
	fund,
	onRemove,
}: { fund: MutualFundData; onRemove: () => void }) {
	const navValue = Number.parseFloat(fund.nav || "0");
	const changeValue = Number.parseFloat(fund.change || "0");
	const changePercent = Number.parseFloat(fund.changePercent || "0");

	return (
		<Card
			className="border border-border"
			data-testid={`selected-fund-${fund.schemeCode}`}
		>
			<CardContent className="p-4">
				<div className="flex justify-between items-start mb-2">
					<div className="flex-1">
						<h3 className="font-semibold text-sm line-clamp-2">
							{fund.schemeName}
						</h3>
						<p className="text-xs text-muted-foreground">{fund.fundHouse}</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={onRemove}
						className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
						data-testid={`button-remove-fund-${fund.schemeCode}`}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="space-y-1">
					<div className="flex justify-between">
						<span className="text-xs text-muted-foreground">NAV</span>
						<span className="text-sm font-medium">₹{navValue.toFixed(2)}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-xs text-muted-foreground">Change</span>
						<span
							className={`text-sm font-medium ${changeValue >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{changeValue >= 0 ? "+" : ""}₹{changeValue.toFixed(2)} (
							{changePercent.toFixed(2)}%)
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function ComparisonResults({
	comparison,
}: { comparison: FundComparisonResult }) {
	return (
		<div className="space-y-6">
			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
					<CardContent className="p-4">
						<div className="flex items-center gap-2 mb-1">
							<TrendingUp className="h-4 w-4 text-green-600" />
							<span className="text-xs font-medium text-green-700 dark:text-green-300">
								Best Performer
							</span>
						</div>
						<p className="text-sm font-semibold text-green-800 dark:text-green-200">
							{comparison.summary.bestPerformer}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
					<CardContent className="p-4">
						<div className="flex items-center gap-2 mb-1">
							<BarChart3 className="h-4 w-4 text-blue-600" />
							<span className="text-xs font-medium text-blue-700 dark:text-blue-300">
								Most Stable
							</span>
						</div>
						<p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
							{comparison.summary.mostStable}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
					<CardContent className="p-4">
						<div className="flex items-center gap-2 mb-1">
							<Target className="h-4 w-4 text-purple-600" />
							<span className="text-xs font-medium text-purple-700 dark:text-purple-300">
								Highest Sharpe
							</span>
						</div>
						<p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
							{comparison.summary.highestSharpe}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
					<CardContent className="p-4">
						<div className="flex items-center gap-2 mb-1">
							<PieChart className="h-4 w-4 text-orange-600" />
							<span className="text-xs font-medium text-orange-700 dark:text-orange-300">
								Lowest Expense
							</span>
						</div>
						<p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
							{comparison.summary.lowestExpense}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* AI Insights */}
			<Card className="bg-gradient-to-br from-finance-blue/5 to-finance-blue/10 border-finance-blue/20">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-finance-blue">
						<Star className="h-5 w-5" />
						AI Investment Insights
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground leading-relaxed">
						{comparison.aiInsights}
					</p>
					<div className="mt-4 flex items-center gap-2">
						<Badge
							variant="secondary"
							className="bg-finance-blue/10 text-finance-blue"
						>
							Recommendation Score: {comparison.recommendationScore}/100
						</Badge>
					</div>
				</CardContent>
			</Card>

			{/* Detailed Comparison Table */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Detailed Comparison
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border">
									<th className="text-left p-2 font-medium text-muted-foreground">
										Metric
									</th>
									{comparison.funds.map((fund, index) => (
										<th
											key={fund.schemeCode}
											className="text-center p-2 font-medium text-muted-foreground"
										>
											Fund {index + 1}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								<tr className="border-b border-border">
									<td className="p-2 font-medium">Fund Name</td>
									{comparison.funds.map((fund) => (
										<td
											key={fund.schemeCode}
											className="p-2 text-center text-xs"
										>
											<div className="font-medium">
												{fund.schemeName.slice(0, 30)}...
											</div>
											<div className="text-muted-foreground">
												{fund.fundHouse}
											</div>
										</td>
									))}
								</tr>
								<tr className="border-b border-border">
									<td className="p-2 font-medium">Current NAV</td>
									{comparison.funds.map((fund) => (
										<td
											key={fund.schemeCode}
											className="p-2 text-center font-medium"
										>
											₹{fund.currentNAV.toFixed(2)}
										</td>
									))}
								</tr>
								<tr className="border-b border-border">
									<td className="p-2 font-medium">1Y Returns</td>
									{comparison.funds.map((fund) => (
										<td key={fund.schemeCode} className="p-2 text-center">
											<span
												className={
													fund.returns["1Y"] >= 0
														? "text-green-600"
														: "text-red-600"
												}
											>
												{fund.returns["1Y"].toFixed(2)}%
											</span>
										</td>
									))}
								</tr>
								<tr className="border-b border-border">
									<td className="p-2 font-medium">3Y Returns</td>
									{comparison.funds.map((fund) => (
										<td key={fund.schemeCode} className="p-2 text-center">
											<span
												className={
													fund.returns["3Y"] >= 0
														? "text-green-600"
														: "text-red-600"
												}
											>
												{fund.returns["3Y"].toFixed(2)}%
											</span>
										</td>
									))}
								</tr>
								<tr className="border-b border-border">
									<td className="p-2 font-medium">Sharpe Ratio</td>
									{comparison.funds.map((fund) => (
										<td key={fund.schemeCode} className="p-2 text-center">
											{fund.sharpeRatio.toFixed(2)}
										</td>
									))}
								</tr>
								<tr className="border-b border-border">
									<td className="p-2 font-medium">Volatility</td>
									{comparison.funds.map((fund) => (
										<td key={fund.schemeCode} className="p-2 text-center">
											{fund.volatility.toFixed(2)}%
										</td>
									))}
								</tr>
								<tr className="border-b border-border">
									<td className="p-2 font-medium">Expense Ratio</td>
									{comparison.funds.map((fund) => (
										<td key={fund.schemeCode} className="p-2 text-center">
											{fund.expenseRatio?.toFixed(2) || "N/A"}%
										</td>
									))}
								</tr>
								<tr className="border-b border-border">
									<td className="p-2 font-medium">AUM</td>
									{comparison.funds.map((fund) => (
										<td key={fund.schemeCode} className="p-2 text-center">
											{fund.aum
												? `₹${(fund.aum / 10000000).toFixed(0)} Cr`
												: "N/A"}
										</td>
									))}
								</tr>
								<tr>
									<td
										className="p-2 font-medium"
										title="FintekPro Smart Rating - Calculated using risk-adjusted returns, asset quality, liquidity, and concentration metrics"
									>
										FintekPro Rating
									</td>
									{comparison.funds.map((fund) => (
										<td key={fund.schemeCode} className="p-2 text-center">
											<div className="flex justify-center">
												{fund.smartRating ? (
													<div
														className="flex"
														title={`${fund.smartRating}-star FintekPro Smart Rating`}
													>
														{[...Array(5)].map((_, i) => (
															<Star
																key={i}
																className={`h-3 w-3 ${i < fund.smartRating ? "text-yellow-400 fill-current" : "text-muted-foreground"}`}
															/>
														))}
													</div>
												) : (
													"N/A"
												)}
											</div>
										</td>
									))}
								</tr>
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default function FundComparison() {
	const [selectedFunds, setSelectedFunds] = useState<MutualFundData[]>([]);
	const [timePeriod, setTimePeriod] = useState("1Y");
	const [comparisonResult, setComparisonResult] =
		useState<FundComparisonResult | null>(null);
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const compareMutation = useMutation({
		mutationFn: async (data: {
			fundCodes: string[];
			timePeriod: string;
			comparisonType: string;
		}) => {
			const response = await fetch("/api/funds/compare", {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok) throw new Error("Failed to compare funds");
			return response.json();
		},
		onSuccess: (data) => {
			setComparisonResult(data.data);
			toast({
				title: "Comparison Complete",
				description:
					"Fund comparison analysis has been generated successfully.",
			});
		},
		onError: (error) => {
			toast({
				title: "Comparison Failed",
				description: "Failed to generate fund comparison. Please try again.",
				variant: "destructive",
			});
			console.error("Comparison error:", error);
		},
	});

	const handleFundSelect = (fund: MutualFundData) => {
		if (selectedFunds.length >= 5) {
			toast({
				title: "Maximum Limit Reached",
				description: "You can compare up to 5 funds at once.",
				variant: "destructive",
			});
			return;
		}
		setSelectedFunds([...selectedFunds, fund]);
	};

	const handleFundRemove = (fundCode: string) => {
		setSelectedFunds(
			selectedFunds.filter((fund) => fund.schemeCode !== fundCode),
		);
	};

	const handleCompare = () => {
		if (selectedFunds.length < 2) {
			toast({
				title: "Insufficient Funds",
				description: "Please select at least 2 funds to compare.",
				variant: "destructive",
			});
			return;
		}

		compareMutation.mutate({
			fundCodes: selectedFunds.map((fund) => fund.schemeCode),
			timePeriod,
			comparisonType: "detailed",
		});
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="text-center space-y-2">
				<h1 className="text-3xl font-bold text-foreground">Fund Comparison</h1>
				<p className="text-muted-foreground">
					Compare mutual funds side-by-side with AI-powered insights
				</p>
			</div>

			{/* Fund Selection */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Search className="h-5 w-5" />
						Select Funds to Compare
					</CardTitle>
					<CardDescription>
						Search and select up to 5 mutual funds for detailed comparison
						analysis
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<FundSearchInput
						onFundSelect={handleFundSelect}
						selectedFunds={selectedFunds}
					/>

					{selectedFunds.length > 0 && (
						<div>
							<div className="flex items-center justify-between mb-3">
								<h3 className="font-medium text-foreground">
									Selected Funds ({selectedFunds.length}/5)
								</h3>
								<div className="flex items-center gap-2">
									<Select value={timePeriod} onValueChange={setTimePeriod}>
										<SelectTrigger className="w-32">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="1M">1 Month</SelectItem>
											<SelectItem value="6M">6 Months</SelectItem>
											<SelectItem value="1Y">1 Year</SelectItem>
											<SelectItem value="3Y">3 Years</SelectItem>
											<SelectItem value="5Y">5 Years</SelectItem>
										</SelectContent>
									</Select>
									<Button
										onClick={handleCompare}
										disabled={
											selectedFunds.length < 2 || compareMutation.isPending
										}
										className="bg-finance-blue hover:bg-finance-blue/90"
										data-testid="button-compare-funds"
									>
										{compareMutation.isPending
											? "Comparing..."
											: "Compare Funds"}
									</Button>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
								{selectedFunds.map((fund) => (
									<SelectedFundCard
										key={fund.schemeCode}
										fund={fund}
										onRemove={() => handleFundRemove(fund.schemeCode)}
									/>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Comparison Results */}
			{comparisonResult && <ComparisonResults comparison={comparisonResult} />}

			{/* Empty State */}
			{selectedFunds.length === 0 && !comparisonResult && (
				<Card className="text-center py-12">
					<CardContent>
						<BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-lg font-medium text-foreground mb-2">
							Start Comparing Funds
						</h3>
						<p className="text-muted-foreground mb-4">
							Search and select mutual funds above to begin your comparison
							analysis
						</p>
						<div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
							<div className="flex items-center gap-1">
								<CheckCircle className="h-4 w-4 text-green-500" />
								Performance Metrics
							</div>
							<div className="flex items-center gap-1">
								<CheckCircle className="h-4 w-4 text-green-500" />
								Risk Analysis
							</div>
							<div className="flex items-center gap-1">
								<CheckCircle className="h-4 w-4 text-green-500" />
								AI Insights
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
