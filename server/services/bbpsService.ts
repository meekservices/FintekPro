import { eq, and } from "drizzle-orm";
import { getAppBaseUrl } from '../utils/app-url';
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  bbpsCategories,
  bbpsBillers,
  bbpsCustomerBills,
  bbpsTransactions,
  type BbpsCategory,
  type BbpsBiller,
  type BbpsCustomerBill,
  type BbpsTransaction,
  type InsertBbpsCategory,
  type InsertBbpsBiller,
  type InsertBbpsCustomerBill,
  type InsertBbpsTransaction,
} from "../../shared/schema";
import { v4 as uuidv4 } from "uuid";
import { cashfreeService } from "../cashfree-service";

// Database connection — uses PRODUCTION_DATABASE_URL (same Neon instance as the rest of the app).
// DATABASE_URL is the old Replit-managed dev database which is being removed.
const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) throw new Error("No database URL configured (PRODUCTION_DATABASE_URL is required)");
const sql = neon(dbUrl);
const db = drizzle(sql);

// BBPS Service Configuration
const BBPS_CONFIG = {
  API_BASE_URL: process.env.BBPS_API_URL || "https://api.bharat-billpay.in/v1",
  API_KEY: process.env.BBPS_API_KEY || "",
  MERCHANT_ID: process.env.BBPS_MERCHANT_ID || "",
  ENVIRONMENT: process.env.NODE_ENV || "development",
};

export class BBPSService {
  private static instance: BBPSService;

  private constructor() {}

  public static getInstance(): BBPSService {
    if (!BBPSService.instance) {
      BBPSService.instance = new BBPSService();
    }
    return BBPSService.instance;
  }

  // Initialize BBPS categories and billers
  async initializeBBPSData() {
    try {
      // Check if categories already exist
      const existingCategories = await db.select().from(bbpsCategories).limit(1);
      
      if (existingCategories.length === 0) {
        // Insert default BBPS categories
        const defaultCategories: InsertBbpsCategory[] = [
          {
            categoryName: "Electricity",
            categoryCode: "ELECTRICITY",
            description: "Electricity bill payments",
          },
          {
            categoryName: "Gas",
            categoryCode: "GAS",
            description: "Gas bill payments",
          },
          {
            categoryName: "Water",
            categoryCode: "WATER",
            description: "Water bill payments",
          },
          {
            categoryName: "Telecom Postpaid",
            categoryCode: "TELECOM_POSTPAID",
            description: "Mobile postpaid bill payments",
          },
          {
            categoryName: "Telecom Prepaid",
            categoryCode: "TELECOM_PREPAID",
            description: "Mobile prepaid recharge",
          },
          {
            categoryName: "DTH",
            categoryCode: "DTH",
            description: "DTH recharge",
          },
          {
            categoryName: "Broadband",
            categoryCode: "BROADBAND",
            description: "Broadband bill payments",
          },
          {
            categoryName: "Insurance",
            categoryCode: "INSURANCE",
            description: "Insurance premium payments",
          },
          {
            categoryName: "Loan Repayment",
            categoryCode: "LOAN_REPAYMENT",
            description: "Loan EMI payments",
          },
          {
            categoryName: "Municipal Services",
            categoryCode: "MUNICIPAL",
            description: "Municipal tax and service payments",
          },
        ];

        await db.insert(bbpsCategories).values(defaultCategories);
        console.log("✅ BBPS categories initialized successfully");

        // Insert sample billers for each category
        const categories = await db.select().from(bbpsCategories);
        const sampleBillers: InsertBbpsBiller[] = [];

        for (const category of categories) {
          switch (category.categoryCode) {
            case "ELECTRICITY":
              sampleBillers.push(
                {
                  billerName: "BSES Rajdhani Power Limited",
                  billerCode: "BSES001",
                  categoryId: category.id,
                  billerAliasName: "BSES Rajdhani",
                  billerCoverage: "DELHI",
                  customerParamName: "Consumer Number",
                },
                {
                  billerName: "Tata Power Mumbai",
                  billerCode: "TPML001",
                  categoryId: category.id,
                  billerAliasName: "Tata Power",
                  billerCoverage: "MUMBAI",
                  customerParamName: "Consumer Number",
                }
              );
              break;

            case "TELECOM_POSTPAID":
              sampleBillers.push(
                {
                  billerName: "Airtel",
                  billerCode: "AIRTEL001",
                  categoryId: category.id,
                  billerAliasName: "Bharti Airtel",
                  billerCoverage: "ALL_INDIA",
                  customerParamName: "Mobile Number",
                },
                {
                  billerName: "Vodafone Idea",
                  billerCode: "VI001",
                  categoryId: category.id,
                  billerAliasName: "Vi",
                  billerCoverage: "ALL_INDIA",
                  customerParamName: "Mobile Number",
                }
              );
              break;

            case "GAS":
              sampleBillers.push(
                {
                  billerName: "Indraprastha Gas Limited",
                  billerCode: "IGL001",
                  categoryId: category.id,
                  billerAliasName: "IGL",
                  billerCoverage: "DELHI_NCR",
                  customerParamName: "BP Number",
                }
              );
              break;

            case "DTH":
              sampleBillers.push(
                {
                  billerName: "Tata Play",
                  billerCode: "TATAPLAY001",
                  categoryId: category.id,
                  billerAliasName: "Tata Play",
                  billerCoverage: "ALL_INDIA",
                  customerParamName: "Subscriber ID",
                }
              );
              break;
          }
        }

        if (sampleBillers.length > 0) {
          await db.insert(bbpsBillers).values(sampleBillers);
          console.log("✅ BBPS sample billers initialized successfully");
        }
      }
    } catch (error) {
      console.error("❌ Error initializing BBPS data:", error);
      throw error;
    }
  }

