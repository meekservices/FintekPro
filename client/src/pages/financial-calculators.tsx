import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
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
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Calculator,
	TrendingUp,
	PiggyBank,
	Home,
	Car,
	Receipt,
	IndianRupee,
	FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import {
	calculateSipReturns,
	calculateEmiSchedule,
	type SipCalculationResult,
	type EmiCalculationResult,
} from "@shared/calculations";
import { DynamicTaxCalculator } from "@/components/tax/dynamic-tax-calculator";

// Type aliases for imported types
type SipResult = SipCalculationResult;
type EmiResult = EmiCalculationResult;

const sipCalculatorSchema = z.object({
	monthlyInvestment: z
		.string()
		.min(1, "Monthly investment amount is required")
		.refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 100, {
			message: "Monthly investment must be at least ₹100",
		}),
	expectedReturn: z
		.string()
		.min(1, "Expected return is required")
		.refine(
			(val) =>
				!Number.isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 50,
			{
				message: "Expected return must be between 1% and 50%",
			},
		),
	timePeriod: z
		.string()
		.min(1, "Investment period is required")
		.refine(
			(val) =>
				!Number.isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 50,
			{
				message: "Investment period must be between 1 and 50 years",
			},
		),
});

const emiCalculatorSchema = z.object({
	loanAmount: z
		.string()
		.min(1, "Loan amount is required")
		.refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 10000, {
			message: "Loan amount must be at least ₹10,000",
		}),
	interestRate: z
		.string()
		.min(1, "Interest rate is required")
		.refine(
			(val) =>
				!Number.isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 50,
			{
				message: "Interest rate must be between 0.1% and 50%",
			},
		),
	tenure: z
		.string()
		.min(1, "Loan tenure is required")
		.refine(
			(val) =>
				!Number.isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 480,
			{
				message: "Loan tenure must be between 1 and 480 months",
			},
		),
});

type SipFormData = z.infer<typeof sipCalculatorSchema>;
type EmiFormData = z.infer<typeof emiCalculatorSchema>;

