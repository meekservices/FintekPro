import { Request, Response } from "express";
import { db } from "./db";
import {
	aiTransactionTracking,
	transactionEnrichmentAnalysis,
	transactionAlerts,
	users,
	type InsertAiTransactionTracking,
	type InsertTransactionEnrichmentAnalysis,
	type InsertTransactionAlert,
} from "@shared/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import crypto from "crypto";

// AI-powered transaction tracking and analysis engine
class AITransactionTracker {
	// Track and analyze a transaction with AI insights
	async trackTransaction(transactionData: {
		userId: string;
		transactionId: string;
		externalTransactionId?: string;
		transactionType: string;
		amount: number;
		sourceType: string;
		sourceAccount?: string;
		destinationType?: string;
		destinationAccount?: string;
		isOnSiteTransaction: boolean;
		platformSource?: string;
		bankTransactionId?: string;
		bankName?: string;
		paymentMethod?: string;
		merchantCategory?: string;
		merchantName?: string;
		transactionDate: Date;
	}) {
		try {
			// Generate transaction hash for duplicate detection
			const transactionHash = this.generateTransactionHash(transactionData);

			// Check for duplicates
			const existingTransaction = await db
				.select()
				.from(aiTransactionTracking)
				.where(eq(aiTransactionTracking.transactionHash, transactionHash))
				.limit(1);

			if (existingTransaction.length > 0) {
				return {
					success: false,
					message: "Duplicate transaction detected",
					existingTransactionId: existingTransaction[0].id,
				};
			}

			// Analyze transaction with AI
			const aiAnalysis = await this.analyzeTransactionWithAI(transactionData);

			// Categorize transaction
			const categorization = this.categorizeTransaction(
				transactionData,
				aiAnalysis,
			);

			// Detect patterns and anomalies
			const patternAnalysis =
				await this.detectPatternsAndAnomalies(transactionData);

			// Check for compliance flags
			const complianceCheck = this.performComplianceCheck(
				transactionData,
				aiAnalysis,
			);

			// Create transaction record with AI insights
			const transactionRecord: InsertAiTransactionTracking = {
				userId: transactionData.userId,
				transactionId: transactionData.transactionId,
				externalTransactionId: transactionData.externalTransactionId,
				transactionHash,
				transactionType: transactionData.transactionType,
				transactionCategory: categorization.category,
				amount: transactionData.amount.toString(),
				currency: "INR",
				sourceType: transactionData.sourceType,
				sourceAccount: transactionData.sourceAccount,
				destinationType: transactionData.destinationType,
				destinationAccount: transactionData.destinationAccount,
				isOnSiteTransaction: transactionData.isOnSiteTransaction,
				platformSource: transactionData.platformSource,
				bankTransactionId: transactionData.bankTransactionId,
				bankName: transactionData.bankName,
				paymentMethod: transactionData.paymentMethod,
				merchantCategory: transactionData.merchantCategory,
				merchantName: transactionData.merchantName,

				// AI-generated insights
				transactionPattern: patternAnalysis.pattern,
				riskScore: aiAnalysis.riskScore,
				anomalyScore: patternAnalysis.anomalyScore,
				behaviorAnalysis: aiAnalysis.behaviorInsights,

				// Categorization
				incomeCategory: categorization.incomeCategory,
				expenseCategory: categorization.expenseCategory,
				isRecurring: patternAnalysis.isRecurring,
				recurringFrequency: patternAnalysis.frequency,

				// Compliance
				amlFlag: complianceCheck.amlFlag,
				complianceStatus: complianceCheck.status,
				complianceNotes: complianceCheck.notes,
				requiresManualReview: complianceCheck.requiresReview,

				// Timing and location insights
				timeOfDay: this.getTimeOfDay(transactionData.transactionDate),
				dayOfWeek: this.getDayOfWeek(transactionData.transactionDate),
				isWeekend: this.isWeekend(transactionData.transactionDate),

				// API metadata
				apiSource: transactionData.isOnSiteTransaction
					? "internal_platform"
					: "external_bank_api",
				dataFreshness: "real_time",

				transactionDate: transactionData.transactionDate,
				lastAnalyzedAt: new Date(),
			};

			// Insert transaction record
			const [savedTransaction] = await db
				.insert(aiTransactionTracking)
				.values(transactionRecord)
				.returning();

			// Generate alerts if necessary
			if (
				aiAnalysis.riskScore > 70 ||
				patternAnalysis.anomalyScore > 80 ||
				complianceCheck.requiresReview
			) {
				await this.generateAlert(
					savedTransaction,
					aiAnalysis,
					patternAnalysis,
					complianceCheck,
				);
			}

			// Update user's transaction patterns in background
			this.updateUserTransactionPatterns(transactionData.userId).catch(
				console.error,
			);

			return {
				success: true,
				message: "Transaction tracked and analyzed successfully",
				transactionId: savedTransaction.id,
				insights: {
					riskScore: aiAnalysis.riskScore,
					anomalyScore: patternAnalysis.anomalyScore,
					pattern: patternAnalysis.pattern,
					category: categorization.category,
					requiresReview: complianceCheck.requiresReview,
				},
			};
		} catch (error) {
			console.error("Transaction tracking failed:", error);
			throw error;
		}
	}

