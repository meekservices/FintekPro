import { Request, Response } from "express";

// CIBIL API Service - Custom Implementation
// Based on TransUnion CIBIL credit bureau services and third-party integrations
export class CibilAPI {
	// Credit score check
	static async checkCreditScore(req: Request, res: Response) {
		try {
			const { fullName, mobileNumber, dateOfBirth, panNumber, email } =
				req.body;

			if (!fullName || !mobileNumber || !dateOfBirth || !panNumber) {
				return res.status(400).json({
					success: false,
					error:
						"Full name, mobile number, date of birth, and PAN number are required",
				});
			}

			// Simulate credit score calculation based on profile data
			const creditScore = CibilAPI.generateCreditScore(fullName, panNumber);
			const creditGrade = CibilAPI.getCreditGrade(creditScore);

			res.json({
				success: true,
				data: {
					creditScore,
					creditGrade,
					scoreRange: "300-900",
					reportDate: new Date().toISOString(),
					personalInfo: {
						name: fullName,
						pan: panNumber.replace(/(.{4})(.{4})(.{2})/, "$1****$3"),
						mobile: mobileNumber.replace(/(.{2})(.{6})(.{2})/, "$1******$3"),
						dateOfBirth,
					},
					creditSummary: {
						totalAccounts: CibilAPI.generateAccountCount(),
						activeAccounts: Math.floor(Math.random() * 8) + 2,
						totalCreditLimit: Math.floor(Math.random() * 1000000) + 200000,
						currentBalance: Math.floor(Math.random() * 100000) + 10000,
						oldestAccount: "2018-05-15",
						recentActivity: new Date(
							Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000,
						).toISOString(),
					},
					factors: CibilAPI.getCreditFactors(creditScore),
					recommendations: CibilAPI.getRecommendations(creditScore),
					reportId: `CIBIL${Date.now()}${Math.floor(Math.random() * 1000)}`,
				},
			});
		} catch (error) {
			console.error("Error checking credit score:", error);
			res.status(500).json({
				success: false,
				error: "Failed to check credit score",
			});
		}
	}

	// Detailed credit report
	static async getDetailedReport(req: Request, res: Response) {
		try {
			const { reportId, userConsent } = req.body;

			if (!reportId || !userConsent) {
				return res.status(400).json({
					success: false,
					error: "Report ID and user consent are required",
				});
			}

			const creditAccounts = CibilAPI.generateCreditAccounts();
			const enquiryHistory = CibilAPI.generateEnquiryHistory();

			res.json({
				success: true,
				data: {
					reportId,
					generatedDate: new Date().toISOString(),
					validUntil: new Date(
						Date.now() + 30 * 24 * 60 * 60 * 1000,
					).toISOString(),
					creditAccounts,
					enquiryHistory,
					publicRecords: [],
					identityInformation: {
						nameVariations: ["Current legal name"],
						addresses: [
							{
								type: "Current",
								address: "*** *** *** (Masked for privacy)",
								reportedDate: "2024-01-15",
							},
						],
						phoneNumbers: [
							{
								number: "******7890",
								type: "Mobile",
								reportedDate: "2024-01-15",
							},
						],
					},
					creditUtilization: {
						totalLimit: creditAccounts.reduce(
							(sum: number, acc: any) => sum + acc.creditLimit,
							0,
						),
						totalUsed: creditAccounts.reduce(
							(sum: number, acc: any) => sum + acc.currentBalance,
							0,
						),
						utilizationRatio: Math.floor(Math.random() * 30) + 10, // 10-40%
					},
					paymentHistory: {
						onTimePayments: Math.floor(Math.random() * 95) + 85, // 85-100%
						latePayments: Math.floor(Math.random() * 3),
						missedPayments: Math.floor(Math.random() * 2),
					},
				},
			});
		} catch (error) {
			console.error("Error generating detailed report:", error);
			res.status(500).json({
				success: false,
				error: "Failed to generate detailed credit report",
			});
		}
	}

