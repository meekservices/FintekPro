import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
	CreditCard,
	Shield as LucideShield,
	TrendingUp,
	AlertCircle,
	CheckCircle,
	FileText,
	Monitor,
	Calculator,
	Star,
	Clock,
	Users,
	IndianRupee,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Cibil() {
	// Navigation state for responsive layout
	const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
		try {
			const saved = localStorage.getItem("navigation-collapsed");
			return saved ? JSON.parse(saved) : false;
		} catch {
			return false;
		}
	});

	// Listen for navigation state changes
	useEffect(() => {
		const handleNavChange = (event: CustomEvent) => {
			setIsNavCollapsed(event.detail.isCollapsed);
		};

		window.addEventListener(
			"navigation-state-changed",
			handleNavChange as EventListener,
		);
		return () =>
			window.removeEventListener(
				"navigation-state-changed",
				handleNavChange as EventListener,
			);
	}, []);
	const [formData, setFormData] = useState({
		fullName: "",
		mobileNumber: "",
		dateOfBirth: "",
		panNumber: "",
		email: "",
		monthlyIncome: "",
		employmentType: "",
		existingEMIs: "",
		loanType: "",
		loanAmount: "",
		existingCards: "",
	});

	const [consentGiven, setConsentGiven] = useState(false);

	// Credit score check mutation
	const {
		data: creditData,
		mutate: checkCreditScore,
		isPending: scorePending,
	} = useMutation<any, Error, any, unknown>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/cibil/credit-score", data);
		},
		onSuccess: (data) => {
			// Save credit score to localStorage so it can be displayed in footer
			if (data.success && data.data.creditScore) {
				localStorage.setItem(
					"userCreditScore",
					data.data.creditScore.toString(),
				);
			}
		},
	});

	// Detailed report mutation
	const {
		data: detailedReport,
		mutate: getDetailedReport,
		isPending: reportPending,
	} = useMutation<any, Error, any, unknown>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/cibil/detailed-report", data);
		},
	});

	// Loan eligibility mutation
	const {
		data: loanEligibility,
		mutate: checkLoanEligibility,
		isPending: loanPending,
	} = useMutation<any, Error, any, unknown>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/cibil/loan-eligibility", data);
		},
	});

	// Credit card eligibility mutation
	const {
		data: cardEligibility,
		mutate: checkCardEligibility,
		isPending: cardPending,
	} = useMutation<any, Error, any, unknown>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/cibil/card-eligibility", data);
		},
	});

	// Credit monitoring mutation
	const { data: monitoringSetup, mutate: setupMonitoring } = useMutation<
		any,
		Error,
		any,
		unknown
	>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/cibil/monitoring", data);
		},
	});

	const handleCreditCheck = () => {
		if (!consentGiven) {
			alert("Please provide consent to check your credit score");
			return;
		}

		checkCreditScore({
			fullName: formData.fullName,
			mobileNumber: formData.mobileNumber,
			dateOfBirth: formData.dateOfBirth,
			panNumber: formData.panNumber,
			email: formData.email,
		});
	};

	const handleDetailedReport = () => {
		if (creditData?.success && creditData.data.reportId) {
			getDetailedReport({
				reportId: creditData.data.reportId,
				userConsent: true,
			});
		}
	};

	const handleLoanEligibilityCheck = () => {
		checkLoanEligibility({
			creditScore: creditData?.data.creditScore || 750,
			monthlyIncome: Number.parseInt(formData.monthlyIncome),
			employmentType: formData.employmentType,
			existingEMIs: Number.parseInt(formData.existingEMIs) || 0,
			loanType: formData.loanType,
			loanAmount: Number.parseInt(formData.loanAmount),
		});
	};

	const handleCardEligibilityCheck = () => {
		checkCardEligibility({
			creditScore: creditData?.data.creditScore || 750,
			monthlyIncome: Number.parseInt(formData.monthlyIncome),
			employmentType: formData.employmentType,
			existingCards: Number.parseInt(formData.existingCards) || 0,
		});
	};

	const getCreditScoreColor = (score: number) => {
		if (score >= 800) return "text-green-600";
		if (score >= 750) return "text-blue-600";
		if (score >= 700) return "text-yellow-600";
		if (score >= 650) return "text-orange-600";
		return "text-red-600";
	};

	const getCreditScoreProgress = (score: number) => {
		return ((score - 300) / 600) * 100; // Convert 300-900 range to 0-100%
	};

	return (
		<div className="min-h-screen bg-finance-light" data-testid="cibil-page">
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<Tabs defaultValue="score-check" className="space-y-8">
					<ScrollableTabsList className="grid w-full grid-cols-5">
						<TabsTrigger value="score-check" data-testid="tab-score-check">
							Credit Score
						</TabsTrigger>
						<TabsTrigger
							value="detailed-report"
							data-testid="tab-detailed-report"
						>
							Detailed Report
						</TabsTrigger>
						<TabsTrigger
							value="loan-eligibility"
							data-testid="tab-loan-eligibility"
						>
							Loan Eligibility
						</TabsTrigger>
						<TabsTrigger
							value="card-eligibility"
							data-testid="tab-card-eligibility"
						>
							Credit Cards
						</TabsTrigger>
						<TabsTrigger value="monitoring" data-testid="tab-monitoring">
							Monitoring
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent
						value="score-check"
						className="space-y-6"
						data-testid="score-check-tab"
					>
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<LucideShield className="h-5 w-5 text-finance-blue" />
										Check Your Credit Score
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Full Name
										</label>
										<Input
											placeholder="Enter full name as per PAN card"
											value={formData.fullName}
											onChange={(e) =>
												setFormData({ ...formData, fullName: e.target.value })
											}
											data-testid="full-name-input"
										/>
									</div>

									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Mobile Number
										</label>
										<Input
											placeholder="Enter 10-digit mobile number"
											value={formData.mobileNumber}
											onChange={(e) =>
												setFormData({
													...formData,
													mobileNumber: e.target.value,
												})
											}
											data-testid="mobile-number-input"
										/>
									</div>

									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Date of Birth
										</label>
										<Input
											type="date"
											value={formData.dateOfBirth}
											onChange={(e) =>
												setFormData({
													...formData,
													dateOfBirth: e.target.value,
												})
											}
											data-testid="date-of-birth-input"
										/>
									</div>

									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											PAN Number
										</label>
										<Input
											placeholder="Enter PAN number"
											value={formData.panNumber}
											onChange={(e) =>
												setFormData({
													...formData,
													panNumber: e.target.value.toUpperCase(),
												})
											}
											data-testid="pan-number-input"
											maxLength={10}
										/>
									</div>

									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Email Address
										</label>
										<Input
											type="email"
											placeholder="Enter email address"
											value={formData.email}
											onChange={(e) =>
												setFormData({ ...formData, email: e.target.value })
											}
											data-testid="email-input"
										/>
									</div>

									<div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
										<input
											type="checkbox"
											checked={consentGiven}
											onChange={(e) => setConsentGiven(e.target.checked)}
											className="mt-1"
											data-testid="consent-checkbox"
										/>
										<div className="text-sm text-muted-foreground">
											<p className="font-medium mb-1">
												Consent for Credit Score Check
											</p>
											<p>
												I authorize CIBIL to access my credit information and
												provide credit score and report. This will be recorded
												as a soft inquiry and will not impact my credit score.
											</p>
										</div>
									</div>

									<Button
										onClick={handleCreditCheck}
										disabled={scorePending || !consentGiven}
										className="w-full bg-finance-blue hover:bg-blue-700"
										data-testid="check-credit-score"
									>
										{scorePending ? "Checking..." : "Check Credit Score"}
									</Button>
								</CardContent>
							</Card>

							{/* Credit Score Results */}
							<Card>
								<CardHeader>
									<CardTitle>Your Credit Score</CardTitle>
								</CardHeader>
								<CardContent>
									{creditData?.success ? (
										<div className="space-y-6">
											<div className="text-center">
												<div className="mb-4">
													<span
														className={`text-6xl font-bold ${getCreditScoreColor(creditData.data.creditScore)}`}
													>
														{creditData.data.creditScore}
													</span>
													<div className="text-sm text-muted-foreground mt-1">
														out of 900
													</div>
												</div>
												<Progress
													value={getCreditScoreProgress(
														creditData.data.creditScore,
													)}
													className="h-3 mb-2"
												/>
												<Badge
													variant={
														creditData.data.creditScore >= 750
															? "default"
															: "secondary"
													}
													className="text-sm"
												>
													{creditData.data.creditGrade}
												</Badge>
											</div>

											<div className="space-y-3">
												<h4 className="font-semibold text-foreground">
													Credit Summary
												</h4>
												<div className="grid grid-cols-2 gap-4 text-sm">
													<div>
														<span className="text-muted-foreground">
															Total Accounts:
														</span>
														<span className="font-medium ml-2">
															{creditData.data.creditSummary.totalAccounts}
														</span>
													</div>
													<div>
														<span className="text-muted-foreground">
															Active Accounts:
														</span>
														<span className="font-medium ml-2">
															{creditData.data.creditSummary.activeAccounts}
														</span>
													</div>
													<div>
														<span className="text-muted-foreground">
															Credit Limit:
														</span>
														<span className="font-medium ml-2">
															₹
															{creditData.data.creditSummary.totalCreditLimit.toLocaleString()}
														</span>
													</div>
													<div>
														<span className="text-muted-foreground">
															Current Balance:
														</span>
														<span className="font-medium ml-2">
															₹
															{creditData.data.creditSummary.currentBalance.toLocaleString()}
														</span>
													</div>
												</div>
											</div>

											<div className="space-y-2">
												<h4 className="font-semibold text-foreground">
													Recommendations
												</h4>
												<ul className="text-sm text-muted-foreground space-y-1">
													{creditData.data.recommendations.map(
														(rec: string, idx: number) => (
															<li key={idx} className="flex items-start gap-2">
																<CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
																{rec}
															</li>
														),
													)}
												</ul>
											</div>

											<div className="flex gap-2">
												<Button
													onClick={handleDetailedReport}
													variant="outline"
													size="sm"
													data-testid="get-detailed-report"
												>
													<FileText className="h-4 w-4 mr-2" />
													Detailed Report
												</Button>
												<Button
													onClick={() =>
														setupMonitoring({
															reportId: creditData.data.reportId,
														})
													}
													variant="outline"
													size="sm"
													data-testid="setup-monitoring"
												>
													<Monitor className="h-4 w-4 mr-2" />
													Setup Monitoring
												</Button>
											</div>
										</div>
									) : (
										<div className="text-center py-12">
											<LucideShield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
											<p className="text-muted-foreground">
												Fill in your details and check consent to get your
												credit score
											</p>
										</div>
									)}
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent
						value="detailed-report"
						className="space-y-6"
						data-testid="detailed-report-tab"
					>
						{detailedReport?.success ? (
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
								{/* Credit Accounts */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<CreditCard className="h-5 w-5 text-finance-blue" />
											Credit Accounts
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											{detailedReport.data.creditAccounts
												.slice(0, 5)
												.map((account: any, idx: number) => (
													<div key={idx} className="p-3 border rounded-lg">
														<div className="flex justify-between items-start mb-2">
															<div>
																<h4 className="font-medium text-foreground">
																	{account.accountType}
																</h4>
																<p className="text-sm text-muted-foreground">
																	{account.bank}
																</p>
															</div>
															<Badge
																variant={
																	account.paymentStatus === "Current"
																		? "default"
																		: "destructive"
																}
															>
																{account.paymentStatus}
															</Badge>
														</div>
														<div className="text-xs text-muted-foreground space-y-1">
															<div>
																Limit: ₹{account.creditLimit.toLocaleString()}
															</div>
															<div>
																Balance: ₹
																{account.currentBalance.toLocaleString()}
															</div>
															<div>
																Opened:{" "}
																{new Date(
																	account.openDate,
																).toLocaleDateString()}
															</div>
														</div>
													</div>
												))}
										</div>
									</CardContent>
								</Card>

								{/* Credit Utilization */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<TrendingUp className="h-5 w-5 text-finance-blue" />
											Credit Utilization
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div className="text-center">
												<span className="text-3xl font-bold text-finance-blue">
													{
														detailedReport.data.creditUtilization
															.utilizationRatio
													}
													%
												</span>
												<p className="text-sm text-muted-foreground mt-1">
													Current Utilization
												</p>
												<Progress
													value={
														detailedReport.data.creditUtilization
															.utilizationRatio
													}
													className="mt-2"
												/>
											</div>

											<div className="grid grid-cols-2 gap-4 text-sm">
												<div>
													<span className="text-muted-foreground">
														Total Limit:
													</span>
													<div className="font-medium">
														₹
														{detailedReport.data.creditUtilization.totalLimit.toLocaleString()}
													</div>
												</div>
												<div>
													<span className="text-muted-foreground">
														Total Used:
													</span>
													<div className="font-medium">
														₹
														{detailedReport.data.creditUtilization.totalUsed.toLocaleString()}
													</div>
												</div>
											</div>

											<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
												<p className="text-sm text-blue-800 dark:text-blue-200">
													<strong>Tip:</strong> Keep utilization below 30% for
													better credit score
												</p>
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Payment History */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Clock className="h-5 w-5 text-finance-blue" />
											Payment History
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div className="grid grid-cols-3 gap-4 text-center">
												<div>
													<div className="text-2xl font-bold text-green-600">
														{detailedReport.data.paymentHistory.onTimePayments}%
													</div>
													<div className="text-xs text-muted-foreground">
														On Time
													</div>
												</div>
												<div>
													<div className="text-2xl font-bold text-yellow-600">
														{detailedReport.data.paymentHistory.latePayments}
													</div>
													<div className="text-xs text-muted-foreground">
														Late
													</div>
												</div>
												<div>
													<div className="text-2xl font-bold text-red-600">
														{detailedReport.data.paymentHistory.missedPayments}
													</div>
													<div className="text-xs text-muted-foreground">
														Missed
													</div>
												</div>
											</div>

											<div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
												<p className="text-sm text-green-800 dark:text-green-200">
													<strong>Excellent!</strong> Your payment history shows
													consistent on-time payments.
												</p>
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Enquiry History */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<FileText className="h-5 w-5 text-finance-blue" />
											Recent Enquiries
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											{detailedReport.data.enquiryHistory
												.slice(0, 5)
												.map((enquiry: any, idx: number) => (
													<div key={idx} className="p-3 border rounded-lg">
														<div className="flex justify-between items-start">
															<div>
																<h4 className="font-medium text-foreground">
																	{enquiry.enquiryType}
																</h4>
																<p className="text-sm text-muted-foreground">
																	{enquiry.company}
																</p>
															</div>
															<span className="text-xs text-muted-foreground">
																{new Date(
																	enquiry.enquiryDate,
																).toLocaleDateString()}
															</span>
														</div>
														<div className="text-xs text-muted-foreground mt-2">
															Amount: ₹{enquiry.amount.toLocaleString()}
														</div>
													</div>
												))}
										</div>
									</CardContent>
								</Card>
							</div>
						) : (
							<Card className="border-dashed border-2 border-border">
								<CardContent className="flex flex-col items-center justify-center py-12">
									<FileText className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-semibold text-foreground mb-2">
										Generate Detailed Report
									</h3>
									<p className="text-muted-foreground text-center mb-4">
										First check your credit score, then get a detailed credit
										report
									</p>
									<Button
										onClick={handleDetailedReport}
										disabled={!creditData?.success || reportPending}
										data-testid="generate-detailed-report"
									>
										{reportPending ? "Generating..." : "Generate Report"}
									</Button>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					<TabsContent
						value="loan-eligibility"
						className="space-y-6"
						data-testid="loan-eligibility-tab"
					>
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Calculator className="h-5 w-5 text-finance-blue" />
										Loan Eligibility Check
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Monthly Income (₹)
										</label>
										<Input
											type="number"
											placeholder="Enter monthly income"
											value={formData.monthlyIncome}
											onChange={(e) =>
												setFormData({
													...formData,
													monthlyIncome: e.target.value,
												})
											}
											data-testid="monthly-income-input"
										/>
									</div>

									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Employment Type
										</label>
										<Select
											value={formData.employmentType}
											onValueChange={(value) =>
												setFormData({ ...formData, employmentType: value })
											}
										>
											<SelectTrigger data-testid="employment-type-select">
												<SelectValue placeholder="Select employment type" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="salaried">Salaried</SelectItem>
												<SelectItem value="self-employed">
													Self Employed
												</SelectItem>
												<SelectItem value="business">Business Owner</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Existing EMIs (₹)
										</label>
										<Input
											type="number"
											placeholder="Total monthly EMI payments"
											value={formData.existingEMIs}
											onChange={(e) =>
												setFormData({
													...formData,
													existingEMIs: e.target.value,
												})
											}
											data-testid="existing-emis-input"
										/>
									</div>

									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Loan Type
										</label>
										<Select
											value={formData.loanType}
											onValueChange={(value) =>
												setFormData({ ...formData, loanType: value })
											}
										>
											<SelectTrigger data-testid="loan-type-select">
												<SelectValue placeholder="Select loan type" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="personal">Personal Loan</SelectItem>
												<SelectItem value="home">Home Loan</SelectItem>
												<SelectItem value="auto">Auto Loan</SelectItem>
												<SelectItem value="business">Business Loan</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Loan Amount (₹)
										</label>
										<Input
											type="number"
											placeholder="Enter desired loan amount"
											value={formData.loanAmount}
											onChange={(e) =>
												setFormData({ ...formData, loanAmount: e.target.value })
											}
											data-testid="loan-amount-input"
										/>
									</div>

									<Button
										onClick={handleLoanEligibilityCheck}
										disabled={loanPending}
										className="w-full bg-finance-blue hover:bg-blue-700"
										data-testid="check-loan-eligibility"
									>
										{loanPending ? "Checking..." : "Check Eligibility"}
									</Button>
								</CardContent>
							</Card>

							{/* Loan Eligibility Results */}
							<Card>
								<CardHeader>
									<CardTitle>Loan Eligibility Results</CardTitle>
								</CardHeader>
								<CardContent>
									{loanEligibility?.success ? (
										<div className="space-y-6">
											<div className="text-center p-6 bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 rounded-lg">
												<div className="mb-2">
													{loanEligibility.data.eligible ? (
														<CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
													) : (
														<AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
													)}
												</div>
												<h3 className="text-lg font-bold text-foreground mb-2">
													{loanEligibility.data.eligible
														? "Congratulations! You're Eligible"
														: "Not Eligible"}
												</h3>
												<p className="text-sm text-muted-foreground">
													Eligibility:{" "}
													{loanEligibility.data.eligibilityPercentage}%
												</p>
											</div>

											<div className="grid grid-cols-2 gap-4 text-sm">
												<div>
													<span className="text-muted-foreground">
														Max Loan Amount:
													</span>
													<div className="font-bold text-finance-blue">
														₹
														{loanEligibility.data.maxLoanAmount.toLocaleString()}
													</div>
												</div>
												<div>
													<span className="text-muted-foreground">
														Estimated EMI:
													</span>
													<div className="font-bold text-finance-blue">
														₹
														{loanEligibility.data.estimatedEMI.toLocaleString()}
													</div>
												</div>
												<div>
													<span className="text-muted-foreground">
														Interest Rate:
													</span>
													<div className="font-bold text-finance-blue">
														{loanEligibility.data.interestRate}%
													</div>
												</div>
												<div>
													<span className="text-muted-foreground">
														Processing Fee:
													</span>
													<div className="font-bold text-finance-blue">
														₹
														{loanEligibility.data.processingFee.toLocaleString()}
													</div>
												</div>
											</div>

											{/* Bank Recommendations */}
											{loanEligibility.data.bankRecommendations && (
												<div className="space-y-3">
													<h4 className="font-semibold text-foreground">
														Bank Recommendations
													</h4>
													{loanEligibility.data.bankRecommendations.map(
														(bank: any, idx: number) => (
															<div key={idx} className="p-3 border rounded-lg">
																<div className="flex justify-between items-start mb-2">
																	<h5 className="font-medium text-foreground">
																		{bank.bank}
																	</h5>
																	<span className="text-sm font-bold text-finance-blue">
																		{bank.interestRate}%
																	</span>
																</div>
																<div className="text-sm text-muted-foreground mb-2">
																	Max Amount: ₹{bank.maxAmount.toLocaleString()}
																</div>
																<ul className="text-xs text-muted-foreground space-y-1">
																	{bank.features.map(
																		(feature: string, fidx: number) => (
																			<li key={fidx}>• {feature}</li>
																		),
																	)}
																</ul>
															</div>
														),
													)}
												</div>
											)}
										</div>
									) : (
										<div className="text-center py-12">
											<Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
											<p className="text-muted-foreground">
												Fill in loan details to check your eligibility
											</p>
										</div>
									)}
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent
						value="card-eligibility"
						className="space-y-6"
						data-testid="card-eligibility-tab"
					>
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CreditCard className="h-5 w-5 text-finance-blue" />
									Credit Card Eligibility
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="mb-4">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
										<div>
											<label className="text-sm font-medium text-muted-foreground mb-2 block">
												Existing Credit Cards
											</label>
											<Input
												type="number"
												placeholder="Number of existing cards"
												value={formData.existingCards}
												onChange={(e) =>
													setFormData({
														...formData,
														existingCards: e.target.value,
													})
												}
												data-testid="existing-cards-input"
											/>
										</div>
									</div>

									<Button
										onClick={handleCardEligibilityCheck}
										disabled={cardPending}
										className="bg-finance-blue hover:bg-blue-700"
										data-testid="check-card-eligibility"
									>
										{cardPending ? "Checking..." : "Check Card Eligibility"}
									</Button>
								</div>

								{cardEligibility?.success && (
									<div className="space-y-6">
										<div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
											<h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
												{cardEligibility.data.eligible
													? "You're Eligible for Credit Cards!"
													: "Limited Eligibility"}
											</h3>
											<p className="text-sm text-blue-800 dark:text-blue-200">
												Estimated Credit Limit: ₹
												{cardEligibility.data.estimatedLimit.toLocaleString()}
											</p>
										</div>

										{cardEligibility.data.recommendedCards &&
											cardEligibility.data.recommendedCards.length > 0 && (
												<div className="space-y-4">
													<h4 className="font-semibold text-foreground">
														Recommended Credit Cards
													</h4>
													<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
														{cardEligibility.data.recommendedCards.map(
															(card: any, idx: number) => (
																<Card
																	key={idx}
																	className="hover:shadow-md transition-shadow"
																>
																	<CardContent className="p-4">
																		<div className="flex justify-between items-start mb-3">
																			<div>
																				<h5 className="font-bold text-foreground">
																					{card.cardName}
																				</h5>
																				<p className="text-sm text-muted-foreground">
																					{card.bank}
																				</p>
																			</div>
																			<Badge variant="secondary">
																				{card.category}
																			</Badge>
																		</div>

																		<div className="text-sm mb-3">
																			<div className="flex justify-between">
																				<span>Annual Fee:</span>
																				<span className="font-medium">
																					₹{card.annualFee}
																				</span>
																			</div>
																			<div className="flex justify-between">
																				<span>Min Income:</span>
																				<span className="font-medium">
																					₹{card.minIncome.toLocaleString()}
																				</span>
																			</div>
																		</div>

																		<ul className="text-xs text-muted-foreground space-y-1 mb-3">
																			{card.features.map(
																				(feature: string, fidx: number) => (
																					<li key={fidx}>• {feature}</li>
																				),
																			)}
																		</ul>

																		<Button
																			variant="outline"
																			size="sm"
																			className="w-full"
																		>
																			Apply Now
																		</Button>
																	</CardContent>
																</Card>
															),
														)}
													</div>
												</div>
											)}

										<div className="bg-yellow-50 dark:bg-yellow-950/30 p-4 rounded-lg">
											<h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
												Credit Improvement Tips
											</h4>
											<ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
												{cardEligibility.data.tips.map(
													(tip: string, idx: number) => (
														<li key={idx}>• {tip}</li>
													),
												)}
											</ul>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="monitoring"
						className="space-y-6"
						data-testid="monitoring-tab"
					>
						{monitoringSetup?.success ? (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Monitor className="h-5 w-5 text-green-600" />
										Credit Monitoring Active
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
											<h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
												Monitoring Activated!
											</h3>
											<p className="text-sm text-green-800 dark:text-green-200">
												Monitoring ID: {monitoringSetup.data.monitoringId}
											</p>
										</div>

										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<h4 className="font-medium text-foreground mb-2">
													Alert Types
												</h4>
												<ul className="text-sm text-muted-foreground space-y-1">
													{monitoringSetup.data.alertTypes.map(
														(alert: string, idx: number) => (
															<li key={idx} className="flex items-center gap-2">
																<CheckCircle className="h-4 w-4 text-green-500" />
																{alert}
															</li>
														),
													)}
												</ul>
											</div>

											<div>
												<h4 className="font-medium text-foreground mb-2">
													Features
												</h4>
												<ul className="text-sm text-muted-foreground space-y-1">
													{monitoringSetup.data.features.map(
														(feature: string, idx: number) => (
															<li key={idx} className="flex items-center gap-2">
																<Star className="h-4 w-4 text-yellow-500" />
																{feature}
															</li>
														),
													)}
												</ul>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						) : (
							<Card className="border-dashed border-2 border-border">
								<CardContent className="flex flex-col items-center justify-center py-12">
									<Monitor className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-semibold text-foreground mb-2">
										Setup Credit Monitoring
									</h3>
									<p className="text-muted-foreground text-center mb-4">
										Get alerts when your credit score changes or suspicious
										activity is detected
									</p>
									<Button
										onClick={() =>
											setupMonitoring({
												reportId: creditData?.data?.reportId || "demo",
											})
										}
										disabled={!creditData?.success}
										data-testid="setup-credit-monitoring"
									>
										Setup Monitoring
									</Button>
								</CardContent>
							</Card>
						)}
					</TabsContent>
				</Tabs>
			</main>
		</div>
	);
}