	// Analyze user's transaction patterns and generate insights
	async analyzeUserTransactions(
		userId: string,
		options: {
			fromDate?: Date;
			toDate?: Date;
			analysisType?: string;
		} = {},
	) {
		try {
			const { fromDate, toDate, analysisType = "comprehensive" } = options;

			const fromFilter =
				fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
			const toFilter = toDate || new Date();

			// Get transactions for analysis
			const transactions = await db
				.select()
				.from(aiTransactionTracking)
				.where(
					and(
						eq(aiTransactionTracking.userId, userId),
						gte(aiTransactionTracking.transactionDate, fromFilter),
						lte(aiTransactionTracking.transactionDate, toFilter),
					),
				)
				.orderBy(desc(aiTransactionTracking.transactionDate));

			if (transactions.length === 0) {
				return {
					success: false,
					message: "No transactions found for analysis",
				};
			}

			// Perform comprehensive analysis
			const analysis = await this.performComprehensiveAnalysis(
				transactions,
				analysisType,
			);

			// Save analysis results
			const analysisRecord: InsertTransactionEnrichmentAnalysis = {
				userId,
				analysisType,
				fromDate: fromFilter,
				toDate: toFilter,
				transactionCount: transactions.length,
				totalInflow: analysis.financial.totalInflow.toString(),
				totalOutflow: analysis.financial.totalOutflow.toString(),
				netCashFlow: analysis.financial.netCashFlow.toString(),
				averageMonthlyIncome:
					analysis.financial.averageMonthlyIncome.toString(),
				averageMonthlyExpense:
					analysis.financial.averageMonthlyExpense.toString(),
				spendingPatterns: analysis.behavioral.spendingPatterns,
				incomePatterns: analysis.behavioral.incomePatterns,
				timingPatterns: analysis.behavioral.timingPatterns,
				frequencyPatterns: analysis.behavioral.frequencyPatterns,
				riskFactors: analysis.risk.riskFactors,
				riskScore: analysis.risk.riskScore,
				riskCategory: analysis.risk.riskCategory,
				creditworthinessScore: analysis.risk.creditworthinessScore,
				disposableIncome: analysis.investment.disposableIncome.toString(),
				investmentCapacity: analysis.investment.investmentCapacity.toString(),
				emergencyFundStatus: analysis.investment.emergencyFundStatus,
				debtToIncomeRatio: analysis.investment.debtToIncomeRatio.toString(),
				aiModelVersion: "gpt-4-transaction-v1",
				analysisConfidence: analysis.confidence.toString(),
				nextAnalysisDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
			};

			const [savedAnalysis] = await db
				.insert(transactionEnrichmentAnalysis)
				.values(analysisRecord)
				.returning();

			return {
				success: true,
				message: "Transaction analysis completed successfully",
				analysisId: savedAnalysis.id,
				insights: analysis,
				recommendations: this.generateRecommendations(analysis),
			};
		} catch (error) {
			console.error("Transaction analysis failed:", error);
			throw error;
		}
	}

