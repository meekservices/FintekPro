import { Express, Request, Response } from 'express';
import { iciciBankAPI } from '../icici-bank-api';
import { hdfcBankAPI } from '../hdfc-bank-api';

export function registerBankingRoutes(app: Express) {
  app.get("/api/icici/health", async (req, res) => {
    try {
      const result = await iciciBankAPI.healthCheck();
      res.json(result);
    } catch (error) {
      console.error("Error checking ICICI Bank API health:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check ICICI Bank API health"
      });
    }
  });

  app.post("/api/icici/accounts/balance", async (req, res) => {
    try {
      const { accountNumber } = req.body;
      
      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          error: "Account number is required"
        });
      }

      const result = await iciciBankAPI.getAccountBalance(accountNumber);
      res.json(result);
    } catch (error) {
      console.error("Error fetching account balance:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch account balance"
      });
    }
  });

  app.post("/api/icici/accounts/transactions", async (req, res) => {
    try {
      const { accountNumber, fromDate, toDate, limit } = req.body;
      
      if (!accountNumber || !fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: "Account number, from date, and to date are required"
        });
      }

      const result = await iciciBankAPI.getTransactionHistory(
        accountNumber, 
        fromDate, 
        toDate, 
        limit || 100
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch transaction history"
      });
    }
  });

  app.post("/api/icici/payments/imps", async (req, res) => {
    try {
      const paymentRequest = req.body;
      
      const requiredFields = [
        'accountNumber', 
        'beneficiaryAccountNumber', 
        'beneficiaryIFSC', 
        'amount', 
        'purpose', 
        'beneficiaryName'
      ];
      
      for (const field of requiredFields) {
        if (!paymentRequest[field]) {
          return res.status(400).json({
            success: false,
            error: `${field} is required`
          });
        }
      }

      const result = await iciciBankAPI.makeIMPSPayment(paymentRequest);
      res.json(result);
    } catch (error) {
      console.error("Error making IMPS payment:", error);
      res.status(500).json({
        success: false,
        error: "Failed to make IMPS payment"
      });
    }
  });

  app.post("/api/icici/payments/status", async (req, res) => {
    try {
      const { transactionId } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: "Transaction ID is required"
        });
      }

      const result = await iciciBankAPI.getPaymentStatus(transactionId);
      res.json(result);
    } catch (error) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch payment status"
      });
    }
  });

  app.post("/api/icici/accounts/validate", async (req, res) => {
    try {
      const { accountNumber, ifscCode } = req.body;
      
      if (!accountNumber || !ifscCode) {
        return res.status(400).json({
          success: false,
          error: "Account number and IFSC code are required"
        });
      }

      const result = await iciciBankAPI.validateAccount(accountNumber, ifscCode);
      res.json(result);
    } catch (error) {
      console.error("Error validating account:", error);
      res.status(500).json({
        success: false,
        error: "Failed to validate account"
      });
    }
  });

  app.post("/api/icici/accounts/statement", async (req, res) => {
    try {
      const { accountNumber, fromDate, toDate, format } = req.body;
      
      if (!accountNumber || !fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: "Account number, from date, and to date are required"
        });
      }

      const result = await iciciBankAPI.getAccountStatement(
        accountNumber, 
        fromDate, 
        toDate, 
        (format?.toLowerCase() as 'pdf' | 'excel') || 'pdf'
      );
      res.json(result);
    } catch (error) {
      console.error("Error generating account statement:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate account statement"
      });
    }
  });

  app.get("/api/hdfc/health", async (req, res) => {
    try {
      const result = await hdfcBankAPI.healthCheck();
      res.json(result);
    } catch (error) {
      console.error("Error checking HDFC Bank API health:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check HDFC Bank API health"
      });
    }
  });

  app.post("/api/hdfc/accounts/balance", async (req, res) => {
    try {
      const { accountNumber } = req.body;
      
      if (!accountNumber) {
        return res.status(400).json({
          success: false,
          error: "Account number is required"
        });
      }

      const result = await hdfcBankAPI.getAccountBalance(accountNumber);
      res.json(result);
    } catch (error) {
      console.error("Error fetching HDFC account balance:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch account balance"
      });
    }
  });

  app.post("/api/hdfc/accounts/transactions", async (req, res) => {
    try {
      const { accountNumber, fromDate, toDate, limit } = req.body;
      
      if (!accountNumber || !fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: "Account number, from date, and to date are required"
        });
      }

      const result = await hdfcBankAPI.getTransactionHistory(
        accountNumber, 
        fromDate, 
        toDate, 
        limit || 100
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching HDFC transaction history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch transaction history"
      });
    }
  });

  app.post("/api/hdfc/payments/transfer", async (req, res) => {
    try {
      const paymentRequest = req.body;
      
      const requiredFields = [
        'sourceAccount', 
        'destinationAccount', 
        'ifscCode', 
        'amount', 
        'beneficiaryName', 
        'purpose',
        'paymentMode'
      ];
      
      for (const field of requiredFields) {
        if (!paymentRequest[field]) {
          return res.status(400).json({
            success: false,
            error: `${field} is required`
          });
        }
      }

      const result = await hdfcBankAPI.initiatePayment({
        debitAccountNumber: paymentRequest.sourceAccount,
        creditAccountNumber: paymentRequest.destinationAccount,
        creditIFSC: paymentRequest.ifscCode,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency || 'INR',
        purpose: paymentRequest.purpose,
        remarks: paymentRequest.remarks,
        beneficiaryName: paymentRequest.beneficiaryName,
        paymentMode: paymentRequest.paymentMode || 'IMPS'
      });
      res.json(result);
    } catch (error) {
      console.error("Error initiating HDFC transfer:", error);
      res.status(500).json({
        success: false,
        error: "Failed to initiate transfer"
      });
    }
  });

  app.post("/api/hdfc/payments/status", async (req, res) => {
    try {
      const { referenceNumber } = req.body;
      
      if (!referenceNumber) {
        return res.status(400).json({
          success: false,
          error: "Reference number is required"
        });
      }

      const result = await hdfcBankAPI.getPaymentStatus(referenceNumber);
      res.json(result);
    } catch (error) {
      console.error("Error fetching HDFC payment status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch payment status"
      });
    }
  });

  app.post("/api/hdfc/accounts/validate", async (req, res) => {
    try {
      const { accountNumber, ifscCode } = req.body;
      
      if (!accountNumber || !ifscCode) {
        return res.status(400).json({
          success: false,
          error: "Account number and IFSC code are required"
        });
      }

      const result = await hdfcBankAPI.validateAccount(accountNumber, ifscCode);
      res.json(result);
    } catch (error) {
      console.error("Error validating HDFC account:", error);
      res.status(500).json({
        success: false,
        error: "Failed to validate account"
      });
    }
  });

  app.post("/api/hdfc/accounts/statement", async (req, res) => {
    try {
      const { accountNumber, fromDate, toDate, format, emailId } = req.body;
      
      if (!accountNumber || !fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: "Account number, from date, and to date are required"
        });
      }

      const result = await hdfcBankAPI.generateStatement({
        accountNumber, 
        fromDate, 
        toDate, 
        format: format || 'PDF',
        emailId
      });
      res.json(result);
    } catch (error) {
      console.error("Error generating HDFC account statement:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate account statement"
      });
    }
  });

  console.log('✅ Banking Integration (ICICI/HDFC) routes registered');
}
