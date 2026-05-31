// @ts-nocheck
import { Express, Request, Response } from 'express';
import { requireAuth, requireClientOrHigher } from '../../middleware/auth';
import { iciciBankAPI } from '../../icici-bank-api';
import { LoanOrchestrator } from '../../loan-marketplace/loan-orchestrator';
import { storage } from '../../storage';
import { registerLoanAdminRoutes } from './admin';

const requireLevel1 = requireClientOrHigher;
const loanOrchestrator = new LoanOrchestrator();

// Re-export admin routes for separate registration if needed
export { registerLoanAdminRoutes } from './admin';

export function registerLoanPart1Routes(app: Express) {
  app.post("/api/icici/loans/apply", requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const loanApplication = req.body;

      if (!loanApplication.loanType || !loanApplication.applicantDetails || !loanApplication.loanDetails) {
        return res.status(400).json({
          success: false,
          error: "Missing required loan application fields"
        });
      }

      const result = await iciciBankAPI.submitLoanApplication(loanApplication);
      
      if (result.success && result.data) {
        const dbApplication = await storage.createICICILoanApplication({
          userId,
          applicationId: result.data.applicationId,
          loanType: loanApplication.loanType,
          requestedAmount: loanApplication.loanDetails.loanAmount.toString(),
          applicantDetails: loanApplication.applicantDetails,
          addressDetails: loanApplication.addressDetails,
          employmentDetails: loanApplication.employmentDetails,
          bankingDetails: loanApplication.bankingDetails,
          loanDetails: loanApplication.loanDetails,
          documents: loanApplication.documents || [],
          cibilConsent: loanApplication.cibilConsent,
          termsAccepted: loanApplication.termsAccepted,
          status: result.data.status,
          sanctionedAmount: result.data.sanctionedAmount?.toString(),
          interestRate: result.data.interestRate?.toString(),
          tenure: result.data.tenure,
          emi: result.data.emi?.toString(),
          processingFee: result.data.processingFee?.toString(),
          statusHistory: [{
            status: result.data.status,
            timestamp: new Date().toISOString(),
            remarks: result.data.message
          }],
          nextSteps: result.data.nextSteps || [],
          documentsRequired: result.data.documentsRequired || [],
          expectedDecisionDate: result.data.expectedDecisionDate ? new Date(result.data.expectedDecisionDate) : undefined
        });

        res.status(201).json({
          success: true,
          data: {
            id: dbApplication.id,
            ...result.data
          }
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error("Error submitting loan application:", error);
      res.status(500).json({
        success: false,
        error: "Failed to submit loan application"
      });
    }
  });

  app.get("/api/icici/loans/status/:applicationId", requireAuth, async (req: any, res: any) => {
    try {
      const { applicationId } = req.params;

      const result = await iciciBankAPI.getLoanStatus(applicationId);
      
      if (result.success && result.data) {
        await storage.updateICICILoanApplicationStatus(applicationId, {
          status: result.data.currentStatus,
          statusHistory: result.data.statusHistory,
          loanDetails: result.data.loanDetails,
          disbursementDetails: result.data.disbursementDetails,
          nextAction: result.data.nextAction
        });

        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error("Error fetching loan status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan status"
      });
    }
  });

  app.post("/api/icici/loans/eligibility", requireAuth, async (req: any, res: any) => {
    try {
      const { loanType, monthlyIncome, existingEmi, loanAmount, tenure } = req.body;

      if (!loanType || !monthlyIncome || !loanAmount || !tenure) {
        return res.status(400).json({
          success: false,
          error: "Missing required eligibility check fields"
        });
      }

      const result = await iciciBankAPI.checkLoanEligibility({
        loanType,
        monthlyIncome: Number(monthlyIncome),
        existingEmi: Number(existingEmi || 0),
        requestedAmount: Number(loanAmount),
        tenure: Number(tenure)
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error checking loan eligibility:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check loan eligibility"
      });
    }
  });

  app.post("/api/icici/credit-score", requireAuth, async (req: any, res: any) => {
    try {
      const { pan, dateOfBirth, consent } = req.body;

      if (!pan || !dateOfBirth || !consent) {
        return res.status(400).json({
          success: false,
          error: "PAN, date of birth, and consent are required"
        });
      }

      const result = await iciciBankAPI.getCreditScore({
        pan,
        dateOfBirth,
        consent
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching credit score:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch credit score"
      });
    }
  });

  app.get("/api/icici/loans/my-applications", requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const applications = await storage.getICICILoanApplicationsByUser(userId);
      
      res.json({
        success: true,
        data: applications
      });
    } catch (error: any) {
      console.error("Error fetching loan applications:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan applications"
      });
    }
  });

  app.get("/api/marketplace/credit-profile", requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const profile = await storage.getCreditProfile(userId);
      
      res.json({
        success: true,
        data: profile
      });
    } catch (error: any) {
      console.error("Error fetching credit profile:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch credit profile"
      });
    }
  });

  app.post("/api/marketplace/credit-profile", requireAuth, async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const profileData = req.body;

      const profile = await storage.upsertCreditProfile({
        userId,
        ...profileData
      });

      res.json({
        success: true,
        data: profile
      });
    } catch (error: any) {
      console.error("Error updating credit profile:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update credit profile"
      });
    }
  });

  app.get("/api/marketplace/loan-products", requireLevel1, async (req: any, res: any) => {
    try {
      const products = loanOrchestrator.getLoanProducts();
      res.json({
        success: true,
        data: products
      });
    } catch (error: any) {
      console.error("Error fetching loan products:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan products"
      });
    }
  });

  app.get("/api/marketplace/loan-products/:productKey", requireLevel1, async (req: any, res: any) => {
    try {
      const { productKey } = req.params;
      const product = loanOrchestrator.getLoanProduct(productKey);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Loan product not found"
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error: any) {
      console.error("Error fetching loan product:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan product"
      });
    }
  });

  app.get("/api/marketplace/loan-providers", requireLevel1, async (req: any, res: any) => {
    try {
      const providers = loanOrchestrator.getLoanProviders();
      res.json({
        success: true,
        data: providers
      });
    } catch (error: any) {
      console.error("Error fetching loan providers:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan providers"
      });
    }
  });

  app.get("/api/marketplace/loan-providers/:providerKey/products", requireLevel1, async (req: any, res: any) => {
    try {
      const { providerKey } = req.params;
      const products = loanOrchestrator.getProviderProducts(providerKey);
      
      if (!products) {
        return res.status(404).json({
          success: false,
          error: "Provider not found"
        });
      }

      res.json({
        success: true,
        data: products
      });
    } catch (error: any) {
      console.error("Error fetching provider products:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch provider products"
      });
    }
  });

  // EMI Calculator (public endpoint)
  app.post("/api/marketplace/emi-calculator", async (req: any, res: any) => {
    try {
      const { principal, annualRate, tenureMonths } = req.body;
      
      if (!principal || !annualRate || !tenureMonths) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: principal, annualRate, tenureMonths"
        });
      }

      const calculation = loanOrchestrator.calculateEMI(
        parseFloat(principal),
        parseFloat(annualRate),
        parseInt(tenureMonths)
      );

      res.json({
        success: true,
        data: calculation
      });
    } catch (error: any) {
      console.error("Error calculating EMI:", error);
      res.status(500).json({
        success: false,
        error: "Failed to calculate EMI"
      });
    }
  });

  // Pre-qualification check (requires auth)
  app.post("/api/marketplace/prequalify", requireLevel1, async (req: any, res: any) => {
    try {
      const { productKey, requestedAmount, monthlyIncome, creditScore, existingEMIs } = req.body;
      
      if (!productKey || !requestedAmount || !monthlyIncome) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: productKey, requestedAmount, monthlyIncome"
        });
      }

      const result = await loanOrchestrator.softPrequalify(
        productKey,
        parseFloat(requestedAmount),
        parseFloat(monthlyIncome),
        creditScore ? parseInt(creditScore) : undefined,
        existingEMIs ? parseFloat(existingEMIs) : undefined
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error("Error in pre-qualification:", error);
      res.status(500).json({
        success: false,
        error: "Failed to run pre-qualification check"
      });
    }
  });

  app.post("/api/marketplace/loan-requests", requireLevel1, async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const requestData = req.body;

      const loanRequest = await storage.createLoanRequest({
        userId,
        ...requestData,
        status: 'pending'
      });

      res.status(201).json({
        success: true,
        data: loanRequest
      });
    } catch (error: any) {
      console.error("Error creating loan request:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create loan request"
      });
    }
  });

  app.post("/api/marketplace/loan-requests/:requestId/generate-offers", requireLevel1, async (req: any, res: any) => {
    try {
      const { requestId } = req.params;
      const userId = req.user!.id;

      const loanRequest = await storage.getLoanRequest(requestId);
      if (!loanRequest || loanRequest.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Loan request not found"
        });
      }

      const offers = await loanOrchestrator.generateOffers(loanRequest);
      await storage.saveLoanOffers(requestId, offers);

      res.json({
        success: true,
        data: offers
      });
    } catch (error: any) {
      console.error("Error generating loan offers:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate loan offers"
      });
    }
  });

  app.get("/api/marketplace/loan-requests/:requestId/offers", requireLevel1, async (req: any, res: any) => {
    try {
      const { requestId } = req.params;
      const userId = req.user!.id;

      const loanRequest = await storage.getLoanRequest(requestId);
      if (!loanRequest || loanRequest.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Loan request not found"
        });
      }

      const offers = await storage.getLoanOffers(requestId);

      res.json({
        success: true,
        data: offers
      });
    } catch (error: any) {
      console.error("Error fetching loan offers:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan offers"
      });
    }
  });

}