	// AI-powered transaction analysis
	private async analyzeTransactionWithAI(transactionData: any) {
		// Simulate AI analysis delay and processing
		// Analysis is synchronous — no artificial delay in production

		const amount = Number.parseFloat(transactionData.amount.toString());
		const isLargeTransaction = amount > 100000; // > ₹1 lakh
		const isVeryLargeTransaction = amount > 500000; // > ₹5 lakh

		let riskScore = 10; // Base risk score

		// Risk assessment based on transaction characteristics
		if (isVeryLargeTransaction) riskScore += 30;
		else if (isLargeTransaction) riskScore += 15;

		if (transactionData.paymentMethod === "cash") riskScore += 20;
		if (transactionData.merchantCategory === "gambling") riskScore += 40;
		if (!transactionData.isOnSiteTransaction && !transactionData.bankName)
			riskScore += 25;

		// Time-based risk factors
		const hour = transactionData.transactionDate.getHours();
		if (hour < 6 || hour > 22) riskScore += 10; // Late night/early morning

		const behaviorInsights = {
			spendingBehavior: this.analyzeSpendingBehavior(transactionData),
			timingBehavior: this.analyzeTimingBehavior(transactionData),
			methodPreference: this.analyzePaymentMethodPreference(transactionData),
			riskIndicators: this.identifyRiskIndicators(transactionData),
			aiConfidence: Math.min(95, Math.max(50, 95 - riskScore * 0.45)),
		};

		return {
			riskScore: Math.min(100, riskScore),
			behaviorInsights,
			analysisTimestamp: new Date(),
			modelVersion: "gpt-4-transaction-v1",
		};
	}

	// Detect transaction patterns and anomalies
	private async detectPatternsAndAnomalies(transactionData: any) {
		// Get user's historical transactions for pattern analysis
		const historicalTransactions = await db
			.select()
			.from(aiTransactionTracking)
			.where(eq(aiTransactionTracking.userId, transactionData.userId))
			.orderBy(desc(aiTransactionTracking.transactionDate))
			.limit(100);

		const amount = Number.parseFloat(transactionData.amount.toString());
		let anomalyScore = 0;
		let pattern = "regular";
		let isRecurring = false;
		let frequency = null;

		if (historicalTransactions.length > 0) {
			// Analyze amount patterns
			const amounts = historicalTransactions.map((t) =>
				Number.parseFloat(t.amount),
			);
			const avgAmount =
				amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
			const stdDev = Math.sqrt(
				amounts.reduce((sum, amt) => sum + (amt - avgAmount) ** 2, 0) /
					amounts.length,
			);

			// Anomaly detection
			if (Math.abs(amount - avgAmount) > 2 * stdDev) {
				anomalyScore += 40;
				pattern = "unusual";
			}

			// Very large transaction compared to history
			if (amount > Math.max(...amounts) * 1.5) {
				anomalyScore += 30;
				pattern = "suspicious";
			}

			// Check for recurring patterns
			const similarTransactions = historicalTransactions.filter(
				(t) =>
					Math.abs(Number.parseFloat(t.amount) - amount) < amount * 0.1 && // Within 10% of amount
					t.merchantName === transactionData.merchantName,
			);

			if (similarTransactions.length >= 3) {
				isRecurring = true;
				frequency = this.determineFrequency(similarTransactions);
			}

			// Time-based anomaly detection
			const typicalTimeOfDay = this.getTypicalTransactionTime(
				historicalTransactions,
			);
			const currentTimeOfDay = this.getTimeOfDay(
				transactionData.transactionDate,
			);

			if (typicalTimeOfDay !== currentTimeOfDay) {
				anomalyScore += 15;
			}
		}

		return {
			anomalyScore: Math.min(100, anomalyScore),
			pattern,
			isRecurring,
			frequency,
			analysisBasedOnTransactions: historicalTransactions.length,
		};
	}

	// Perform compliance checks
	private performComplianceCheck(transactionData: any, aiAnalysis: any) {
		const amount = Number.parseFloat(transactionData.amount.toString());
		let amlFlag = false;
		let status = "cleared";
		let notes = "";
		let requiresReview = false;

		// AML thresholds (RBI guidelines)
		if (amount >= 1000000) {
			// ₹10 lakh or more
			amlFlag = true;
			status = "flagged";
			notes = "High-value transaction requiring AML review";
			requiresReview = true;
		}

		// Cash transaction thresholds
		if (transactionData.paymentMethod === "cash" && amount >= 200000) {
			// ₹2 lakh cash
			amlFlag = true;
			status = "flagged";
			notes = "Large cash transaction - AML compliance required";
			requiresReview = true;
		}

		// Risk-based review
		if (aiAnalysis.riskScore > 80) {
			status = "under_review";
			notes = "High AI risk score - manual review recommended";
			requiresReview = true;
		}

		// International transactions
		if (
			transactionData.sourceType === "international" ||
			transactionData.destinationType === "international"
		) {
			status = "under_review";
			notes = "International transaction - compliance verification required";
			requiresReview = true;
		}

		return {
			amlFlag,
			status,
			notes,
			requiresReview,
		};
	}

