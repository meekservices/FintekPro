import { useState } from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
	Shield as LucideShield,
	TrendingUp,
	Target,
	AlertTriangle,
	CheckCircle,
	PieChart,
	BarChart3,
	Zap,
	Calculator,
	Clock,
	Building2,
	Star,
	Crown,
	FileText,
	IndianRupee,
	Briefcase,
} from "lucide-react";

interface RiskQuestion {
	id: string;
	question: string;
	options: { value: string; label: string; score: number }[];
}

interface InvestmentRecommendation {
	category: string;
	instruments: string[];
	allocation: number;
	riskLevel: string;
	expectedReturn: string;
	liquidity: string;
}

interface PremiumInvestmentSuitability {
	category: "REITs/InvITs" | "PMS" | "AIF" | "Premium Bonds";
	suitabilityScore: number;
	suitabilityLevel:
		| "Not Suitable"
		| "Suitable with Caution"
		| "Suitable"
		| "Highly Suitable";
	minInvestment: string;
	riskProfile: string;
	expectedReturns: string;
	regulations: string[];
	pros: string[];
	cons: string[];
	timelineToAccess: string;
	monthlyInvestmentSuggestion: string;
}

interface FinancialProfile {
	monthlyIncome: number;
	monthlyExpenses: number;
	existingInvestments: number;
	liquidCash: number;
	riskCapacity: number;
}

const riskQuestions: RiskQuestion[] = [
	{
		id: "1",
		question: "What is your investment experience?",
		options: [
			{ value: "beginner", label: "Beginner - Just starting out", score: 1 },
			{
				value: "some",
				label: "Some experience with basic investments",
				score: 2,
			},
			{
				value: "experienced",
				label: "Experienced with various investment types",
				score: 3,
			},
			{
				value: "expert",
				label: "Expert with complex investment strategies",
				score: 4,
			},
		],
	},
	{
		id: "2",
		question: "How would you react to a 20% drop in your portfolio value?",
		options: [
			{ value: "panic", label: "Panic and sell immediately", score: 1 },
			{ value: "concerned", label: "Very concerned but hold", score: 2 },
			{ value: "wait", label: "Wait for recovery", score: 3 },
			{ value: "buy_more", label: "See it as buying opportunity", score: 4 },
		],
	},
	{
		id: "3",
		question: "What is your investment time horizon?",
		options: [
			{ value: "short", label: "Less than 3 years", score: 1 },
			{ value: "medium", label: "3-7 years", score: 2 },
			{ value: "long", label: "7-15 years", score: 3 },
			{ value: "very_long", label: "More than 15 years", score: 4 },
		],
	},
	{
		id: "4",
		question: "What percentage of your income can you invest?",
		options: [
			{ value: "low", label: "Less than 10%", score: 1 },
			{ value: "moderate", label: "10-20%", score: 2 },
			{ value: "high", label: "20-30%", score: 3 },
			{ value: "very_high", label: "More than 30%", score: 4 },
		],
	},
	{
		id: "5",
		question: "Your primary investment goal is:",
		options: [
			{ value: "preservation", label: "Capital preservation", score: 1 },
			{ value: "income", label: "Regular income generation", score: 2 },
			{ value: "growth", label: "Long-term wealth creation", score: 3 },
			{
				value: "aggressive_growth",
				label: "Aggressive wealth multiplication",
				score: 4,
			},
		],
	},
];

