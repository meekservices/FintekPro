import { IStorage } from "./storage";
import { z } from "zod";

export interface BbpsPaymentCompleteData {
	transactionId: string;
	userId: string;
	billerCode: string;
	billerName: string;
	categoryCode: string;
	amount: number;
	transactionDate: Date;
	customerParam: string;
}

export class BbpsExpenseIntegration {
	constructor(private storage: IStorage) {}

	// Map BBPS category codes to expense categories
	// Using expense system's predefined categories: food_dining, transportation, shopping, entertainment,
	// utilities, healthcare, education, travel, groceries, rent, insurance, investment, other
	private mapBbpsCategoryToExpenseCategory(bbpsCategoryCode: string): {
		category: string;
		subcategory?: string;
	} {
		const categoryMap: Record<
			string,
			{ category: string; subcategory?: string }
		> = {
			// Generic/Default mappings
			UTILITIES: { category: "utilities", subcategory: "Utility Bill" },
			BBPS: { category: "utilities", subcategory: "Bill Payment" },

			// Utility Bills
			ELECTRICITY: { category: "utilities", subcategory: "Electricity" },
			WATER: { category: "utilities", subcategory: "Water" },
			GAS: { category: "utilities", subcategory: "Gas/LPG" },
			PIPED_GAS: { category: "utilities", subcategory: "Piped Gas" },
			TELECOM_POSTPAID: {
				category: "utilities",
				subcategory: "Mobile Postpaid",
			},
			TELECOM_PREPAID: { category: "utilities", subcategory: "Mobile Prepaid" },
			BROADBAND: { category: "utilities", subcategory: "Broadband" },

			// Entertainment
			DTH: { category: "entertainment", subcategory: "DTH/Cable TV" },
			CABLE_TV: { category: "entertainment", subcategory: "Cable TV" },
			SUBSCRIPTION: { category: "entertainment", subcategory: "Subscriptions" },
			OTT: { category: "entertainment", subcategory: "OTT Platform" },

			// Insurance
			LIFE_INSURANCE: { category: "insurance", subcategory: "Life Insurance" },
			HEALTH_INSURANCE: {
				category: "insurance",
				subcategory: "Health Insurance",
			},
			VEHICLE_INSURANCE: {
				category: "insurance",
				subcategory: "Vehicle Insurance",
			},
			GENERAL_INSURANCE: {
				category: "insurance",
				subcategory: "General Insurance",
			},
			INSURANCE: { category: "insurance", subcategory: "Insurance Premium" },

			// Housing/Rent
			LOAN_REPAYMENT: { category: "rent", subcategory: "Loan EMI" },
			HOUSING_LOAN: { category: "rent", subcategory: "Home Loan EMI" },
			MUNICIPAL_TAXES: { category: "rent", subcategory: "Property Tax" },
			MUNICIPAL: { category: "rent", subcategory: "Municipal Services" },

			// Education
			EDUCATION_FEES: {
				category: "education",
				subcategory: "School/College Fees",
			},

			// Transportation
			FASTAG: { category: "transportation", subcategory: "FASTag Recharge" },
			METRO_CARD: { category: "transportation", subcategory: "Metro Card" },
		};

		return (
			categoryMap[bbpsCategoryCode] || {
				category: "other",
				subcategory: "Bill Payment",
			}
		);
	}

	// Auto-create expense when BBPS payment is successful
	async createExpenseFromBbpsPayment(
		paymentData: BbpsPaymentCompleteData,
	): Promise<void> {
		try {
			// Get category mapping
			const { category, subcategory } = this.mapBbpsCategoryToExpenseCategory(
				paymentData.categoryCode,
			);

			// Create expense entry
			const expenseData = {
				userId: paymentData.userId,
				amount: paymentData.amount.toString(),
				currency: "INR",
				description: `${paymentData.billerName} - Bill Payment`,
				transactionDate: paymentData.transactionDate,
				category,
				subcategory,
				paymentMethod: "bbps",
				merchantName: paymentData.billerName,
				tags: ["bbps", "bill-payment", paymentData.categoryCode.toLowerCase()],
				notes: `Auto-created from BBPS payment. Customer ID: ${paymentData.customerParam}`,
				bbpsTransactionId: paymentData.transactionId,
				isBbpsPayment: true,
				aiCategorized: false, // System categorized, not AI
				isVerified: true, // BBPS payments are verified
			};

			await this.storage.createExpense(expenseData);

			console.log(
				`✅ Created expense from BBPS payment: ${paymentData.transactionId}`,
			);
		} catch (error) {
			console.error(`❌ Failed to create expense from BBPS payment:`, error);
			throw error;
		}
	}

	// Get all BBPS-linked expenses for a user
	async getBbpsExpenses(userId: string): Promise<any[]> {
		try {
			const allExpenses = await this.storage.getUserExpenses(userId, {
				startDate: new Date(
					new Date().setFullYear(new Date().getFullYear() - 1),
				), // Last year
				endDate: new Date(),
			});

			return allExpenses.filter((expense) => expense.isBbpsPayment);
		} catch (error) {
			console.error("Error fetching BBPS expenses:", error);
			return [];
		}
	}

	// Get upcoming bills that need payment (for dashboard widget)
	async getUpcomingBills(userId: string): Promise<any[]> {
		try {
			// This would fetch from BBPS customer bills table
			// For now, return empty array - will be implemented with proper BBPS storage methods
			return [];
		} catch (error) {
			console.error("Error fetching upcoming bills:", error);
			return [];
		}
	}

	// Get spending insights by bill category
	async getBillSpendingInsights(
		userId: string,
		months: number = 6,
	): Promise<any> {
		try {
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - months);

			const bbpsExpenses = await this.getBbpsExpenses(userId);
			const recentBbpsExpenses = bbpsExpenses.filter(
				(expense) => new Date(expense.transactionDate) >= startDate,
			);

			// Group by category
			const categoryTotals: Record<string, number> = {};
			const categoryCount: Record<string, number> = {};

			recentBbpsExpenses.forEach((expense) => {
				const cat = expense.subcategory || expense.category;
				categoryTotals[cat] =
					(categoryTotals[cat] || 0) + Number.parseFloat(expense.amount);
				categoryCount[cat] = (categoryCount[cat] || 0) + 1;
			});

			// Calculate averages
			const insights = Object.entries(categoryTotals).map(
				([category, total]) => ({
					category,
					totalSpent: total,
					transactionCount: categoryCount[category],
					averageAmount: total / categoryCount[category],
				}),
			);

			return {
				totalBillsSpent: recentBbpsExpenses.reduce(
					(sum, e) => sum + Number.parseFloat(e.amount),
					0,
				),
				billCount: recentBbpsExpenses.length,
				categoryBreakdown: insights,
				period: `Last ${months} months`,
			};
		} catch (error) {
			console.error("Error generating bill spending insights:", error);
			return null;
		}
	}
}