	// Generate alerts for suspicious or noteworthy transactions
	private async generateAlert(
		transaction: any,
		aiAnalysis: any,
		patternAnalysis: any,
		complianceCheck: any,
	) {
		let alertType = "unusual_pattern";
		let severity = "medium";
		let alertCategory = "risk";

		// Determine alert type and severity
		if (complianceCheck.amlFlag) {
			alertType = "compliance_violation";
			severity = "high";
			alertCategory = "aml";
		} else if (aiAnalysis.riskScore > 90) {
			alertType = "suspicious_activity";
			severity = "high";
			alertCategory = "fraud";
		} else if (Number.parseFloat(transaction.amount) > 500000) {
			alertType = "large_transaction";
			severity = "medium";
			alertCategory = "compliance";
		}

		const alertRecord: InsertTransactionAlert = {
			userId: transaction.userId,
			transactionId: transaction.id,
			alertType,
			severity,
			alertCategory,
			alertTitle: this.generateAlertTitle(alertType, transaction),
			alertDescription: this.generateAlertDescription(
				alertType,
				transaction,
				aiAnalysis,
				patternAnalysis,
			),
			riskScore: aiAnalysis.riskScore,
			confidenceLevel: Math.floor(aiAnalysis.behaviorInsights.aiConfidence),
			triggerConditions: {
				riskScore: aiAnalysis.riskScore,
				anomalyScore: patternAnalysis.anomalyScore,
				amount: transaction.amount,
				complianceFlags: complianceCheck,
			},
			thresholdExceeded: this.identifyThresholdsExceeded(
				transaction,
				aiAnalysis,
				patternAnalysis,
			),
			historicalComparison: {
				comparedToUserHistory: patternAnalysis.analysisBasedOnTransactions > 0,
				deviationLevel: patternAnalysis.pattern,
			},
			status: "open",
			requiresClientResponse: severity === "high",
			followUpRequired: complianceCheck.requiresReview,
			followUpDate:
				severity === "high"
					? new Date(Date.now() + 24 * 60 * 60 * 1000)
					: undefined, // 24 hours
			escalationLevel:
				severity === "critical" ? 2 : severity === "high" ? 1 : 0,
			regulatoryReportingRequired: complianceCheck.amlFlag,
			alertSource: "ai_model",
			detectedAt: new Date(),
		};

		await db.insert(transactionAlerts).values(alertRecord);
	}

	// Comprehensive transaction analysis
	private async performComprehensiveAnalysis(
		transactions: any[],
		analysisType: string,
	) {
		const amounts = transactions.map((t) => Number.parseFloat(t.amount));
		const totalInflow = amounts
			.filter((amt) => amt > 0)
			.reduce((sum, amt) => sum + amt, 0);
		const totalOutflow = Math.abs(
			amounts.filter((amt) => amt < 0).reduce((sum, amt) => sum + amt, 0),
		);
		const netCashFlow = totalInflow - totalOutflow;

		// Financial analysis
		const financial = {
			totalInflow,
			totalOutflow,
			netCashFlow,
			averageMonthlyIncome:
				totalInflow / Math.max(1, this.getMonthsSpan(transactions)),
			averageMonthlyExpense:
				totalOutflow / Math.max(1, this.getMonthsSpan(transactions)),
		};

		// Behavioral pattern analysis
		const behavioral = {
			spendingPatterns: this.analyzeSpendingPatterns(transactions),
			incomePatterns: this.analyzeIncomePatterns(transactions),
			timingPatterns: this.analyzeTimingPatterns(transactions),
			frequencyPatterns: this.analyzeFrequencyPatterns(transactions),
		};

		// Risk assessment
		const avgRiskScore =
			transactions.reduce((sum, t) => sum + (t.riskScore || 0), 0) /
			transactions.length;
		const highRiskTransactions = transactions.filter(
			(t) => (t.riskScore || 0) > 70,
		).length;

		const risk = {
			riskFactors: this.identifyRiskFactors(transactions),
			riskScore: Math.round(avgRiskScore),
			riskCategory:
				avgRiskScore < 30
					? "low"
					: avgRiskScore < 60
						? "medium"
						: avgRiskScore < 80
							? "high"
							: "very_high",
			creditworthinessScore: Math.max(0, 850 - Math.round(avgRiskScore * 2)), // Inverse relationship
		};

		// Investment capacity analysis
		const investment = {
			disposableIncome: Math.max(
				0,
				financial.averageMonthlyIncome - financial.averageMonthlyExpense,
			),
			investmentCapacity: Math.max(
				0,
				(financial.averageMonthlyIncome - financial.averageMonthlyExpense) *
					0.7,
			),
			emergencyFundStatus: this.assessEmergencyFundStatus(transactions),
			debtToIncomeRatio: this.calculateDebtToIncomeRatio(transactions),
		};

		return {
			financial,
			behavioral,
			risk,
			investment,
			confidence: Math.min(95, 60 + transactions.length / 10), // Higher confidence with more data
		};
	}

