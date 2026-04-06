import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { requireAdmin, requireAgent } from '../middleware/roleMiddleware';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or, gte, lte, inArray, lt, count } from 'drizzle-orm';
import { agentAppointments, prospectClients, portfolios } from '@shared/schema';

export function registerAgentCapitalGainPart3Routes(app: Express): void {
  app.post("/api/suppliers", requireAdmin, async (req, res) => {
    try {
      const { name, contactEmail, contactPhone, address, description, rating, isActive } = req.body;

      if (!name || !contactEmail) {
        return res.status(400).json({ error: "Name and contact email are required" });
      }

      const supplier = await storage.createSupplier({
        name,
        contactEmail,
        contactPhone,
        address,
        description,
        rating: rating || 5.0,
        isActive: isActive !== false
      });

      res.json({ supplier });
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  app.put("/api/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const supplier = await storage.updateSupplier(id, updates);
      if (!supplier) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      res.json({ supplier });
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ error: "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSupplier(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: "Failed to delete supplier" });
    }
  });

  // Supplier Products API endpoints
  app.get("/api/supplier-products", requireAdmin, async (req, res) => {
    try {
      const { supplierId } = req.query;
      const products = await storage.getSupplierProducts(supplierId as string);
      res.json({ products });
    } catch (error) {
      console.error("Error fetching supplier products:", error);
      res.status(500).json({ error: "Failed to fetch supplier products" });
    }
  });

  app.post("/api/supplier-products", requireAdmin, async (req, res) => {
    try {
      const { supplierId, productName, description, price, profitMargin, category, isActive } = req.body;

      if (!supplierId || !productName || !price || !profitMargin) {
        return res.status(400).json({ error: "Supplier ID, product name, price, and profit margin are required" });
      }

      const product = await storage.createSupplierProduct({
        supplierId,
        productName,
        description,
        price,
        profitMargin,
        category,
        isActive: isActive !== false
      });

      res.json({ product });
    } catch (error) {
      console.error("Error creating supplier product:", error);
      res.status(500).json({ error: "Failed to create supplier product" });
    }
  });

  app.put("/api/supplier-products/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const product = await storage.updateSupplierProduct(id, updates);
      if (!product) {
        return res.status(404).json({ error: "Supplier product not found" });
      }

      res.json({ product });
    } catch (error) {
      console.error("Error updating supplier product:", error);
      res.status(500).json({ error: "Failed to update supplier product" });
    }
  });

  app.delete("/api/supplier-products/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSupplierProduct(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Supplier product not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting supplier product:", error);
      res.status(500).json({ error: "Failed to delete supplier product" });
    }
  });

  // Profit Optimization endpoints
  app.get("/api/products/:productId/optimal-supplier", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.params;
      const optimalSupplier = await storage.getOptimalSupplier(productId);
      
      if (!optimalSupplier) {
        return res.status(404).json({ error: "No suppliers found for this product" });
      }

      res.json({ optimalSupplier });
    } catch (error) {
      console.error("Error finding optimal supplier:", error);
      res.status(500).json({ error: "Failed to find optimal supplier" });
    }
  });

  app.get("/api/products/:productId/profit-analysis", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.params;
      const analysis = await storage.getProfitAnalysis(productId);
      res.json({ analysis });
    } catch (error) {
      console.error("Error generating profit analysis:", error);
      res.status(500).json({ error: "Failed to generate profit analysis" });
    }
  });

  app.get("/api/products/:productId/supplier-comparison", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.params;
      const comparison = await storage.getSupplierComparison(productId);
      res.json({ suppliers: comparison });
    } catch (error) {
      console.error("Error generating supplier comparison:", error);
      res.status(500).json({ error: "Failed to generate supplier comparison" });
    }
  });

  // Product Performance Metrics API endpoints
  app.get("/api/product-performance", requireAdmin, async (req, res) => {
    try {
      const { productId } = req.query;
      const metrics = await storage.getProductPerformanceMetrics(productId as string);
      res.json({ metrics });
    } catch (error) {
      console.error("Error fetching product performance metrics:", error);
      res.status(500).json({ error: "Failed to fetch product performance metrics" });
    }
  });

  app.post("/api/product-performance", requireAdmin, async (req, res) => {
    try {
      const { productId, salesVolume, revenue, customerSatisfaction, returnRate, profitMargin, trendDirection } = req.body;

      if (!productId || !salesVolume || !revenue) {
        return res.status(400).json({ error: "Product ID, sales volume, and revenue are required" });
      }

      const metric = await storage.createProductPerformanceMetric({
        productId,
        salesVolume,
        revenue,
        customerSatisfaction,
        returnRate,
        profitMargin,
        trendDirection,
        recordedAt: new Date()
      });

      res.json({ metric });
    } catch (error) {
      console.error("Error creating product performance metric:", error);
      res.status(500).json({ error: "Failed to create product performance metric" });
    }
  });




  // Admin endpoint to get all client assignments
  app.get("/api/admin/client-assignments", requireAdmin, async (req, res) => {
    try {
      const assignments = await storage.getClientAssignments();
      
      res.json({
        status: "success",
        data: assignments
      });
    } catch (error) {
      console.error("Error fetching client assignments:", error);
      res.status(500).json({ 
        status: "error", 
        error: "Failed to fetch client assignments" 
      });
    }
  });

  // Admin endpoint to update client assignment
  app.put("/api/admin/client-assignments/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const assignment = await storage.updateClientAssignment(id, updates);
      
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Log the update activity
      await adminService.logActivity({
        userId: req.user!.id,
        action: 'update_client_assignment',
        resource: `assignment:${id}`,
        details: updates
      });

      res.json({
        status: "success",
        data: assignment
      });
    } catch (error) {
      console.error("Error updating client assignment:", error);
      res.status(500).json({ 
        status: "error", 
        error: "Failed to update client assignment" 
      });
    }
  });

  // Agent endpoint to get assigned clients
  app.get("/api/agents/assigned-clients", async (req, res) => {
    try {
      const agentId = req.user?.id;
      
      if (!agentId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const assignments = await storage.getClientAssignmentsByAgent(agentId);
      
      res.json({
        status: "success",
        data: assignments
      });
    } catch (error) {
      console.error("Error fetching assigned clients:", error);
      res.status(500).json({ 
        status: "error", 
        error: "Failed to fetch assigned clients" 
      });
    }
  });

  // Loan Against Securities API endpoints
  
  // Check loan eligibility
  app.post("/api/loans/eligibility", async (req, res) => {
    try {
      const { portfolioId, requestedAmount } = req.body;
      
      if (!portfolioId || !requestedAmount) {
        return res.status(400).json({
          success: false,
          error: "Portfolio ID and requested amount are required"
        });
      }

      // Get portfolio holdings
      const holdings = await storage.getPortfolioHoldings(portfolioId);
      const totalValue = holdings.reduce((sum, holding) => sum + (parseFloat(holding.quantity) * parseFloat(holding.avgPrice)), 0);
      
      // Calculate eligibility (typically 50-80% LTV for securities)
      const maxLoanAmount = totalValue * 0.75; // 75% LTV
      const isEligible = parseFloat(requestedAmount) <= maxLoanAmount;
      
      const eligibilityData = {
        isEligible,
        maxLoanAmount,
        portfolioValue: totalValue,
        loanToValue: (parseFloat(requestedAmount) / totalValue * 100).toFixed(2),
        interestRate: "10.25", // Starting rate like 50Fin
        processingFee: parseFloat(requestedAmount) * 0.01, // 1% processing fee
        eligibleAssets: holdings.filter(h => ['equity', 'mf'].includes(h.assetType))
      };

      res.json({
        success: true,
        data: eligibilityData
      });
    } catch (error) {
      console.error("Error checking loan eligibility:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check loan eligibility"
      });
    }
  });

  // Submit loan application
  app.post("/api/loans/apply", async (req, res) => {
    try {
      const loanData = req.body;
      
      // Generate application number
      const applicationNumber = `LAS${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      const application = await storage.createLoanApplication({
        ...loanData,
        applicationNumber,
        status: "pending"
      });

      res.json({
        success: true,
        data: application
      });
    } catch (error) {
      console.error("Error creating loan application:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create loan application"
      });
    }
  });

  // Get user's loan applications
  app.get("/api/loans/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const loans = await storage.getUserLoans(userId);
      
      res.json({
        success: true,
        data: loans
      });
    } catch (error) {
      console.error("Error fetching user loans:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan applications"
      });
    }
  });

  // Get loan details
  app.get("/api/loans/:loanId", async (req, res) => {
    try {
      const { loanId } = req.params;
      const loan = await storage.getLoanApplication(loanId);
      
      if (!loan) {
        return res.status(404).json({
          success: false,
          error: "Loan application not found"
        });
      }
      
      res.json({
        success: true,
        data: loan
      });
    } catch (error) {
      console.error("Error fetching loan details:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan details"
      });
    }
  });

  // Update loan status (admin only)
  app.patch("/api/loans/:loanId/status", async (req, res) => {
    try {
      const { loanId } = req.params;
      const { status, approvedAmount, rejectionReason } = req.body;
      
      const updatedLoan = await storage.updateLoanStatus(loanId, {
        status,
        approvedAmount,
        rejectionReason,
        approvalDate: status === 'approved' ? new Date() : undefined,
        disbursalDate: status === 'disbursed' ? new Date() : undefined
      });
      
      res.json({
        success: true,
        data: updatedLoan
      });
    } catch (error) {
      console.error("Error updating loan status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update loan status"
      });
    }
  });

  // Get collateral valuation
  app.get("/api/loans/:loanId/valuation", async (req, res) => {
    try {
      const { loanId } = req.params;
      const valuation = await storage.getCollateralValuation(loanId);
      
      res.json({
        success: true,
        data: valuation
      });
    } catch (error) {
      console.error("Error fetching collateral valuation:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch collateral valuation"
      });
    }
  });

  // API Key Management endpoints (admin only)
  app.get("/api/admin/api-keys", requireAdmin, async (req, res) => {
    try {
      // Return available API keys without exposing actual values
      const apiKeys = {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
 
        ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY ? 'configured' : 'not_configured',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
        ICICI_BANK_API_KEY: process.env.ICICI_BANK_API_KEY ? 'configured' : 'not_configured',
        HDFC_BANK_API_KEY: process.env.HDFC_BANK_API_KEY ? 'configured' : 'not_configured',
        JM_FINANCIAL_API_KEY: process.env.JM_FINANCIAL_API_KEY ? 'configured' : 'not_configured',
      };

      res.json({ success: true, data: apiKeys });
    } catch (error) {
      console.error("Error fetching API keys status:", error);
      res.status(500).json({ success: false, error: "Failed to fetch API keys status" });
    }
  });

  app.post("/api/admin/api-keys", requireAdmin, async (req, res) => {
    try {
      const { keyName, keyValue } = req.body;
      
      if (!keyName || !keyValue) {
        return res.status(400).json({ 
          success: false, 
          error: "API key name and value are required" 
        });
      }

      // Validate that the key name is allowed
      const allowedKeys = [
        'GEMINI_API_KEY', 'ALPHA_VANTAGE_API_KEY', 
        'OPENAI_API_KEY', 'ICICI_BANK_API_KEY', 'HDFC_BANK_API_KEY',
        'JM_FINANCIAL_API_KEY'
      ];

      if (!allowedKeys.includes(keyName)) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid API key name" 
        });
      }

      // Update environment variable (note: this only persists for current session)
      process.env[keyName] = keyValue;

      // Log the configuration change for audit
      await adminService.logActivity({
        userId: req.user!.id,
        action: 'api_key_updated',
        resource: `API Key: ${keyName}`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        details: { keyName, timestamp: new Date().toISOString() }
      });

      res.json({ 
        success: true, 
        message: `${keyName} has been updated successfully`,
        data: { keyName, status: 'configured' }
      });
    } catch (error) {
      console.error("Error updating API key:", error);
      res.status(500).json({ success: false, error: "Failed to update API key" });
    }
  });

  // ========================
}