  // Get all active categories
  async getCategories(): Promise<BbpsCategory[]> {
    return await db
      .select()
      .from(bbpsCategories)
      .where(eq(bbpsCategories.isActive, true));
  }

  // Get billers by category
  async getBillersByCategory(categoryId: string): Promise<BbpsBiller[]> {
    return await db
      .select()
      .from(bbpsBillers)
      .where(
        and(
          eq(bbpsBillers.categoryId, categoryId),
          eq(bbpsBillers.isActive, true)
        )
      );
  }

  // Fetch bill details from BBPS API (mock implementation)
  async fetchBill(params: {
    billerId: string;
    customerParam: string;
    userId: string;
  }): Promise<BbpsCustomerBill> {
    try {
      const { billerId, customerParam, userId } = params;

      // Get biller details
      const biller = await db
        .select()
        .from(bbpsBillers)
        .where(eq(bbpsBillers.id, billerId))
        .limit(1);

      if (!biller[0]) {
        throw new Error("Biller not found");
      }

      // Mock API call to BBPS - In production, this would be actual API call
      const mockBillData = {
        billAmount: (Math.random() * 5000 + 500).toFixed(0), // Random amount between 500-5500
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days from now
        billDate: new Date().toISOString().split('T')[0],
        billPeriod: "Nov 2024",
        customerName: "John Doe",
        additionalInfo: {
          lastPaymentDate: "2024-10-15",
          outstandingAmount: "0",
          units: "245 kWh",
        },
      };

      // Create bill record
      const billData: InsertBbpsCustomerBill = {
        userId,
        billerId,
        customerParam,
        billAmount: mockBillData.billAmount,
        dueDate: mockBillData.dueDate,
        billDate: mockBillData.billDate,
        billPeriod: mockBillData.billPeriod,
        billFetchStatus: "SUCCESS",
        billData: JSON.stringify(mockBillData),
        fetchedAt: new Date(),
      };

      const [insertedBill] = await db
        .insert(bbpsCustomerBills)
        .values(billData)
        .returning();

      return insertedBill;
    } catch (error) {
      console.error("Error fetching bill:", error);
      
      // Create failed bill record
      const failedBillData: InsertBbpsCustomerBill = {
        userId: params.userId,
        billerId: params.billerId,
        customerParam: params.customerParam,
        billFetchStatus: "FAILED",
        fetchedAt: new Date(),
      };

      await db.insert(bbpsCustomerBills).values(failedBillData);
      throw error;
    }
  }

