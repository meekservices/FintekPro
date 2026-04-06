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

export function registerLoanPart2Routes(app: Express) {
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

  app.get("/api/loans/kfs/:offerId", async (req: any, res: any) => {
    try {
      const { offerId } = req.params;
      const { amount: qAmount, tenure: qTenure, rate: qRate, provider: qProvider, fee: qFee } = req.query;
      
      let offer = await storage.getLoanOffer(offerId);
      
      const amount = Number(offer?.amount || qAmount || 500000);
      const tenure = Number(offer?.tenure || qTenure || 60);
      const baseRate = Number(offer?.interestRate || qRate || 10);
      const processingFeePercent = Number(offer?.processingFee || qFee || 1);
      const providerName = offer?.providerName || qProvider || 'Partner Lender';
      
      const monthlyRate = baseRate / 12 / 100;
      const emi = amount * monthlyRate * Math.pow(1 + monthlyRate, tenure) / 
                  (Math.pow(1 + monthlyRate, tenure) - 1);
      const totalPayment = emi * tenure;
      const totalInterest = totalPayment - amount;
      const apr = baseRate + (processingFeePercent * 12 / tenure);

      const kfsData = {
        kfsId: `KFS-MKT-${offerId}`,
        generatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        
        lenderDetails: {
          name: providerName,
          licenseNumber: 'RBI-NBFC-XXXX',
          regulator: 'Reserve Bank of India',
          registeredAddress: 'Mumbai, Maharashtra',
          grievanceOfficer: 'grievance@lender.com',
        },

        loanTerms: {
          principalAmount: amount,
          tenure: tenure,
          tenureUnit: 'months',
          interestRate: baseRate,
          interestType: 'Fixed/Floating (as applicable)',
          apr: parseFloat(apr.toFixed(2)),
          emi: Math.round(emi),
          totalInterest: Math.round(totalInterest),
          totalRepayment: Math.round(totalPayment),
        },

        fees: {
          processingFee: `${processingFeePercent}% of loan amount`,
          processingFeeAmount: Math.round(amount * processingFeePercent / 100),
          stampDuty: 'As per state regulations',
          documentationCharges: '₹500',
          insuranceCharges: 'Optional - ₹0 if declined',
          prepaymentCharges: 'Nil for floating rate, 2% for fixed rate',
          latePaymentFee: '2% per month on overdue amount',
          bounceCharges: '₹500 per instance',
        },

        cooling_off: {
          period: '3 days',
          description: 'Borrower can exit the loan within 3 days of disbursement by repaying principal plus pro-rata interest. No prepayment charges apply during this period.',
        },

        grievanceRedressal: {
          lenderOfficer: {
            name: 'Grievance Officer',
            email: 'grievance@lender.com',
            phone: '1800-XXX-XXXX',
          },
          escalation: {
            ombudsman: 'RBI Ombudsman',
            website: 'https://cms.rbi.org.in',
            email: 'rbiombudsman@rbi.org.in',
          },
        },

        rbiDisclosure: {
          statement: 'This Key Facts Statement (KFS) is provided as per RBI Digital Lending Directions 2025.',
          annualPercentageRate: `The Annual Percentage Rate (APR) of ${apr.toFixed(2)}% includes all costs - interest rate, processing fee, and other charges.`,
          coolingOff: 'You have a 3-day cooling-off period after disbursement to exit the loan.',
        },
      };

      res.json({
        success: true,
        data: kfsData
      });
    } catch (error: any) {
      console.error("Error generating KFS:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate KFS document"
      });
    }
  });

  app.post("/api/loans/background-routing", requireLevel1, async (req: any, res: any) => {
    try {
      const { requestId, reason } = req.body;
      
      if (!requestId || !reason) {
        return res.status(400).json({
          success: false,
          error: "Missing requestId or reason"
        });
      }

      const { dsaLoanService } = await import('../../services/dsa-loan-service');
      
      const result = await dsaLoanService.triggerBackgroundRouting(
        requestId, 
        reason as 'borderline_credit' | 'income_edge' | 'manual_review',
        req.user?.id
      );

      res.json({
        success: true,
        data: result,
        message: 'Background multi-bank routing initiated for better offer discovery'
      });
    } catch (error: any) {
      console.error("Error triggering background routing:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to trigger background routing"
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

export function registerLoanComparisonRoutes(app: Express) {
  // ============ LOAN COMPARISON API ROUTES ============
  
  // Generate fresh loan offers for comparison
  app.post("/api/loan-comparison/generate", async (req, res) => {
    try {
      // Import schemas for validation
      const { loanComparisonParamsSchema } = await import("@shared/schema");
      
      // Validate request body
      const validationResult = loanComparisonParamsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request parameters",
          details: validationResult.error.issues
        });
      }
      
      const { amount, tenure, loanType, monthlyIncome, creditScore } = validationResult.data;
      
      if (!amount || !tenure || !loanType || !monthlyIncome) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      res.json({ 
        success: true, 
        offers: [],
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating loan offers:", error);
      res.status(500).json({ error: "Failed to generate loan offers" });
    }
  });

  // Get loan offers for comparison parameters
  app.get("/api/loan-comparison/offers", async (req, res) => {
    try {
      // Convert query params to proper types
      const params = {
        amount: parseInt(req.query.amount as string),
        tenure: parseInt(req.query.tenure as string),
        loanType: req.query.loanType as string,
        monthlyIncome: parseInt(req.query.monthlyIncome as string),
        creditScore: req.query.creditScore ? parseInt(req.query.creditScore as string) : undefined
      };
      
      // Validate parameters
      const { loanComparisonParamsSchema } = await import("@shared/schema");
      const validationResult = loanComparisonParamsSchema.safeParse(params);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid query parameters",
          details: validationResult.error.issues
        });
      }
      
      // Generate offers using the same logic as POST endpoint
      const response = await fetch(`${req.protocol}://${req.get('host')}/api/loan-comparison/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validationResult.data)
      });
      
      const data = await response.json();
      res.json(data.offers || []);
    } catch (error) {
      console.error("Error fetching loan offers:", error);
      res.status(500).json({ error: "Failed to fetch loan offers" });
    }
  });

  // Save loan comparison session
  app.post("/api/loan-comparison/save", async (req, res) => {
    try {
      // Import schemas for validation
      const { insertLoanComparisonSchema } = await import("@shared/schema");
      
      // Validate request body
      const validationResult = insertLoanComparisonSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid comparison data",
          details: validationResult.error.issues
        });
      }
      
      const validatedData = validationResult.data;
      
      if (!validatedData.selectedOffers || (Array.isArray(validatedData.selectedOffers) && validatedData.selectedOffers.length < 2)) {
        return res.status(400).json({ error: "At least 2 offers must be selected for comparison" });
      }
      
      // Mock save - in production, save to database
      const comparisonId = `comparison-${Date.now()}`;
      const savedComparison = {
        id: comparisonId,
        userId: req.user?.id || 'central-test-user',
        ...validatedData,
        createdAt: new Date().toISOString()
      };
      
      res.json({ 
        success: true, 
        comparison: savedComparison,
        message: "Comparison saved successfully"
      });
    } catch (error) {
      console.error("Error saving comparison:", error);
      res.status(500).json({ error: "Failed to save comparison" });
    }
  });

  // Get saved comparisons for user
  app.get("/api/loan-comparison/saved", async (req, res) => {
    try {
      // Mock saved comparisons - in production, fetch from database
      const savedComparisons = [
        {
          id: "comparison-1",
          comparisonName: "Home Loan Comparison - Dec 2024",
          comparisonAmount: 2500000,
          comparisonTenure: 240, // 20 years
          loanType: "home",
          selectedOffers: ["offer-hdfc-1", "offer-icici-1", "offer-axis-1"],
          createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        },
        {
          id: "comparison-2",
          comparisonName: "Personal Loan Comparison - Dec 2024",
          comparisonAmount: 500000,
          comparisonTenure: 60, // 5 years
          loanType: "personal",
          selectedOffers: ["offer-bajaj-1", "offer-tata-1"],
          createdAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
        }
      ];
      
      res.json(savedComparisons);
    } catch (error) {
      console.error("Error fetching saved comparisons:", error);
      res.status(500).json({ error: "Failed to fetch saved comparisons" });
    }
  });

  // Get comparison analytics
  app.get("/api/loan-comparison/analytics/:comparisonId", async (req, res) => {
    try {
      const { comparisonId } = req.params;
      
      // Mock analytics data - in production, fetch from database
      const analytics = {
        comparisonId,
        totalViews: Math.floor(Math.random() * 50) + 10,
        avgTimeSpent: Math.floor(Math.random() * 300) + 120, // seconds
        mostComparedProviders: ["HDFC Bank", "ICICI Bank", "Bajaj Finserv"],
        popularCriteria: ["Interest Rate", "Total Cost", "Processing Fee"],
        conversionRate: Math.floor(Math.random() * 30) + 15 // percentage
      };
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching comparison analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ============ END LOAN COMPARISON API ROUTES ============

  // Register admin routes for loan marketplace management
  registerLoanAdminRoutes(app);

  console.log('✅ Loan Comparison routes registered');
  console.log('✅ Loan Admin routes registered');
}
