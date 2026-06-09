import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Calculator, TrendingUp, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface EligibilityResult {
	isEligible: boolean;
	maxLoanAmount: number;
	portfolioValue: number;
	loanToValue: string;
	interestRate: string;
	processingFee: number;
	emi: number;
	totalInterest: number;
	totalPayment: number;
}

export function LoanEligibilityCalculator() {
	const [portfolioId, setPortfolioId] = useState("");
	const [requestedAmount, setRequestedAmount] = useState("");
	const [tenure, setTenure] = useState("12");
	const [result, setResult] = useState<EligibilityResult | null>(null);
	const [isCalculating, setIsCalculating] = useState(false);

	// Fetch user portfolios
	const { data: portfolios } = useQuery({
		queryKey: ["/api/portfolios/by-pan"],
	});

	const calculateEligibility = async () => {
		if (!portfolioId || !requestedAmount) return;

		setIsCalculating(true);
		try {
			const response = await fetch("/api/loans/eligibility", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ portfolioId, requestedAmount }),
			});

			const data = await response.json();

			if (data.success) {
				const eligibilityData = data.data;
				const loanAmount = Number.parseFloat(requestedAmount);
				const tenureMonths = Number.parseInt(tenure);
				const monthlyRate =
					Number.parseFloat(eligibilityData.interestRate) / 100 / 12;

				// Calculate EMI using formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
				const emi =
					(loanAmount * monthlyRate * (1 + monthlyRate) ** tenureMonths) /
					((1 + monthlyRate) ** tenureMonths - 1);
				const totalPayment = emi * tenureMonths;
				const totalInterest = totalPayment - loanAmount;

				setResult({
					...eligibilityData,
					emi: Math.round(emi),
					totalInterest: Math.round(totalInterest),
					totalPayment: Math.round(totalPayment),
				});
			}
		} catch (error) {
			console.error("Error calculating eligibility:", error);
		} finally {
			setIsCalculating(false);
		}
	};

	return (
		<Card className="w-full max-w-2xl mx-auto">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Calculator className="h-5 w-5" />
					Loan Eligibility Calculator
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="portfolio">Select Portfolio</Label>
						<Select value={portfolioId} onValueChange={setPortfolioId}>
							<SelectTrigger data-testid="calc-select-portfolio">
								<SelectValue placeholder="Choose portfolio" />
							</SelectTrigger>
							<SelectContent>
								{Array.isArray(portfolios) &&
									portfolios.map((portfolio: any) => (
										<SelectItem key={portfolio.id} value={portfolio.id}>
											{portfolio.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="amount">Loan Amount (₹)</Label>
						<Input
							id="amount"
							data-testid="calc-input-amount"
							type="number"
							placeholder="Enter amount"
							value={requestedAmount}
							onChange={(e) => setRequestedAmount(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="tenure">Loan Tenure</Label>
						<Select value={tenure} onValueChange={setTenure}>
							<SelectTrigger data-testid="calc-select-tenure">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="6">6 Months</SelectItem>
								<SelectItem value="12">12 Months</SelectItem>
								<SelectItem value="18">18 Months</SelectItem>
								<SelectItem value="24">24 Months</SelectItem>
								<SelectItem value="36">36 Months</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-end">
						<Button
							onClick={calculateEligibility}
							disabled={!portfolioId || !requestedAmount || isCalculating}
							className="w-full"
							data-testid="button-calculate"
						>
							{isCalculating ? "Calculating..." : "Calculate"}
						</Button>
					</div>
				</div>

				{result && (
					<Card
						className={`${result.isEligible ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"}`}
					>
						<CardHeader>
							<CardTitle className="text-lg flex items-center gap-2">
								{result.isEligible ? (
									<>
										<TrendingUp className="h-5 w-5 text-green-600" />
										<span className="text-green-600">Loan Approved</span>
									</>
								) : (
									<>
										<AlertCircle className="h-5 w-5 text-red-600" />
										<span className="text-red-600">Loan Not Eligible</span>
									</>
								)}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div className="text-center">
									<p className="text-sm text-muted-foreground">
										Portfolio Value
									</p>
									<p className="text-lg font-semibold text-blue-600">
										₹{result.portfolioValue.toLocaleString()}
									</p>
								</div>
								<div className="text-center">
									<p className="text-sm text-muted-foreground">
										Max Loan Amount
									</p>
									<p className="text-lg font-semibold text-green-600">
										₹{result.maxLoanAmount.toLocaleString()}
									</p>
								</div>
								<div className="text-center">
									<p className="text-sm text-muted-foreground">Interest Rate</p>
									<p className="text-lg font-semibold text-blue-600">
										{result.interestRate}% p.a.
									</p>
								</div>
								<div className="text-center">
									<p className="text-sm text-muted-foreground">LTV Ratio</p>
									<p className="text-lg font-semibold text-purple-600">
										{result.loanToValue}%
									</p>
								</div>
							</div>

							{result.isEligible && (
								<div className="mt-6 pt-4 border-t">
									<h4 className="font-semibold mb-3">Loan Breakdown</h4>
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
										<div>
											<p className="text-muted-foreground">Monthly EMI</p>
											<p className="font-semibold text-lg">
												₹{result.emi.toLocaleString()}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground">Total Interest</p>
											<p className="font-semibold">
												₹{result.totalInterest.toLocaleString()}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground">Total Payment</p>
											<p className="font-semibold">
												₹{result.totalPayment.toLocaleString()}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground">Processing Fee</p>
											<p className="font-semibold">
												₹{result.processingFee.toLocaleString()}
											</p>
										</div>
									</div>
								</div>
							)}

							{!result.isEligible && (
								<div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
									<p className="text-sm text-yellow-800 dark:text-yellow-200">
										<strong>Suggestion:</strong> Try reducing the loan amount or
										add more securities to your portfolio to increase
										eligibility.
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				)}
			</CardContent>
		</Card>
	);
}
