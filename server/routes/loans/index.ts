import { Express, Request, Response } from 'express';
import { requireAuth, requireClientOrHigher } from '../../middleware/auth';
import { iciciBankAPI } from '../../icici-bank-api';
import { LoanOrchestrator } from '../../loan-marketplace/loan-orchestrator';
import { storage } from '../../storage';

const requireLevel1 = requireClientOrHigher;
const loanOrchestrator = new LoanOrchestrator();

export function registerLoanRoutes(app: Express) {
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

  app.post("/api/marketplace/applications", requireLevel1, async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const applicationData = req.body;

      const application = await storage.createLoanApplication({
        userId,
        ...applicationData,
        status: 'submitted'
      });

      res.status(201).json({
        success: true,
        data: application
      });
    } catch (error: any) {
      console.error("Error creating loan application:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create loan application"
      });
    }
  });

  app.get("/api/marketplace/applications", requireLevel1, async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const applications = await storage.getLoanApplications(userId);
      
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

  app.get("/api/marketplace/applications/:applicationId", requireLevel1, async (req: any, res: any) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;

      const application = await storage.getLoanApplication(applicationId);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Application not found"
        });
      }

      res.json({
        success: true,
        data: application
      });
    } catch (error: any) {
      console.error("Error fetching loan application:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan application"
      });
    }
  });

  app.get("/api/marketplace/applications/:applicationId/documents", requireLevel1, async (req: any, res: any) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;

      const application = await storage.getLoanApplication(applicationId);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Application not found"
        });
      }

      const documents = await storage.getLoanApplicationDocuments(applicationId);

      res.json({
        success: true,
        data: documents
      });
    } catch (error: any) {
      console.error("Error fetching application documents:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch application documents"
      });
    }
  });

  app.post("/api/marketplace/applications/:applicationId/documents", requireLevel1, async (req: any, res: any) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;
      const documentData = req.body;

      const application = await storage.getLoanApplication(applicationId);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: "Application not found"
        });
      }

      const document = await storage.addLoanApplicationDocument(applicationId, documentData);

      res.status(201).json({
        success: true,
        data: document
      });
    } catch (error: any) {
      console.error("Error adding application document:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add application document"
      });
    }
  });

  app.get("/api/marketplace/my-requests", requireLevel1, async (req: any, res: any) => {
    try {
      const userId = req.user!.id;
      const requests = await storage.getLoanRequests(userId);
      
      res.json({
        success: true,
        data: requests
      });
    } catch (error: any) {
      console.error("Error fetching user loan requests:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch loan requests"
      });
    }
  });

  console.log('✅ Loan routes (ICICI, Marketplace) registered');
}

export async function registerLoanProcessingRoutes(app: Express) {
  const { loanProcessingService } = await import('../../loan-processing-service');

  app.post("/api/loans/eligibility", async (req, res) => {
    try {
      const { loanType, amount, tenure, monthlyIncome, cibilScore, employmentType, existingLoans, age } = req.body;

      if (!loanType || !amount || !tenure || !monthlyIncome || !employmentType || !age) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields"
        });
      }

      const result = await loanProcessingService.checkLoanEligibility({
        loanType,
        amount: Number(amount),
        tenure: Number(tenure),
        monthlyIncome: Number(monthlyIncome),
        cibilScore: cibilScore ? Number(cibilScore) : undefined,
        employmentType,
        existingLoans: existingLoans ? Number(existingLoans) : undefined,
        age: Number(age)
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error("Error checking loan eligibility:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check loan eligibility"
      });
    }
  });

  app.post("/api/loans/apply", async (req, res) => {
    try {
      const loanApplication = req.body;

      const requiredFields = [
        'loanType', 'amount', 'tenure', 'lenderId', 'applicantDetails'
      ];

      for (const field of requiredFields) {
        if (!loanApplication[field]) {
          return res.status(400).json({
            success: false,
            error: `Missing required field: ${field}`
          });
        }
      }

      const result = await loanProcessingService.applyForLoan(loanApplication);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error("Error applying for loan:", error);
      res.status(500).json({
        success: false,
        error: "Failed to apply for loan"
      });
    }
  });

  app.post("/api/icici/loans/personal/eligibility", async (req, res) => {
    try {
      const { amount, monthlyIncome, employmentType, cibilScore, age } = req.body;

      const request = {
        loanType: 'personal',
        amount: Number(amount),
        tenure: 36,
        monthlyIncome: Number(monthlyIncome),
        cibilScore: cibilScore ? Number(cibilScore) : 750,
        employmentType,
        age: Number(age)
      };

      const result = await loanProcessingService.checkLoanEligibility(request);
      const icicioffer = result.offers.find((offer: any) => offer.lenderId === 'icici');

      if (!icicioffer) {
        return res.status(400).json({
          success: false,
          error: "Not eligible for ICICI Bank loan"
        });
      }

      res.json({
        success: true,
        data: icicioffer
      });

    } catch (error) {
      console.error("Error checking ICICI loan eligibility:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check ICICI loan eligibility"
      });
    }
  });

  app.post("/api/hdfc/loans/personal/eligibility", async (req, res) => {
    try {
      const { amount, monthlyIncome, employmentType, cibilScore, age } = req.body;

      const request = {
        loanType: 'personal',
        amount: Number(amount),
        tenure: 48,
        monthlyIncome: Number(monthlyIncome),
        cibilScore: cibilScore ? Number(cibilScore) : 750,
        employmentType,
        age: Number(age)
      };

      const result = await loanProcessingService.checkLoanEligibility(request);
      const hdfcOffer = result.offers.find((offer: any) => offer.lenderId === 'hdfc');

      if (!hdfcOffer) {
        return res.status(400).json({
          success: false,
          error: "Not eligible for HDFC Bank loan"
        });
      }

      res.json({
        success: true,
        data: hdfcOffer
      });

    } catch (error) {
      console.error("Error checking HDFC loan eligibility:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check HDFC loan eligibility"
      });
    }
  });

  console.log('✅ Loan Processing routes registered');
}