	// Credit monitoring setup
	static async setupCreditMonitoring(req: Request, res: Response) {
		try {
			const { reportId, alertPreferences, notificationMethod } = req.body;

			if (!reportId) {
				return res.status(400).json({
					success: false,
					error: "Report ID is required",
				});
			}

			res.json({
				success: true,
				data: {
					monitoringId: `MON${Date.now()}`,
					status: "Active",
					alertTypes: alertPreferences || [
						"Credit score changes",
						"New account openings",
						"Hard inquiries",
						"Payment defaults",
					],
					notificationMethod: notificationMethod || "email",
					frequency: "Real-time",
					nextMonitoringDate: new Date(
						Date.now() + 24 * 60 * 60 * 1000,
					).toISOString(),
					features: [
						"Monthly credit score updates",
						"Identity theft protection",
						"Credit utilization alerts",
						"New account notifications",
					],
				},
			});
		} catch (error) {
			console.error("Error setting up credit monitoring:", error);
			res.status(500).json({
				success: false,
				error: "Failed to setup credit monitoring",
			});
		}
	}

	// Credit improvement suggestions
	static async getCreditImprovementTips(req: Request, res: Response) {
		try {
			const { creditScore, creditUtilization, paymentHistory } = req.body;

			if (!creditScore) {
				return res.status(400).json({
					success: false,
					error: "Credit score is required",
				});
			}

			const tips = CibilAPI.generateImprovementTips(
				creditScore,
				creditUtilization,
				paymentHistory,
			);

			res.json({
				success: true,
				data: {
					currentScore: creditScore,
					potentialIncrease: Math.floor(Math.random() * 50) + 20,
					timeToImprove: "3-6 months",
					improvementTips: tips,
					priorityActions: [
						"Pay all bills on time",
						"Keep credit utilization below 30%",
						"Don't close old credit cards",
						"Limit new credit applications",
					],
					riskFactors: CibilAPI.getRiskFactors(creditScore),
					nextReviewDate: new Date(
						Date.now() + 90 * 24 * 60 * 60 * 1000,
					).toISOString(),
				},
			});
		} catch (error) {
			console.error("Error getting improvement tips:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get credit improvement tips",
			});
		}
	}

	// Loan eligibility check
	static async checkLoanEligibility(req: Request, res: Response) {
		try {
			const {
				creditScore,
				monthlyIncome,
				employmentType,
				existingEMIs,
				loanType,
				loanAmount,
			} = req.body;

			if (!creditScore || !monthlyIncome || !loanType || !loanAmount) {
				return res.status(400).json({
					success: false,
					error:
						"Credit score, monthly income, loan type, and loan amount are required",
				});
			}

			const eligibility = CibilAPI.calculateLoanEligibility(
				creditScore,
				monthlyIncome,
				existingEMIs,
				loanAmount,
			);

			res.json({
				success: true,
				data: {
					eligible: eligibility.eligible,
					eligibilityPercentage: eligibility.percentage,
					maxLoanAmount: eligibility.maxAmount,
					recommendedAmount: eligibility.recommendedAmount,
					estimatedEMI: eligibility.emi,
					interestRate: eligibility.interestRate,
					processingFee: eligibility.processingFee,
					reasons: eligibility.reasons,
					improvementSuggestions: eligibility.improvements,
					bankRecommendations: [
						{
							bank: "HDFC Bank",
							interestRate: eligibility.interestRate - 0.25,
							maxAmount: eligibility.maxAmount * 1.1,
							features: [
								"Quick approval",
								"Minimal documentation",
								"Online process",
							],
						},
						{
							bank: "ICICI Bank",
							interestRate: eligibility.interestRate - 0.15,
							maxAmount: eligibility.maxAmount,
							features: [
								"Instant approval",
								"Flexible tenure",
								"Prepayment allowed",
							],
						},
						{
							bank: "Axis Bank",
							interestRate: eligibility.interestRate,
							maxAmount: eligibility.maxAmount * 0.9,
							features: [
								"Same day disbursement",
								"Competitive rates",
								"No hidden charges",
							],
						},
					],
				},
			});
		} catch (error) {
			console.error("Error checking loan eligibility:", error);
			res.status(500).json({
				success: false,
				error: "Failed to check loan eligibility",
			});
		}
	}

	// Credit card eligibility
	static async checkCreditCardEligibility(req: Request, res: Response) {
		try {
			const { creditScore, monthlyIncome, employmentType, existingCards } =
				req.body;

			if (!creditScore || !monthlyIncome) {
				return res.status(400).json({
					success: false,
					error: "Credit score and monthly income are required",
				});
			}

			const cardRecommendations = CibilAPI.getCardRecommendations(
				creditScore,
				monthlyIncome,
			);

			res.json({
				success: true,
				data: {
					eligible: creditScore >= 650,
					creditScore,
					recommendedCards: cardRecommendations,
					estimatedLimit: Math.min(monthlyIncome * 3, 500000),
					eligibilityFactors: {
						creditScore:
							creditScore >= 700
								? "Excellent"
								: creditScore >= 650
									? "Good"
									: "Fair",
						income:
							monthlyIncome >= 50000
								? "High"
								: monthlyIncome >= 25000
									? "Medium"
									: "Low",
						existingDebt: (existingCards || 0) < 3 ? "Low" : "Moderate",
					},
					tips: [
						"Maintain credit score above 750 for premium cards",
						"Keep credit utilization below 30%",
						"Build strong payment history",
						"Avoid multiple applications in short time",
					],
				},
			});
		} catch (error) {
			console.error("Error checking credit card eligibility:", error);
			res.status(500).json({
				success: false,
				error: "Failed to check credit card eligibility",
			});
		}
	}

	// Private helper methods
	private static generateCreditScore(name: string, pan: string): number {
		// Generate deterministic but varied credit score based on user data
		const hash = (name + pan).split("").reduce((a, b) => {
			a = (a << 5) - a + b.charCodeAt(0);
			return a & a;
		}, 0);
		return Math.abs(hash % 300) + 600; // Score between 600-900
	}

	private static getCreditGrade(score: number): string {
		if (score >= 800) return "Excellent";
		if (score >= 750) return "Very Good";
		if (score >= 700) return "Good";
		if (score >= 650) return "Fair";
		return "Poor";
	}

	private static generateAccountCount(): number {
		return Math.floor(Math.random() * 12) + 3; // 3-15 accounts
	}

	private static getCreditFactors(score: number): any[] {
		return [
			{
				factor: "Payment History",
				impact:
					score >= 750 ? "Positive" : score >= 650 ? "Neutral" : "Negative",
				weight: "35%",
				description: "Your track record of making payments on time",
			},
			{
				factor: "Credit Utilization",
				impact: "Positive",
				weight: "30%",
				description:
					"How much credit you're using vs. your total available credit",
			},
			{
				factor: "Length of Credit History",
				impact: "Positive",
				weight: "15%",
				description: "How long you've been using credit",
			},
			{
				factor: "Types of Credit",
				impact: "Neutral",
				weight: "10%",
				description: "The mix of credit accounts you have",
			},
			{
				factor: "Recent Credit",
				impact: score >= 700 ? "Positive" : "Neutral",
				weight: "10%",
				description: "Recent credit applications and new accounts",
			},
		];
	}

	private static getRecommendations(score: number): string[] {
		if (score >= 750) {
			return [
				"Excellent credit! You qualify for the best interest rates",
				"Consider premium credit cards with better rewards",
				"You can negotiate better loan terms with banks",
			];
		}
		if (score >= 650) {
			return [
				"Good credit score. Focus on improving to reach excellent range",
				"Pay bills on time to maintain positive payment history",
				"Keep credit utilization below 30%",
			];
		}
		return [
			"Focus on building credit history with timely payments",
			"Consider secured credit cards to improve score",
			"Pay down existing debt to improve utilization ratio",
			"Avoid applying for new credit for now",
		];
	}

	private static generateCreditAccounts(): any[] {
		const accountTypes = [
			"Credit Card",
			"Personal Loan",
			"Home Loan",
			"Auto Loan",
		];
		const banks = ["HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak Bank"];

		return Array.from(
			{ length: Math.floor(Math.random() * 6) + 2 },
			(_, i) => ({
				accountId: `ACC${Date.now()}${i}`,
				accountType:
					accountTypes[Math.floor(Math.random() * accountTypes.length)],
				bank: banks[Math.floor(Math.random() * banks.length)],
				openDate: new Date(
					2018 + Math.floor(Math.random() * 6),
					Math.floor(Math.random() * 12),
					Math.floor(Math.random() * 28),
				).toISOString(),
				creditLimit: Math.floor(Math.random() * 500000) + 50000,
				currentBalance: Math.floor(Math.random() * 50000),
				paymentStatus: Math.random() > 0.8 ? "30 Days Late" : "Current",
				lastPayment: new Date(
					Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000,
				).toISOString(),
			}),
		);
	}

	private static generateEnquiryHistory(): any[] {
		const enquiryTypes = [
			"Credit Card",
			"Personal Loan",
			"Auto Loan",
			"Home Loan",
		];
		const companies = [
			"HDFC Bank",
			"ICICI Bank",
			"Bajaj Finserv",
			"Tata Capital",
		];

		return Array.from(
			{ length: Math.floor(Math.random() * 8) + 1 },
			(_, i) => ({
				enquiryId: `ENQ${Date.now()}${i}`,
				enquiryDate: new Date(
					Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000,
				).toISOString(),
				enquiryType:
					enquiryTypes[Math.floor(Math.random() * enquiryTypes.length)],
				company: companies[Math.floor(Math.random() * companies.length)],
				purpose: "New Credit Application",
				amount: Math.floor(Math.random() * 1000000) + 100000,
			}),
		);
	}

	private static generateImprovementTips(
		score: number,
		utilization?: number,
		paymentHistory?: number,
	): string[] {
		const tips = [];

		if (score < 700) {
			tips.push("Focus on making all payments on time for the next 6 months");
			tips.push("Pay down credit card balances to improve utilization ratio");
		}

		if (utilization && utilization > 30) {
			tips.push("Reduce credit utilization below 30% of total limit");
			tips.push("Consider paying off balances before statement generation");
		}

		if (paymentHistory && paymentHistory < 95) {
			tips.push("Set up automatic payments to avoid missing due dates");
			tips.push("Pay at least minimum amount due on all accounts");
		}

		tips.push(
			"Avoid closing old credit cards to maintain credit history length",
		);
		tips.push("Limit new credit applications to avoid hard inquiries");
		tips.push("Monitor your credit report regularly for errors");

		return tips.slice(0, 5); // Return top 5 tips
	}

	private static getRiskFactors(score: number): string[] {
		const factors = [];

		if (score < 650) {
			factors.push("Low credit score may limit loan approval chances");
			factors.push("Higher interest rates on approved loans");
		}

		if (score < 750) {
			factors.push("May not qualify for premium credit cards");
			factors.push("Limited negotiation power for loan terms");
		}

		return factors;
	}

	private static calculateLoanEligibility(
		score: number,
		income: number,
		existingEMIs: number,
		loanAmount: number,
	): any {
		let eligible = false;
		let percentage = 0;
		let interestRate = 12.0;

		// Basic eligibility based on credit score
		if (score >= 750) {
			eligible = true;
			percentage = 95;
			interestRate = 10.5;
		} else if (score >= 700) {
			eligible = true;
			percentage = 80;
			interestRate = 11.0;
		} else if (score >= 650) {
			eligible = true;
			percentage = 60;
			interestRate = 12.5;
		} else {
			eligible = false;
			percentage = 20;
			interestRate = 15.0;
		}

		// Adjust based on income and existing EMIs
		const maxEMI = income * 0.5; // 50% of income for EMIs
		const availableEMI = maxEMI - existingEMIs;
		const maxLoanAmount = availableEMI * 12 * 7; // 7 years max tenure

		if (loanAmount > maxLoanAmount) {
			eligible = false;
			percentage = Math.min(percentage, 30);
		}

		// Calculate EMI
		const monthlyRate = interestRate / 100 / 12;
		const tenure = 60; // 5 years
		const emi =
			(loanAmount * monthlyRate * (1 + monthlyRate) ** tenure) /
			((1 + monthlyRate) ** tenure - 1);

		return {
			eligible,
			percentage,
			maxAmount: Math.min(maxLoanAmount, 2000000),
			recommendedAmount: Math.min(loanAmount * 0.8, maxLoanAmount),
			emi: Math.round(emi),
			interestRate,
			processingFee: loanAmount * 0.02, // 2% processing fee
			reasons: eligible
				? ["Good credit score", "Sufficient income"]
				: ["Low credit score", "High debt-to-income ratio"],
			improvements: !eligible
				? [
						"Improve credit score above 650",
						"Increase monthly income",
						"Reduce existing EMIs",
					]
				: [],
		};
	}

	private static getCardRecommendations(score: number, income: number): any[] {
		const allCards = [
			{
				bank: "HDFC Bank",
				cardName: "Regalia Gold",
				minScore: 750,
				minIncome: 60000,
				annualFee: 2500,
				features: [
					"Airport lounge access",
					"Reward points",
					"Insurance coverage",
				],
				category: "Premium",
			},
			{
				bank: "ICICI Bank",
				cardName: "Amazon Pay",
				minScore: 700,
				minIncome: 25000,
				annualFee: 500,
				features: [
					"Cashback on Amazon",
					"Fuel surcharge waiver",
					"Movie tickets",
				],
				category: "Cashback",
			},
			{
				bank: "Axis Bank",
				cardName: "Flipkart",
				minScore: 650,
				minIncome: 20000,
				annualFee: 0,
				features: ["Flipkart cashback", "No annual fee", "EMI conversion"],
				category: "Entry Level",
			},
			{
				bank: "SBI",
				cardName: "SimplyCLICK",
				minScore: 650,
				minIncome: 25000,
				annualFee: 499,
				features: [
					"Online shopping rewards",
					"Dining benefits",
					"Fuel benefits",
				],
				category: "Rewards",
			},
		];

		return allCards.filter(
			(card) => score >= card.minScore && income >= card.minIncome,
		);
	}

	/**
	 * AUTO-POPULATION: Fetch active loan liabilities from CIBIL report
	 * Used for post-KYC auto-population of user's loan portfolio
	 */
	static async fetchLoanLiabilities(req: Request, res: Response) {
		try {
			const { panNumber, name, dob, mobile } = req.body;

			if (!panNumber || !name || !dob) {
				return res.status(400).json({
					success: false,
					error: "PAN number, name, and date of birth are required",
				});
			}

			console.log(`🔍 Fetching loan liabilities from CIBIL`);

			// In production, this would call the actual CIBIL API
			// For sandbox, generate realistic mock data
			const loanAccounts = CibilAPI.generateLoanLiabilities(panNumber, name);

			const response = {
				success: true,
				totalLoans: loanAccounts.length,
				totalOutstanding: loanAccounts.reduce(
					(sum, loan) => sum + loan.outstandingBalance,
					0,
				),
				totalMonthlyEMI: loanAccounts.reduce(
					(sum, loan) => sum + (loan.emi || 0),
					0,
				),
				loanAccounts,
				creditScore: CibilAPI.generateCreditScore(name, panNumber),
				fetchedAt: new Date().toISOString(),
				dataSource: "CIBIL Credit Bureau",
			};

			console.log(`✅ Fetched ${loanAccounts.length} loan accounts from CIBIL`);
			res.json(response);
		} catch (error: any) {
			console.error("❌ Error fetching loan liabilities:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch loan liabilities from CIBIL",
			});
		}
	}

	/**
	 * Generate realistic loan liabilities for sandbox/testing
	 */
	private static generateLoanLiabilities(pan: string, name: string): any[] {
		const loanTypes = [
			{
				type: "home_loan",
				label: "Home Loan",
				minAmount: 2000000,
				maxAmount: 8000000,
				tenure: 240,
				rate: 8.5,
			},
			{
				type: "personal_loan",
				label: "Personal Loan",
				minAmount: 100000,
				maxAmount: 500000,
				tenure: 48,
				rate: 12.5,
			},
			{
				type: "car_loan",
				label: "Car Loan",
				minAmount: 300000,
				maxAmount: 1500000,
				tenure: 60,
				rate: 10.0,
			},
			{
				type: "education_loan",
				label: "Education Loan",
				minAmount: 500000,
				maxAmount: 2000000,
				tenure: 96,
				rate: 9.5,
			},
			{
				type: "gold_loan",
				label: "Gold Loan",
				minAmount: 50000,
				maxAmount: 300000,
				tenure: 24,
				rate: 11.0,
			},
		];

		const banks = [
			"HDFC Bank",
			"ICICI Bank",
			"SBI",
			"Axis Bank",
			"Kotak Mahindra Bank",
			"IndusInd Bank",
		];

		// Generate 1-3 active loans based on PAN hash
		const hash = pan
			.split("")
			.reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0);
		const numLoans = Math.abs(hash % 3) + 1;

		const loans = [];
		const usedTypes = new Set();

		for (let i = 0; i < numLoans; i++) {
			let loanType = loanTypes[Math.abs(hash + i) % loanTypes.length];

			// Avoid duplicate loan types
			while (
				usedTypes.has(loanType.type) &&
				usedTypes.size < loanTypes.length
			) {
				loanType = loanTypes[Math.floor(Math.random() * loanTypes.length)];
			}
			usedTypes.add(loanType.type);

			const principalAmount = Math.floor(
				loanType.minAmount +
					Math.random() * (loanType.maxAmount - loanType.minAmount),
			);

			const monthsElapsed = Math.floor(Math.random() * 36) + 12; // 12-48 months elapsed
			const totalTenure = loanType.tenure;
			const remainingTenure = Math.max(totalTenure - monthsElapsed, 6);

			// Calculate outstanding using reducing balance method
			const monthlyRate = loanType.rate / 100 / 12;
			const emi =
				(principalAmount * monthlyRate * (1 + monthlyRate) ** totalTenure) /
				((1 + monthlyRate) ** totalTenure - 1);

			const outstandingBalance =
				(emi * ((1 + monthlyRate) ** remainingTenure - 1)) /
				(monthlyRate * (1 + monthlyRate) ** remainingTenure);

			const disbursalDate = new Date();
			disbursalDate.setMonth(disbursalDate.getMonth() - monthsElapsed);

			loans.push({
				loanAccountNumber: `LOAN${Math.abs(hash + i * 1000)}${Date.now().toString().slice(-6)}`,
				loanType: loanType.type,
				loanTypeName: loanType.label,
				lenderName: banks[Math.abs(hash + i) % banks.length],
				principalAmount,
				outstandingBalance: Math.round(outstandingBalance),
				emi: Math.round(emi),
				interestRate: loanType.rate,
				tenureMonths: totalTenure,
				remainingTenure,
				disbursalDate: disbursalDate.toISOString().split("T")[0],
				maturityDate: new Date(
					disbursalDate.getTime() + totalTenure * 30 * 24 * 60 * 60 * 1000,
				)
					.toISOString()
					.split("T")[0],
				accountStatus: "active",
				paymentStatus: Math.random() > 0.9 ? "overdue" : "current",
				dpd: Math.random() > 0.9 ? Math.floor(Math.random() * 30) + 1 : 0, // Days past due
				lastPaymentDate: new Date(
					Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000,
				)
					.toISOString()
					.split("T")[0],
				creditBureau: "CIBIL",
				reportDate: new Date().toISOString().split("T")[0],
			});
		}

		return loans;
	}
}