const getPremiumInvestmentSuitability = (
	riskProfile: string,
	riskScore: number,
): PremiumInvestmentSuitability[] => {
	// Simulated financial profile - in real app this would come from user data
	const financialProfile: FinancialProfile = {
		monthlyIncome: 150000,
		monthlyExpenses: 78000,
		existingInvestments: 850000,
		liquidCash: 250000,
		riskCapacity: 72000, // Monthly surplus
	};

	const assessments: PremiumInvestmentSuitability[] = [
		{
			category: "REITs/InvITs",
			suitabilityScore: riskScore >= 10 ? 85 : riskScore >= 8 ? 70 : 45,
			suitabilityLevel:
				riskScore >= 12
					? "Highly Suitable"
					: riskScore >= 10
						? "Suitable"
						: riskScore >= 8
							? "Suitable with Caution"
							: "Not Suitable",
			minInvestment: "₹10,000-₹25,000",
			riskProfile: "Low to Medium Risk",
			expectedReturns: "7-9% annually",
			regulations: [
				"NEW: 1-year holding for LTCG (Budget 2024-25)",
				"₹1.25L annual LTCG exemption",
				"12.5% tax on LTCG above exemption",
				"Regular dividend income taxable",
			],
			pros: [
				"Professional real estate management",
				"Diversified property portfolio",
				"Regular dividend distributions",
				"Exchange-traded liquidity",
				"Lower entry barrier than direct real estate",
			],
			cons: [
				"Market volatility affects NAV",
				"Interest rate sensitivity",
				"Management fees (1-2%)",
				"Limited growth compared to direct equity",
			],
			timelineToAccess: "Immediate",
			monthlyInvestmentSuggestion: `₹${(financialProfile.riskCapacity * 0.15).toLocaleString("en-IN")}`,
		},
		{
			category: "PMS",
			suitabilityScore: riskScore >= 12 ? 75 : riskScore >= 10 ? 65 : 35,
			suitabilityLevel:
				riskScore >= 12
					? "Suitable"
					: riskScore >= 10
						? "Suitable with Caution"
						: "Not Suitable",
			minInvestment: "₹50,00,000",
			riskProfile: "Medium to High Risk",
			expectedReturns: "12-18% annually",
			regulations: [
				"SEBI registered investment advisors",
				"Minimum ₹50L investment mandatory",
				"Direct equity/debt investments",
				"Customized portfolio management",
			],
			pros: [
				"Professional fund management",
				"Customized investment strategy",
				"Direct ownership of securities",
				"Potential for alpha generation",
				"Tax-efficient compared to mutual funds",
			],
			cons: [
				"High minimum investment",
				"Management fees (2-3% + performance)",
				"Manager risk dependency",
				"Less regulatory oversight than MFs",
			],
			timelineToAccess: `${Math.ceil(5000000 / financialProfile.riskCapacity)} months with ₹72K monthly`,
			monthlyInvestmentSuggestion: `Save ₹${financialProfile.riskCapacity.toLocaleString("en-IN")} towards PMS goal`,
		},
		{
			category: "AIF",
			suitabilityScore: riskScore >= 15 ? 80 : riskScore >= 12 ? 65 : 30,
			suitabilityLevel:
				riskScore >= 15
					? "Suitable"
					: riskScore >= 12
						? "Suitable with Caution"
						: "Not Suitable",
			minInvestment: "₹1,00,00,000",
			riskProfile: "High to Very High Risk",
			expectedReturns: "15-25% annually",
			regulations: [
				"SEBI Category I/II/III classification",
				"Minimum ₹1Cr investment per investor",
				"Maximum 1000 investors per fund",
				"Sophisticated investor requirements",
			],
			pros: [
				"Access to alternative strategies",
				"Potential for superior returns",
				"Professional management",
				"Diversification beyond traditional assets",
				"Tax pass-through benefits",
			],
			cons: [
				"Very high minimum investment",
				"Limited liquidity (lock-in periods)",
				"Complex strategies and risks",
				"High fees and carry structures",
				"Manager and strategy risk",
			],
			timelineToAccess: `${Math.ceil(10000000 / financialProfile.riskCapacity)} months with ₹72K monthly`,
			monthlyInvestmentSuggestion: `Build wealth systematically towards ₹1Cr target`,
		},
		{
			category: "Premium Bonds",
			suitabilityScore: riskScore >= 6 ? 90 : 80,
			suitabilityLevel: riskScore >= 8 ? "Highly Suitable" : "Suitable",
			minInvestment: "₹10,000",
			riskProfile: "Low to Medium Risk",
			expectedReturns: "8-12% annually",
			regulations: [
				"Corporate bonds - SEBI regulated",
				"Tax-free bonds - Government backed",
				"NCDs with credit ratings",
				"Regular interest payments",
			],
			pros: [
				"Fixed income predictability",
				"Credit rating transparency",
				"Better yields than FDs",
				"Portfolio diversification",
				"Tax benefits (for tax-free bonds)",
			],
			cons: [
				"Interest rate risk",
				"Credit risk for corporate bonds",
				"Limited liquidity in secondary market",
				"Inflation impact on real returns",
			],
			timelineToAccess: "Immediate",
			monthlyInvestmentSuggestion: `₹${(financialProfile.riskCapacity * 0.25).toLocaleString("en-IN")}`,
		},
	];

	return assessments;
};