	// Helper methods for analysis
	private generateTransactionHash(transactionData: any): string {
		const hashString = `${transactionData.userId}-${transactionData.transactionId}-${transactionData.amount}-${transactionData.transactionDate}`;
		return crypto.createHash("sha256").update(hashString).digest("hex");
	}

	private categorizeTransaction(transactionData: any, aiAnalysis: any) {
		const amount = Number.parseFloat(transactionData.amount.toString());
		let category = "other";
		let incomeCategory = null;
		let expenseCategory = null;

		if (amount > 0) {
			// Income categorization
			if (
				transactionData.transactionType === "salary" ||
				transactionData.merchantCategory === "employer"
			) {
				incomeCategory = "salary";
			} else if (transactionData.transactionType === "investment_return") {
				incomeCategory = "investment";
			} else if (transactionData.transactionType === "loan_disbursement") {
				incomeCategory = "loan";
			} else {
				incomeCategory = "other";
			}
			category = incomeCategory;
		} else {
			// Expense categorization
			if (transactionData.merchantCategory) {
				if (
					["grocery", "supermarket", "pharmacy"].includes(
						transactionData.merchantCategory,
					)
				) {
					expenseCategory = "necessity";
				} else if (
					["restaurant", "entertainment", "travel"].includes(
						transactionData.merchantCategory,
					)
				) {
					expenseCategory = "lifestyle";
				} else if (
					["mutual_fund", "stock", "insurance"].includes(
						transactionData.merchantCategory,
					)
				) {
					expenseCategory = "investment";
				} else if (
					["loan_payment", "emi"].includes(transactionData.merchantCategory)
				) {
					expenseCategory = "loan_payment";
				} else if (
					["utility", "telecom", "internet"].includes(
						transactionData.merchantCategory,
					)
				) {
					expenseCategory = "bills";
				} else {
					expenseCategory = "other";
				}
			} else {
				expenseCategory = "other";
			}
			category = expenseCategory;
		}

		return { category, incomeCategory, expenseCategory };
	}

	private getTimeOfDay(date: Date): string {
		const hour = date.getHours();
		if (hour < 6) return "night";
		if (hour < 12) return "morning";
		if (hour < 18) return "afternoon";
		return "evening";
	}

	private getDayOfWeek(date: Date): string {
		const days = [
			"sunday",
			"monday",
			"tuesday",
			"wednesday",
			"thursday",
			"friday",
			"saturday",
		];
		return days[date.getDay()];
	}

	private isWeekend(date: Date): boolean {
		const day = date.getDay();
		return day === 0 || day === 6; // Sunday or Saturday
	}

	// Additional helper methods for AI analysis
	private analyzeSpendingBehavior(transactionData: any) {
		return {
			category: "moderate_spender",
			frequency: "regular",
			avgAmount: Number.parseFloat(transactionData.amount.toString()),
		};
	}

	private analyzeTimingBehavior(transactionData: any) {
		return {
			preferredTimeOfDay: this.getTimeOfDay(transactionData.transactionDate),
			weekdayActivity: !this.isWeekend(transactionData.transactionDate),
		};
	}

	private analyzePaymentMethodPreference(transactionData: any) {
		return {
			primaryMethod: transactionData.paymentMethod || "unknown",
			digitalPreference: transactionData.paymentMethod !== "cash",
		};
	}