export default function FinancialCalculators() {
	const [location, setLocation] = useLocation();

	// Get current tool from URL parameter
	const getToolFromUrl = () => {
		const urlParams = new URLSearchParams(location.split("?")[1] || "");
		const tool = urlParams.get("tool");
		return ["tax", "sip", "emi"].includes(tool || "") ? tool || "tax" : "tax";
	};

	// Update URL when tab changes
	const updateUrlWithTool = (tool: string) => {
		const currentPath = location.split("?")[0];
		const newUrl = `${currentPath}?tool=${tool}`;
		setLocation(newUrl);
	};

	// Current active tab state
	const [activeTab, setActiveTab] = useState(getToolFromUrl);

	// Update active tab when URL changes
	useEffect(() => {
		const newTool = getToolFromUrl();
		if (newTool !== activeTab) {
			setActiveTab(newTool);
		}
	}, [location]);

	const { toast } = useToast();

	// Form instances with validation
	const sipForm = useForm<SipFormData>({
		resolver: zodResolver(sipCalculatorSchema),
		defaultValues: {
			monthlyInvestment: "",
			expectedReturn: "12",
			timePeriod: "10",
		},
	});

	const emiForm = useForm<EmiFormData>({
		resolver: zodResolver(emiCalculatorSchema),
		defaultValues: {
			loanAmount: "",
			interestRate: "",
			tenure: "",
		},
	});

	const [sipResult, setSipResult] = useState<SipResult | null>(null);
	const [emiResult, setEmiResult] = useState<EmiResult | null>(null);
	const [sipLoading, setSipLoading] = useState(false);
	const [emiLoading, setEmiLoading] = useState(false);

	const onSipSubmit = async (data: SipFormData) => {
		setSipLoading(true);

		// Small delay to show loading state
		await new Promise((resolve) => setTimeout(resolve, 500));

		try {
			const input = {
				monthlyInvestment: Number.parseFloat(data.monthlyInvestment),
				expectedReturn: Number.parseFloat(data.expectedReturn),
				timePeriod: Number.parseFloat(data.timePeriod),
			};

			const result = calculateSipReturns(input);
			setSipResult(result);

			toast({
				title: "SIP Calculation Complete",
				description: `Maturity amount: ₹${result.maturityAmount.toLocaleString("en-IN")}`,
			});
		} finally {
			setSipLoading(false);
		}
	};

	const onEmiSubmit = async (data: EmiFormData) => {
		setEmiLoading(true);

		// Small delay to show loading state
		await new Promise((resolve) => setTimeout(resolve, 500));

		try {
			const input = {
				loanAmount: Number.parseFloat(data.loanAmount),
				interestRate: Number.parseFloat(data.interestRate),
				tenure: Number.parseFloat(data.tenure),
			};

			const result = calculateEmiSchedule(input);
			setEmiResult(result);

			toast({
				title: "EMI Calculation Complete",
				description: `Monthly EMI: ₹${result.monthlyEmi.toLocaleString("en-IN")}`,
			});
		} finally {
			setEmiLoading(false);
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	// Handle tab change
	const handleTabChange = (value: string) => {
		setActiveTab(value);
		updateUrlWithTool(value);
	};

	return (
		<div className="container mx-auto px-4 py-8 space-y-8">
			<Tabs
				value={activeTab}
				onValueChange={handleTabChange}
				className="w-full"
			>
				<div className="overflow-x-auto pb-2">
					<ScrollableTabsList className="inline-flex w-auto min-w-full">
						<TabsTrigger
							value="tax"
							data-testid="tab-tax-calculator"
							className="flex-shrink-0"
						>
							<Receipt className="w-4 h-4 mr-2" />
							Tax Calculator
						</TabsTrigger>
						<TabsTrigger
							value="sip"
							data-testid="tab-sip-calculator"
							className="flex-shrink-0"
						>
							<TrendingUp className="w-4 h-4 mr-2" />
							SIP Calculator
						</TabsTrigger>
						<TabsTrigger
							value="emi"
							data-testid="tab-emi-calculator"
							className="flex-shrink-0"
						>
							<Home className="w-4 h-4 mr-2" />
							EMI Calculator
						</TabsTrigger>
					</ScrollableTabsList>
				</div>

				{/* Tax Calculator Tab */}
				<TabsContent value="tax" className="space-y-6">
					<DynamicTaxCalculator />
				</TabsContent>

				{/* SIP Calculator Tab */}
				<TabsContent value="sip" className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<TrendingUp className="h-5 w-5" />
									SIP Calculator
								</CardTitle>
								<CardDescription>
									Calculate returns on your Systematic Investment Plan
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Form {...sipForm}>
									<form
										onSubmit={sipForm.handleSubmit(onSipSubmit)}
										className="space-y-4"
									>
										<FormField
											control={sipForm.control}
											name="monthlyInvestment"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Monthly Investment Amount</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="Enter monthly SIP amount"
															data-testid="input-monthly-investment"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={sipForm.control}
											name="expectedReturn"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Expected Annual Return (%)</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="12"
															data-testid="input-expected-return"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={sipForm.control}
											name="timePeriod"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Investment Period (Years)</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="10"
															data-testid="input-time-period"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<Button
											type="submit"
											className="w-full"
											disabled={sipLoading}
											data-testid="button-calculate-sip"
										>
											{sipLoading ? "Calculating..." : "Calculate SIP Returns"}
										</Button>
									</form>
								</Form>
							</CardContent>
						</Card>

						{sipResult && (
							<Card>
								<CardHeader>
									<CardTitle>SIP Calculation Results</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										<div className="flex justify-between">
											<span className="text-sm">Total Investment:</span>
											<span className="font-semibold">
												{formatCurrency(sipResult.totalInvestment)}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm">Expected Returns:</span>
											<span className="font-semibold text-green-600">
												{formatCurrency(sipResult.expectedReturns)}
											</span>
										</div>
										<hr />
										<div className="flex justify-between">
											<span className="font-medium">Maturity Amount:</span>
											<span className="font-bold text-green-600">
												{formatCurrency(sipResult.maturityAmount)}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm">Total Gain:</span>
											<span className="font-semibold">
												{sipResult.totalGainPercent.toFixed(2)}%
											</span>
										</div>
									</div>

									{/* SIP Investment Suggestions */}
									<div className="mt-6 p-4 bg-green-50 dark:bg-green-950 rounded-lg border">
										<h4 className="font-semibold mb-3 text-green-800 dark:text-green-200">
											🎯 Investment Growth Tips
										</h4>
										<div className="space-y-3 text-sm">
											{sipResult.totalGainPercent > 300 && (
												<div className="flex items-start gap-2">
													<span className="text-green-600">•</span>
													<span>
														Excellent! Your SIP can grow by{" "}
														{sipResult.totalGainPercent.toFixed(0)}%. Start with
														large-cap equity mutual funds for stable returns.
													</span>
												</div>
											)}

											<div className="flex items-start gap-2">
												<span className="text-green-600">•</span>
												<span>
													Try increasing your SIP by just ₹1,000 to see how it
													significantly impacts your final corpus through
													compound growth.
												</span>
											</div>

											{sipResult.maturityAmount > 1000000 && (
												<div className="flex items-start gap-2">
													<span className="text-green-600">•</span>
													<span>
														Great! You'll cross ₹10 lakh. Consider diversifying
														across equity, debt, and international funds for
														balanced growth.
													</span>
												</div>
											)}

											<div className="flex items-start gap-2">
												<span className="text-green-600">•</span>
												<span>
													Set up automatic SIP payments on the 1st or 5th of
													each month for optimal rupee cost averaging.
												</span>
											</div>

											<div className="flex items-start gap-2">
												<span className="text-green-600">•</span>
												<span>
													Review and rebalance your SIP portfolio annually to
													maintain your target asset allocation.
												</span>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				</TabsContent>

				{/* EMI Calculator Tab */}
				<TabsContent value="emi" className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Home className="h-5 w-5" />
									EMI Calculator
								</CardTitle>
								<CardDescription>
									Calculate your loan EMI and payment schedule
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Form {...emiForm}>
									<form
										onSubmit={emiForm.handleSubmit(onEmiSubmit)}
										className="space-y-4"
									>
										<FormField
											control={emiForm.control}
											name="loanAmount"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Loan Amount</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="Enter loan amount"
															data-testid="input-loan-amount"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={emiForm.control}
											name="interestRate"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Interest Rate (% per annum)</FormLabel>
													<FormControl>
														<Input
															type="number"
															step="0.1"
															placeholder="8.5"
															data-testid="input-interest-rate"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={emiForm.control}
											name="tenure"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Loan Tenure (Years)</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="15"
															data-testid="input-tenure"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<Button
											type="submit"
											className="w-full"
											disabled={emiLoading}
											data-testid="button-calculate-emi"
										>
											{emiLoading ? "Calculating..." : "Calculate EMI"}
										</Button>
									</form>
								</Form>
							</CardContent>
						</Card>

						{emiResult && (
							<Card>
								<CardHeader>
									<CardTitle>EMI Calculation Results</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3 mb-6">
										<div className="flex justify-between">
											<span className="font-medium">Monthly EMI:</span>
											<span className="font-bold text-blue-600">
												{formatCurrency(emiResult.monthlyEmi)}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm">Total Interest:</span>
											<span className="font-semibold text-red-600">
												{formatCurrency(emiResult.totalInterest)}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm">Total Amount Payable:</span>
											<span className="font-semibold">
												{formatCurrency(emiResult.totalAmount)}
											</span>
										</div>
									</div>

									<h4 className="font-semibold mb-3">
										Payment Schedule (First 12 months)
									</h4>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Month</TableHead>
												<TableHead>EMI</TableHead>
												<TableHead>Principal</TableHead>
												<TableHead>Interest</TableHead>
												<TableHead>Balance</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{emiResult.schedule.map((payment) => (
												<TableRow key={payment.month}>
													<TableCell>{payment.month}</TableCell>
													<TableCell>{formatCurrency(payment.emi)}</TableCell>
													<TableCell>
														{formatCurrency(payment.principal)}
													</TableCell>
													<TableCell>
														{formatCurrency(payment.interest)}
													</TableCell>
													<TableCell>
														{formatCurrency(payment.balance)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>

									{/* EMI Optimization Suggestions */}
									<div className="mt-6 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border">
										<h4 className="font-semibold mb-3 text-orange-800 dark:text-orange-200">
											💰 Loan Optimization Tips
										</h4>
										<div className="space-y-3 text-sm">
											{emiResult.totalInterest >
												emiResult.totalAmount * 0.4 && (
												<div className="flex items-start gap-2">
													<span className="text-orange-600">•</span>
													<span>
														Your total interest is ₹
														{formatCurrency(emiResult.totalInterest)}. Consider
														making prepayments to reduce interest burden
														significantly.
													</span>
												</div>
											)}

											<div className="flex items-start gap-2">
												<span className="text-orange-600">•</span>
												<span>
													Making an annual prepayment of just ₹50,000 can reduce
													your loan tenure by 2-3 years and save lakhs in
													interest.
												</span>
											</div>

											{emiResult.monthlyEmi > 0 && (
												<div className="flex items-start gap-2">
													<span className="text-orange-600">•</span>
													<span>
														Follow the 40% rule: Your total EMIs shouldn't
														exceed 40% of your monthly income for healthy
														financial planning.
													</span>
												</div>
											)}

											<div className="flex items-start gap-2">
												<span className="text-orange-600">•</span>
												<span>
													Compare loan offers from different banks and choose
													the one with the lowest processing fees and best
													interest rates.
												</span>
											</div>

											<div className="flex items-start gap-2">
												<span className="text-orange-600">•</span>
												<span>
													Set up automatic EMI payments to avoid late fees and
													maintain a good credit score for future loans.
												</span>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