export function RiskAssessment() {
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [showResults, setShowResults] = useState(false);
	const [riskProfile, setRiskProfile] = useState<
		"conservative" | "moderate" | "aggressive"
	>("moderate");
	const [riskScore, setRiskScore] = useState(0);

	const calculateRiskProfile = () => {
		const totalScore = Object.entries(answers).reduce(
			(sum, [questionId, answer]) => {
				const question = riskQuestions.find((q) => q.id === questionId);
				const option = question?.options.find((o) => o.value === answer);
				return sum + (option?.score || 0);
			},
			0,
		);

		setRiskScore(totalScore);

		if (totalScore <= 8) {
			setRiskProfile("conservative");
		} else if (totalScore <= 15) {
			setRiskProfile("moderate");
		} else {
			setRiskProfile("aggressive");
		}

		setShowResults(true);
	};

	const getInvestmentRecommendations = (): InvestmentRecommendation[] => {
		if (riskProfile === "conservative") {
			return [
				{
					category: "Fixed Income",
					instruments: ["PPF", "NSC", "Bank FDs", "Conservative Hybrid Funds"],
					allocation: 60,
					riskLevel: "Low",
					expectedReturn: "7-9%",
					liquidity: "Low to Medium",
				},
				{
					category: "Equity - Large Cap",
					instruments: [
						"Large Cap Mutual Funds",
						"Index Funds",
						"Blue Chip Stocks",
					],
					allocation: 30,
					riskLevel: "Medium",
					expectedReturn: "10-12%",
					liquidity: "High",
				},
				{
					category: "Gold",
					instruments: ["Gold ETFs", "Gold Mutual Funds", "Digital Gold"],
					allocation: 10,
					riskLevel: "Low",
					expectedReturn: "8-10%",
					liquidity: "High",
				},
			];
		}
		if (riskProfile === "moderate") {
			return [
				{
					category: "Equity - Diversified",
					instruments: ["Flexi Cap Funds", "Large Cap Funds", "Mid Cap Funds"],
					allocation: 60,
					riskLevel: "Medium",
					expectedReturn: "12-15%",
					liquidity: "High",
				},
				{
					category: "Fixed Income",
					instruments: [
						"Balanced Funds",
						"Corporate Bond Funds",
						"Medium Duration Funds",
					],
					allocation: 30,
					riskLevel: "Low to Medium",
					expectedReturn: "8-10%",
					liquidity: "Medium",
				},
				{
					category: "Alternative Investments",
					instruments: ["REITs", "Gold ETFs", "International Funds"],
					allocation: 10,
					riskLevel: "Medium",
					expectedReturn: "10-12%",
					liquidity: "Medium",
				},
			];
		}
		return [
			{
				category: "High Growth Equity",
				instruments: [
					"Small Cap Funds",
					"Mid Cap Funds",
					"Sectoral Funds",
					"Thematic Funds",
				],
				allocation: 70,
				riskLevel: "High",
				expectedReturn: "15-20%",
				liquidity: "High",
			},
			{
				category: "Emerging Markets",
				instruments: [
					"International Funds",
					"Emerging Market Funds",
					"Technology Funds",
				],
				allocation: 20,
				riskLevel: "High",
				expectedReturn: "12-18%",
				liquidity: "Medium",
			},
			{
				category: "Alternative Assets",
				instruments: ["REITs", "AIFs", "PMS", "Crypto (through MFs)"],
				allocation: 10,
				riskLevel: "Very High",
				expectedReturn: "15-25%",
				liquidity: "Low to Medium",
			},
		];
	};

	const getRiskProfileDescription = () => {
		switch (riskProfile) {
			case "conservative":
				return {
					title: "Conservative Investor",
					description:
						"You prioritize capital preservation over growth. You prefer stable, predictable returns even if they are lower.",
					characteristics: [
						"Low risk tolerance",
						"Prefers guaranteed returns",
						"Short to medium investment horizon",
						"Values liquidity",
					],
					color: "green",
				};
			case "moderate":
				return {
					title: "Moderate Investor",
					description:
						"You seek balanced growth with reasonable risk. You can tolerate some volatility for better returns.",
					characteristics: [
						"Moderate risk tolerance",
						"Balanced approach",
						"Medium to long investment horizon",
						"Comfortable with some volatility",
					],
					color: "blue",
				};
			case "aggressive":
				return {
					title: "Aggressive Investor",
					description:
						"You prioritize wealth creation and can handle significant volatility for higher potential returns.",
					characteristics: [
						"High risk tolerance",
						"Growth focused",
						"Long investment horizon",
						"Can handle market volatility",
					],
					color: "purple",
				};
		}
	};

	const allQuestionsAnswered = riskQuestions.every((q) => answers[q.id]);
	const profileInfo = getRiskProfileDescription();
	const recommendations = getInvestmentRecommendations();
	const premiumAssessments = showResults
		? getPremiumInvestmentSuitability(riskProfile, riskScore)
		: [];

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold">Risk Profile Assessment</h2>
				<p className="text-muted-foreground">
					Discover your investment personality and get personalized
					recommendations
				</p>
			</div>

			{!showResults ? (
				<Card data-testid="card-risk-questionnaire">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Target className="w-5 h-5 text-blue-600" />
							Investment Risk Questionnaire
						</CardTitle>
						<CardDescription>
							Answer these questions to determine your ideal investment strategy
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{riskQuestions.map((question, questionIndex) => (
							<div
								key={question.id}
								className="space-y-3"
								data-testid={`question-${question.id}`}
							>
								<Label className="text-base font-medium">
									{questionIndex + 1}. {question.question}
								</Label>
								<RadioGroup
									value={answers[question.id] || ""}
									onValueChange={(value) =>
										setAnswers({ ...answers, [question.id]: value })
									}
								>
									{question.options.map((option) => (
										<div
											key={option.value}
											className="flex items-center space-x-2"
										>
											<RadioGroupItem
												value={option.value}
												id={option.value}
												data-testid={`option-${question.id}-${option.value}`}
											/>
											<Label htmlFor={option.value} className="cursor-pointer">
												{option.label}
											</Label>
										</div>
									))}
								</RadioGroup>
							</div>
						))}

						<Button
							onClick={calculateRiskProfile}
							disabled={!allQuestionsAnswered}
							className="w-full"
							data-testid="button-calculate-risk-profile"
						>
							<Calculator className="w-4 h-4 mr-2" />
							Calculate My Risk Profile
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-6">
					{/* Risk Profile Result */}
					<Card data-testid="card-risk-profile-result">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<LucideShield
									className={`w-5 h-5 text-${profileInfo.color}-600`}
								/>
								Your Risk Profile: {profileInfo.title}
							</CardTitle>
							<CardDescription>{profileInfo.description}</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<span>Risk Score</span>
									<Badge
										variant={
											profileInfo.color === "green"
												? "secondary"
												: profileInfo.color === "blue"
													? "default"
													: "destructive"
										}
									>
										{riskScore} / 20
									</Badge>
								</div>

								<div className="space-y-2">
									<Label>Key Characteristics</Label>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
										{profileInfo.characteristics.map((char, index) => (
											<div
												key={index}
												className="flex items-center gap-2 p-2 bg-muted rounded"
												data-testid={`characteristic-${index}`}
											>
												<CheckCircle className="w-4 h-4 text-green-600" />
												<span className="text-sm">{char}</span>
											</div>
										))}
									</div>
								</div>

								<Button
									variant="outline"
									onClick={() => setShowResults(false)}
									data-testid="button-retake-assessment"
								>
									Retake Assessment
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* Investment Recommendations */}
					<Card data-testid="card-investment-recommendations">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<PieChart className="w-5 h-5 text-purple-600" />
								Personalized Investment Recommendations
							</CardTitle>
							<CardDescription>
								Based on your {profileInfo.title.toLowerCase()} risk profile
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-6">
								{/* Asset Allocation Chart */}
								<div className="space-y-4">
									<h4 className="font-medium">Recommended Asset Allocation</h4>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										{recommendations.map((rec, index) => (
											<div
												key={index}
												className="text-center p-4 border rounded-lg"
												data-testid={`allocation-${index}`}
											>
												<div className="text-2xl font-bold text-blue-600">
													{rec.allocation}%
												</div>
												<div className="font-medium">{rec.category}</div>
												<div className="text-xs text-muted-foreground mt-1">
													{rec.expectedReturn} returns
												</div>
											</div>
										))}
									</div>
								</div>

								{/* Detailed Recommendations */}
								<div className="space-y-4">
									<h4 className="font-medium">Investment Instruments</h4>
									<div className="space-y-3">
										{recommendations.map((rec, index) => (
											<Card
												key={index}
												className="p-4"
												data-testid={`recommendation-${index}`}
											>
												<div className="space-y-3">
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-3">
															<div
																className={`p-2 rounded-lg ${
																	rec.riskLevel === "Low"
																		? "bg-green-100 dark:bg-green-900/30 text-green-600"
																		: rec.riskLevel === "Medium"
																			? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
																			: rec.riskLevel === "High"
																				? "bg-orange-100 dark:bg-orange-900/30 text-orange-600"
																				: "bg-red-100 dark:bg-red-900/30 text-red-600"
																}`}
															>
																{rec.riskLevel === "Low" ? (
																	<LucideShield className="w-4 h-4" />
																) : rec.riskLevel === "Medium" ? (
																	<BarChart3 className="w-4 h-4" />
																) : rec.riskLevel === "High" ? (
																	<TrendingUp className="w-4 h-4" />
																) : (
																	<Zap className="w-4 h-4" />
																)}
															</div>
															<div>
																<h5 className="font-medium">{rec.category}</h5>
																<p className="text-sm text-muted-foreground">
																	{rec.allocation}% allocation
																</p>
															</div>
														</div>
														<div className="text-right">
															<Badge variant="outline">
																{rec.riskLevel} Risk
															</Badge>
															<p className="text-sm text-muted-foreground mt-1">
																{rec.expectedReturn}
															</p>
														</div>
													</div>

													<div className="space-y-2">
														<Label className="text-sm font-medium">
															Recommended Instruments:
														</Label>
														<div className="flex flex-wrap gap-2">
															{rec.instruments.map((instrument, instIndex) => (
																<Badge
																	key={instIndex}
																	variant="secondary"
																	className="text-xs"
																	data-testid={`instrument-${index}-${instIndex}`}
																>
																	{instrument}
																</Badge>
															))}
														</div>
													</div>

													<div className="grid grid-cols-2 gap-4 text-sm">
														<div className="flex justify-between">
															<span className="text-muted-foreground">
																Expected Returns:
															</span>
															<span className="font-medium">
																{rec.expectedReturn}
															</span>
														</div>
														<div className="flex justify-between">
															<span className="text-muted-foreground">
																Liquidity:
															</span>
															<span className="font-medium">
																{rec.liquidity}
															</span>
														</div>
													</div>
												</div>
											</Card>
										))}
									</div>
								</div>

								{/* Premium Investment Suitability Assessment */}
								<Card
									data-testid="card-premium-investment-suitability"
									className="bg-gradient-to-r from-amber-50 dark:from-amber-950/30 to-orange-50 dark:to-orange-950/30 border-amber-200 dark:border-amber-800"
								>
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
											<Star className="w-5 h-5 text-amber-600" />
											Premium Investment Suitability Assessment
										</CardTitle>
										<CardDescription className="text-amber-700 dark:text-amber-300">
											Based on your risk profile and financial capacity -
											aligned with current regulations
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											{premiumAssessments.map((assessment, index) => (
												<Card
													key={index}
													className={`border-2 transition-colors ${
														assessment.suitabilityLevel === "Highly Suitable"
															? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30"
															: assessment.suitabilityLevel === "Suitable"
																? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30"
																: assessment.suitabilityLevel ===
																		"Suitable with Caution"
																	? "border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30"
																	: "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30"
													}`}
													data-testid={`premium-assessment-${index}`}
												>
													<CardContent className="p-4">
														<div className="space-y-4">
															{/* Header */}
															<div className="flex items-center justify-between">
																<div className="flex items-center gap-2">
																	{assessment.category === "REITs/InvITs" ? (
																		<Building2 className="w-5 h-5 text-blue-600" />
																	) : assessment.category === "PMS" ? (
																		<Briefcase className="w-5 h-5 text-purple-600" />
																	) : assessment.category === "AIF" ? (
																		<Crown className="w-5 h-5 text-indigo-600" />
																	) : (
																		<FileText className="w-5 h-5 text-green-600" />
																	)}
																	<h4 className="font-semibold">
																		{assessment.category}
																	</h4>
																</div>
																<Badge
																	variant={
																		assessment.suitabilityLevel ===
																		"Highly Suitable"
																			? "default"
																			: assessment.suitabilityLevel ===
																					"Suitable"
																				? "secondary"
																				: assessment.suitabilityLevel ===
																						"Suitable with Caution"
																					? "outline"
																					: "destructive"
																	}
																	className="text-xs"
																>
																	{assessment.suitabilityLevel}
																</Badge>
															</div>

															{/* Suitability Score */}
															<div className="space-y-2">
																<div className="flex justify-between items-center">
																	<span className="text-sm font-medium">
																		Suitability Score
																	</span>
																	<span className="font-bold">
																		{assessment.suitabilityScore}/100
																	</span>
																</div>
																<Progress
																	value={assessment.suitabilityScore}
																	className="h-2"
																/>
															</div>

															{/* Key Details */}
															<div className="grid grid-cols-2 gap-3 text-sm">
																<div>
																	<span className="text-muted-foreground">
																		Min Investment:
																	</span>
																	<p className="font-medium">
																		{assessment.minInvestment}
																	</p>
																</div>
																<div>
																	<span className="text-muted-foreground">
																		Expected Returns:
																	</span>
																	<p className="font-medium">
																		{assessment.expectedReturns}
																	</p>
																</div>
																<div>
																	<span className="text-muted-foreground">
																		Risk Level:
																	</span>
																	<p className="font-medium">
																		{assessment.riskProfile}
																	</p>
																</div>
																<div>
																	<span className="text-muted-foreground">
																		Access Timeline:
																	</span>
																	<p className="font-medium">
																		{assessment.timelineToAccess}
																	</p>
																</div>
															</div>

															{/* Current Regulations */}
															<div className="space-y-2">
																<h5 className="text-sm font-medium">
																	📋 Current Regulations
																</h5>
																<div className="space-y-1">
																	{assessment.regulations
																		.slice(0, 2)
																		.map((reg, regIndex) => (
																			<div
																				key={regIndex}
																				className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 p-2 rounded"
																			>
																				{reg}
																			</div>
																		))}
																</div>
															</div>

															{/* Pros & Cons */}
															<div className="grid grid-cols-1 gap-3">
																<div className="space-y-2">
																	<h5 className="text-sm font-medium text-green-700 dark:text-green-300">
																		✅ Key Benefits
																	</h5>
																	<div className="space-y-1">
																		{assessment.pros
																			.slice(0, 2)
																			.map((pro, proIndex) => (
																				<div
																					key={proIndex}
																					className="text-xs text-green-600 flex items-start gap-1"
																				>
																					<CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
																					<span>{pro}</span>
																				</div>
																			))}
																	</div>
																</div>
																<div className="space-y-2">
																	<h5 className="text-sm font-medium text-orange-700 dark:text-orange-300">
																		⚠️ Key Risks
																	</h5>
																	<div className="space-y-1">
																		{assessment.cons
																			.slice(0, 2)
																			.map((con, conIndex) => (
																				<div
																					key={conIndex}
																					className="text-xs text-orange-600 flex items-start gap-1"
																				>
																					<AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
																					<span>{con}</span>
																				</div>
																			))}
																	</div>
																</div>
															</div>

															{/* Investment Suggestion */}
															<div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
																<h5 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
																	💡 Investment Suggestion
																</h5>
																<p className="text-sm text-amber-700 dark:text-amber-300">
																	{assessment.monthlyInvestmentSuggestion}
																</p>
															</div>
														</div>
													</CardContent>
												</Card>
											))}
										</div>

										{/* Overall Premium Investment Strategy */}
										<div className="mt-6 p-4 bg-gradient-to-r from-purple-50 dark:from-purple-950/30 to-indigo-50 dark:to-indigo-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
											<h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
												<Star className="w-5 h-5" />
												Your Premium Investment Journey
											</h4>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
												<div className="space-y-2">
													<h5 className="font-medium text-purple-800 dark:text-purple-200">
														🎯 Start Now
													</h5>
													<div className="space-y-1">
														{premiumAssessments
															.filter((a) => a.timelineToAccess === "Immediate")
															.map((a, i) => (
																<div
																	key={i}
																	className="text-purple-700 dark:text-purple-300"
																>
																	• {a.category}
																</div>
															))}
													</div>
												</div>
												<div className="space-y-2">
													<h5 className="font-medium text-purple-800 dark:text-purple-200">
														📈 Medium Term (2-6 years)
													</h5>
													<div className="space-y-1">
														{premiumAssessments
															.filter((a) => a.category === "PMS")
															.map((a, i) => (
																<div
																	key={i}
																	className="text-purple-700 dark:text-purple-300"
																>
																	• {a.category} - {a.timelineToAccess}
																</div>
															))}
													</div>
												</div>
												<div className="space-y-2">
													<h5 className="font-medium text-purple-800 dark:text-purple-200">
														🏆 Long Term (7+ years)
													</h5>
													<div className="space-y-1">
														{premiumAssessments
															.filter((a) => a.category === "AIF")
															.map((a, i) => (
																<div
																	key={i}
																	className="text-purple-700 dark:text-purple-300"
																>
																	• {a.category} - {a.timelineToAccess}
																</div>
															))}
													</div>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Risk Management Tips */}
								<Card data-testid="card-risk-management-tips">
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<AlertTriangle className="w-5 h-5 text-orange-600" />
											Risk Management Tips
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											{riskProfile === "conservative" && (
												<>
													<div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
														<CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
														<div>
															<p className="font-medium">
																Focus on Capital Protection
															</p>
															<p className="text-sm text-muted-foreground">
																Prioritize government securities and high-grade
																corporate bonds
															</p>
														</div>
													</div>
													<div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
														<LucideShield className="w-5 h-5 text-blue-600 mt-0.5" />
														<div>
															<p className="font-medium">
																Emergency Fund Priority
															</p>
															<p className="text-sm text-muted-foreground">
																Maintain 12 months of expenses in liquid funds
															</p>
														</div>
													</div>
												</>
											)}

											{riskProfile === "moderate" && (
												<>
													<div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
														<Target className="w-5 h-5 text-blue-600 mt-0.5" />
														<div>
															<p className="font-medium">
																Balanced Diversification
															</p>
															<p className="text-sm text-muted-foreground">
																Mix growth and stability with 60:40 equity to
																debt ratio
															</p>
														</div>
													</div>
													<div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
														<PieChart className="w-5 h-5 text-purple-600 mt-0.5" />
														<div>
															<p className="font-medium">
																Regular Portfolio Review
															</p>
															<p className="text-sm text-muted-foreground">
																Rebalance annually to maintain target allocation
															</p>
														</div>
													</div>
												</>
											)}

											{riskProfile === "aggressive" && (
												<>
													<div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
														<TrendingUp className="w-5 h-5 text-purple-600 mt-0.5" />
														<div>
															<p className="font-medium">
																Growth-Oriented Strategy
															</p>
															<p className="text-sm text-muted-foreground">
																Focus on equity and growth assets for wealth
																multiplication
															</p>
														</div>
													</div>
													<div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
														<AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
														<div>
															<p className="font-medium">
																Volatility Management
															</p>
															<p className="text-sm text-muted-foreground">
																Stay invested during market downturns, use SIP
																for rupee cost averaging
															</p>
														</div>
													</div>
												</>
											)}

											<div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
												<Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
												<div>
													<p className="font-medium">Long-term Perspective</p>
													<p className="text-sm text-muted-foreground">
														Stick to your strategy and avoid emotional decisions
														based on short-term market movements
													</p>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Action Plan */}
								<Card data-testid="card-investment-action-plan">
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Target className="w-5 h-5 text-green-600" />
											Your Investment Action Plan
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div className="space-y-2">
													<h5 className="font-medium">
														Step 1: Emergency Fund
													</h5>
													<p className="text-sm text-muted-foreground">
														Build 6-12 months of expenses in liquid funds before
														investing
													</p>
												</div>
												<div className="space-y-2">
													<h5 className="font-medium">Step 2: Tax Planning</h5>
													<p className="text-sm text-muted-foreground">
														Maximize ELSS and PPF contributions for tax benefits
													</p>
												</div>
												<div className="space-y-2">
													<h5 className="font-medium">
														Step 3: Core Portfolio
													</h5>
													<p className="text-sm text-muted-foreground">
														Start SIPs in recommended categories based on
														allocation
													</p>
												</div>
												<div className="space-y-2">
													<h5 className="font-medium">
														Step 4: Review & Rebalance
													</h5>
													<p className="text-sm text-muted-foreground">
														Annual review and rebalancing to maintain target
														allocation
													</p>
												</div>
											</div>

											<div className="flex flex-wrap gap-2 mt-4">
												<Button data-testid="button-start-sip">
													<TrendingUp className="w-4 h-4 mr-2" />
													Start SIP
												</Button>
												<Button
													variant="outline"
													data-testid="button-explore-funds"
												>
													<PieChart className="w-4 h-4 mr-2" />
													Explore Funds
												</Button>
												<Button
													variant="outline"
													data-testid="button-book-consultation"
												>
													<Target className="w-4 h-4 mr-2" />
													Book Consultation
												</Button>
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