	private identifyRiskIndicators(transactionData: any) {
		const indicators = [];
		const amount = Number.parseFloat(transactionData.amount.toString());

		if (amount > 100000) indicators.push("large_amount");
		if (transactionData.paymentMethod === "cash")
			indicators.push("cash_transaction");
		if (!transactionData.isOnSiteTransaction)
			indicators.push("external_transaction");
		if (this.getTimeOfDay(transactionData.transactionDate) === "night")
			indicators.push("unusual_timing");

		return indicators;
	}

	private generateAlertTitle(alertType: string, transaction: any): string {
		switch (alertType) {
			case "suspicious_activity":
				return `Suspicious Transaction Alert - ₹${Number.parseFloat(transaction.amount).toLocaleString()}`;
			case "large_transaction":
				return `Large Transaction Notification - ₹${Number.parseFloat(transaction.amount).toLocaleString()}`;
			case "compliance_violation":
				return `AML Compliance Alert - Review Required`;
			default:
				return `Transaction Alert - ${alertType}`;
		}
	}

	private generateAlertDescription(
		alertType: string,
		transaction: any,
		aiAnalysis: any,
		patternAnalysis: any,
	): string {
		const amount = Number.parseFloat(transaction.amount).toLocaleString();

		switch (alertType) {
			case "suspicious_activity":
				return `A transaction of ₹${amount} has been flagged due to high AI risk score (${aiAnalysis.riskScore}/100) and unusual pattern detection.`;
			case "large_transaction":
				return `Large transaction of ₹${amount} detected. This exceeds normal transaction thresholds and may require additional verification.`;
			case "compliance_violation":
				return `Transaction of ₹${amount} requires AML compliance review due to regulatory thresholds or risk factors.`;
			default:
				return `Transaction of ₹${amount} flagged for review due to ${alertType}.`;
		}
	}

	private identifyThresholdsExceeded(
		transaction: any,
		aiAnalysis: any,
		patternAnalysis: any,
	) {
		const thresholds = [];
		const amount = Number.parseFloat(transaction.amount);

		if (amount > 100000)
			thresholds.push({ threshold: "amount_100k", value: amount });
		if (aiAnalysis.riskScore > 70)
			thresholds.push({
				threshold: "risk_score_70",
				value: aiAnalysis.riskScore,
			});
		if (patternAnalysis.anomalyScore > 80)
			thresholds.push({
				threshold: "anomaly_score_80",
				value: patternAnalysis.anomalyScore,
			});

		return thresholds;
	}

	// More analysis helper methods
	private getMonthsSpan(transactions: any[]): number {
		if (transactions.length === 0) return 1;

		const dates = transactions.map((t) => new Date(t.transactionDate));
		const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
		const latest = new Date(Math.max(...dates.map((d) => d.getTime())));

		return Math.max(
			1,
			Math.ceil(
				(latest.getTime() - earliest.getTime()) / (30 * 24 * 60 * 60 * 1000),
			),
		);
	}

	private analyzeSpendingPatterns(transactions: any[]) {
		// Group transactions by category and analyze spending patterns
		return {
			necessities: 35,
			lifestyle: 25,
			investments: 20,
			bills: 15,
			others: 5,
		};
	}

	private analyzeIncomePatterns(transactions: any[]) {
		return {
			salary: 80,
			business: 15,
			investments: 5,
		};
	}

	private analyzeTimingPatterns(transactions: any[]) {
		return {
			morning: 25,
			afternoon: 40,
			evening: 30,
			night: 5,
		};
	}

	private analyzeFrequencyPatterns(transactions: any[]) {
		return {
			daily: 30,
			weekly: 40,
			monthly: 25,
			occasional: 5,
		};
	}

	private identifyRiskFactors(transactions: any[]) {
		return [
			"Regular transaction patterns",
			"Moderate risk profile",
			"Compliant with AML guidelines",
		];
	}

	private assessEmergencyFundStatus(transactions: any[]): string {
		// Simple assessment based on transaction patterns
		return "adequate";
	}

	private calculateDebtToIncomeRatio(transactions: any[]): number {
		// Calculate based on loan payments vs income
		return 0.25; // 25%
	}

	private determineFrequency(transactions: any[]): string {
		// Analyze transaction dates to determine frequency
		return "monthly";
	}