  // Initiate bill payment through Cashfree
  async initiateBillPayment(params: {
    billId: string;
    paymentAmount: string;
    userId: string;
    userPhone?: string;
    userEmail?: string;
    userName?: string;
  }): Promise<{ transaction: BbpsTransaction; paymentUrl: string }> {
    try {
      const { billId, paymentAmount, userId, userPhone, userEmail, userName } = params;

      // Get bill details
      const bill = await db
        .select()
        .from(bbpsCustomerBills)
        .where(eq(bbpsCustomerBills.id, billId))
        .limit(1);

      if (!bill[0]) {
        throw new Error("Bill not found");
      }

      // Get biller details
      const biller = await db
        .select()
        .from(bbpsBillers)
        .where(eq(bbpsBillers.id, bill[0].billerId))
        .limit(1);

      if (!biller[0]) {
        throw new Error("Biller not found");
      }

      // Generate transaction ID
      const transactionId = `BBPS${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      // Create Cashfree payment order
      const cashfreeOrder = await cashfreeService.createOrder({
        amount: parseFloat(paymentAmount),
        userId,
        phone: userPhone,
        email: userEmail,
        name: userName,
        returnUrl: `${getAppBaseUrl()}/api/bbps/payment-callback`,
      });

      if (!cashfreeOrder.success || !cashfreeOrder.orderId) {
        throw new Error(cashfreeOrder.message || "Failed to create payment order");
      }

      // Create BBPS transaction record with PENDING status
      const transactionData: InsertBbpsTransaction = {
        userId,
        billId,
        billerCode: biller[0].billerCode,
        customerParam: bill[0].customerParam,
        amount: paymentAmount,
        paymentAmount,
        transactionId,
        paymentStatus: "PENDING",
        paymentMode: "cashfree",
        transactionReference: cashfreeOrder.orderId,
        initiatedAt: new Date(),
      };

      const [insertedTransaction] = await db
        .insert(bbpsTransactions)
        .values(transactionData)
        .returning();

      console.log(`✅ BBPS payment initiated: ${transactionId} -> Cashfree order: ${cashfreeOrder.orderId}`);

      return {
        transaction: insertedTransaction,
        paymentUrl: cashfreeOrder.paymentUrl || "",
      };
    } catch (error) {
      console.error("Error initiating BBPS payment:", error);
      throw error;
    }
  }

  // Confirm payment after Cashfree callback
  async confirmPayment(params: {
    transactionId: string;
    cashfreeOrderId: string;
    status: "SUCCESS" | "FAILED";
    bbpsTransactionId?: string;
    failureReason?: string;
  }): Promise<BbpsTransaction> {
    try {
      const { transactionId, status, bbpsTransactionId, failureReason } = params;

      // Get transaction
      const [transaction] = await db
        .select()
        .from(bbpsTransactions)
        .where(eq(bbpsTransactions.transactionId, transactionId))
        .limit(1);

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      // Calculate commission (1% for successful payments)
      const commissionAmount = status === "SUCCESS" 
        ? (parseFloat(transaction.paymentAmount) * 0.01).toFixed(2)
        : undefined;

      // Update transaction status
      const [updatedTransaction] = await db
        .update(bbpsTransactions)
        .set({
          paymentStatus: status,
          bbpsTransactionId: bbpsTransactionId || `BBPS${transactionId}`,
          completedAt: new Date(),
          failureReason,
          commissionAmount,
        })
        .where(eq(bbpsTransactions.transactionId, transactionId))
        .returning();

      console.log(`✅ BBPS payment ${status.toLowerCase()}: ${transactionId}`);

      return updatedTransaction;
    } catch (error) {
      console.error("Error confirming BBPS payment:", error);
      throw error;
    }
  }

  // Legacy method for backward compatibility (now redirects to new flow)
  async payBill(params: {
    billId: string;
    paymentAmount: string;
    paymentMode: string;
    userId: string;
  }): Promise<BbpsTransaction> {
    console.warn("⚠️ payBill() is deprecated. Use initiateBillPayment() instead.");
    
    const result = await this.initiateBillPayment({
      billId: params.billId,
      paymentAmount: params.paymentAmount,
      userId: params.userId,
    });

    return result.transaction;
  }

  // Get user's bill history
  async getUserBills(userId: string): Promise<BbpsCustomerBill[]> {
    return await db
      .select()
      .from(bbpsCustomerBills)
      .where(eq(bbpsCustomerBills.userId, userId))
      .orderBy(bbpsCustomerBills.createdAt);
  }

  // Get user's transaction history
  async getUserTransactions(userId: string): Promise<BbpsTransaction[]> {
    return await db
      .select()
      .from(bbpsTransactions)
      .where(eq(bbpsTransactions.userId, userId))
      .orderBy(bbpsTransactions.createdAt);
  }

  // Get transaction status
  async getTransactionStatus(transactionId: string): Promise<BbpsTransaction | null> {
    const [transaction] = await db
      .select()
      .from(bbpsTransactions)
      .where(eq(bbpsTransactions.transactionId, transactionId))
      .limit(1);

    return transaction || null;
  }
}

export default BBPSService.getInstance();