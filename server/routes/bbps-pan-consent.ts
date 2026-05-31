// @ts-nocheck
import { Express } from 'express';
import { storage } from '../storage';
import { and } from 'drizzle-orm';
import { PANConsentService } from '../services/pan-consent-service';
import { DemographicProtectionService } from '../services/demographic-protection-service';
import { BBPSService } from '../services/bbpsService';
import { BbpsExpenseIntegration } from '../bbps-expense-integration';
import { storage } from '../storage';

export function registerBBPSPanConsentRoutes(app: Express): void {
const bbpsExpenseIntegration = new BbpsExpenseIntegration(storage as any);
app.get("/api/bbps/categories", async (req, res) => {
  try {
    const categories = await BBPSService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error("Error fetching BBPS categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Get billers by category
app.get("/api/bbps/categories/:categoryId/billers", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const billers = await BBPSService.getBillersByCategory(categoryId);
    res.json(billers);
  } catch (error) {
    console.error("Error fetching BBPS billers:", error);
    res.status(500).json({ error: "Failed to fetch billers" });
  }
});

// Fetch bill details
app.post("/api/bbps/fetch-bill", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { billerId, customerParam } = req.body;
    
    if (!billerId || !customerParam) {
      return res.status(400).json({ 
        error: "billerId and customerParam are required" 
      });
    }

    const bill = await BBPSService.fetchBill({
      billerId,
      customerParam,
      userId: req.user!.id,
    });

    res.json(bill);
  } catch (error) {
    console.error("Error fetching bill:", error);
    res.status(500).json({ error: "Failed to fetch bill details" });
  }
});

// Process bill payment
app.post("/api/bbps/pay-bill", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { billId, paymentAmount, paymentMode } = req.body;
    
    if (!billId || !paymentAmount || !paymentMode) {
      return res.status(400).json({ 
        error: "billId, paymentAmount, and paymentMode are required" 
      });
    }

    const transaction = await BBPSService.payBill({
      billId,
      paymentAmount,
      paymentMode,
      userId: req.user!.id,
    });

    // Auto-create expense if payment is successful
    if (transaction.paymentStatus === 'SUCCESS') {
      try {
        // Create expense entry for the bill payment
        // Using generic BBPS category code - will be mapped to correct expense category
        await bbpsExpenseIntegration.createExpenseFromBbpsPayment({
          transactionId: transaction.id,
          userId: req.user!.id,
          billerCode: transaction.billerCode || 'BBPS',
          billerName: 'Bill Payment', // Generic name, can be enhanced later
          categoryCode: 'UTILITIES', // Default to utilities, will be mapped correctly
          amount: parseFloat(paymentAmount), // Amount is already in rupees
          transactionDate: transaction.completedAt || new Date(),
          customerParam: transaction.customerParam,
        });
      } catch (expenseError) {
        console.error('Failed to create expense from BBPS payment:', expenseError);
        // Don't fail the payment response if expense creation fails
      }
    }

    res.json(transaction);
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// Get user's bill history
app.get("/api/bbps/bills", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const bills = await BBPSService.getUserBills(req.user!.id);
    res.json(bills);
  } catch (error) {
    console.error("Error fetching user bills:", error);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

// Get user's transaction history
app.get("/api/bbps/transactions", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const transactions = await BBPSService.getUserTransactions(req.user!.id);
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Get transaction status
app.get("/api/bbps/transactions/:transactionId/status", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { transactionId } = req.params;
    const transaction = await BBPSService.getTransactionStatus(transactionId);
    
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Check if transaction belongs to the authenticated user
    if (transaction.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction status:", error);
    res.status(500).json({ error: "Failed to fetch transaction status" });
  }
});
}