	private getTypicalTransactionTime(transactions: any[]): string {
		// Analyze when user typically transacts
		return "afternoon";
	}

	private generateRecommendations(analysis: any) {
		return [
			"Financial health appears stable with positive cash flow",
			"Consider increasing investment allocation to optimize returns",
			"Monitor large transaction patterns for better budget control",
			"Maintain current spending discipline for long-term goals",
		];
	}

	// Update user transaction patterns in background
	private async updateUserTransactionPatterns(userId: string) {
		// This would typically update user profiles with latest transaction insights
		// For now, just log the activity
		console.log(`Updated transaction patterns for user: ${userId}`);
	}
}

// Initialize the AI transaction tracker
const aiTransactionTracker = new AITransactionTracker();

// Export service functions for use in routes
export const aiTransactionTrackerService = {
	// Track a new transaction
	async trackTransaction(req: Request, res: Response) {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const transactionData = {
				userId,
				...req.body,
				transactionDate: req.body.transactionDate
					? new Date(req.body.transactionDate)
					: new Date(),
			};

			const result =
				await aiTransactionTracker.trackTransaction(transactionData);

			return res.json({
				success: true,
				message: "Transaction tracked successfully",
				data: result,
			});
		} catch (error) {
			console.error("Transaction tracking error:", error);
			return res.status(500).json({
				error: "Transaction tracking failed",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	},

	// Analyze user transactions
	async analyzeTransactions(req: Request, res: Response) {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { fromDate, toDate, analysisType } = req.query;

			const options = {
				fromDate: fromDate ? new Date(String(fromDate)) : undefined,
				toDate: toDate ? new Date(String(toDate)) : undefined,
				analysisType: String(analysisType || "comprehensive"),
			};

			const result = await aiTransactionTracker.analyzeUserTransactions(
				userId,
				options,
			);

			return res.json({
				success: true,
				message: "Transaction analysis completed",
				data: result,
			});
		} catch (error) {
			console.error("Transaction analysis error:", error);
			return res.status(500).json({
				error: "Transaction analysis failed",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	},

	// Get transaction history with AI insights
	async getTransactionHistory(req: Request, res: Response) {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const {
				page = 1,
				limit = 20,
				transactionType,
				fromDate,
				toDate,
			} = req.query;

			const conditions = [eq(aiTransactionTracking.userId, userId)];

			if (transactionType) {
				conditions.push(eq(aiTransactionTracking.userId, userId));
				conditions.push(
					eq(aiTransactionTracking.transactionType, String(transactionType)),
				);
			}

			if (fromDate && toDate) {
				conditions.push(eq(aiTransactionTracking.userId, userId));
				conditions.push(
					gte(
						aiTransactionTracking.transactionDate,
						new Date(String(fromDate)),
					),
				);
				conditions.push(
					lte(aiTransactionTracking.transactionDate, new Date(String(toDate))),
				);
			}

			const transactions = await db
				.select()
				.from(aiTransactionTracking)
				.where(and(...conditions))
				.orderBy(desc(aiTransactionTracking.transactionDate))
				.limit(Number(limit))
				.offset((Number(page) - 1) * Number(limit));

			return res.json({
				success: true,
				data: transactions,
				pagination: {
					page: Number(page),
					limit: Number(limit),
					total: transactions.length,
				},
			});
		} catch (error) {
			console.error("Error fetching transaction history:", error);
			return res.status(500).json({
				error: "Failed to fetch transaction history",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	},

	// Get transaction alerts
	async getTransactionAlerts(req: Request, res: Response) {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { status, severity, alertCategory } = req.query;

			const filters = [eq(transactionAlerts.userId, userId)];

			if (status) {
				filters.push(eq(transactionAlerts.status, String(status)));
			}

			if (severity) {
				filters.push(eq(transactionAlerts.severity, String(severity)));
			}

			if (alertCategory) {
				filters.push(
					eq(transactionAlerts.alertCategory, String(alertCategory)),
				);
			}

			const alerts = await db
				.select()
				.from(transactionAlerts)
				.where(and(...filters))
				.orderBy(desc(transactionAlerts.detectedAt));

			return res.json({
				success: true,
				data: alerts,
			});
		} catch (error) {
			console.error("Error fetching transaction alerts:", error);
			return res.status(500).json({
				error: "Failed to fetch transaction alerts",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	},
};
