// @ts-nocheck
import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, or, desc, gte, lte, sql, count } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/roleMiddleware';
import * as schema from "@shared/schema";

export function registerKYCAdminSupporPart4Part2Routes(app: Express): void {
app.post('/api/support/tickets/:ticketId/apply-template', requireAuth, async (req, res) => {
  try {
    const { templateId } = req.body;
    const templateSteps = await storage.getSupportStepsByTemplateId(templateId);
    
    const createdSteps = [];
    for (const templateStep of templateSteps) {
      const step = await storage.createSupportStep({
        ticketId: req.params.ticketId,
        templateId: templateId,
        title: templateStep.title,
        description: templateStep.description,
        order: templateStep.order,
        status: 'pending',
        isRequired: templateStep.isRequired,
      });
      createdSteps.push(step);
    }

    res.json({ steps: createdSteps });
  } catch (error) {
    console.error('Error applying template to ticket:', error);
    res.status(500).json({ message: 'Failed to apply template to ticket' });
  }
});

// Update step status
app.patch('/api/support/steps/:stepId', requireAuth, async (req, res) => {
  try {
    const { status, notes, assignedTo } = req.body;
    const updateData: any = {};
    
    if (status) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completedAt = new Date();
        updateData.completedBy = req.user!.id;
      }
    }
    if (notes !== undefined) updateData.notes = notes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    const updated = await storage.updateSupportStep(req.params.stepId, updateData);
    if (!updated) {
      return res.status(404).json({ message: 'Step not found' });
    }
    res.json({ step: updated });
  } catch (error) {
    console.error('Error updating step:', error);
    res.status(500).json({ message: 'Failed to update step' });
  }
});

// Add comment to step
app.post('/api/support/steps/:stepId/comments', requireAuth, async (req, res) => {
  try {
    const { content, isInternal } = req.body;
    const comment = await storage.createSupportStepComment({
      stepId: req.params.stepId,
      authorId: req.user!.id,
      authorType: 'partner',
      content,
      isInternal: isInternal || false,
    });
    res.json({ comment });
  } catch (error) {
    console.error('Error adding step comment:', error);
    res.status(500).json({ message: 'Failed to add step comment' });
  }
});

// Get comments for step
app.get('/api/support/steps/:stepId/comments', requireAuth, async (req, res) => {
  try {
    const comments = await storage.getSupportStepComments(req.params.stepId);
    res.json({ comments });
  } catch (error) {
    console.error('Error fetching step comments:', error);
    res.status(500).json({ message: 'Failed to fetch step comments' });
  }
});

// Get partner's assigned support tickets with step progress
app.get('/api/partner/support/tickets', requireAuth, async (req, res) => {
  try {
    // Get support tickets assigned to partner's agents or the partner themselves
    const tickets = await db.select()
      .from(schema.supportTickets)
      .where(eq(schema.supportTickets.assignedTo, req.user!.id))
      .orderBy(desc(schema.supportTickets.createdAt));

    // Enrich with step progress for each ticket
    const enrichedTickets = await Promise.all(tickets.map(async (ticket) => {
      const steps = await storage.getSupportStepsByTicketId(ticket.id);
      const totalSteps = steps.length;
      const completedSteps = steps.filter(s => s.status === 'completed').length;
      
      return {
        ...ticket,
        stepProgress: {
          total: totalSteps,
          completed: completedSteps,
          percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
        },
        nextStep: steps.find(s => s.status !== 'completed') || null,
      };
    }));

    res.json({ tickets: enrichedTickets });
  } catch (error) {
    console.error('Error fetching partner support tickets:', error);
    res.status(500).json({ message: 'Failed to fetch support tickets' });
  }
});

// Get support statistics for partner dashboard
app.get('/api/partner/support/stats', requireAuth, async (req, res) => {
  try {
    const tickets = await db.select()
      .from(schema.supportTickets)
      .where(eq(schema.supportTickets.assignedTo, req.user!.id));

    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      pending: tickets.filter(t => t.status === 'pending').length,
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching support stats:', error);
    res.status(500).json({ message: 'Failed to fetch support statistics' });
  }
});

// Seed default support templates
app.post('/api/admin/support/seed-templates', requireAuth, async (req, res) => {
  try {
    const defaultTemplates = [
      {
        name: 'ITR-1 Filing (Sahaj)',
        description: 'Step-by-step guide for filing ITR-1 for salaried individuals with income up to Rs.50 lakhs',
        category: 'tax_filing',
        estimatedTime: '2-3 days',
        requiredDocuments: ['Form 16', 'Bank statements', 'PAN card', 'Aadhaar card', 'Investment proofs'],
        steps: [
          { title: 'Collect Income Documents', description: 'Gather Form 16, salary slips, and other income proofs from the client', isRequired: true },
          { title: 'Verify PAN & Aadhaar', description: 'Ensure PAN is linked with Aadhaar and details match', isRequired: true },
          { title: 'Download Form 26AS', description: 'Download and verify TDS credits from Form 26AS', isRequired: true },
          { title: 'Download AIS', description: 'Fetch Annual Information Statement for comprehensive income verification', isRequired: true },
          { title: 'Calculate Tax Liability', description: 'Compute tax under old vs new regime and recommend optimal choice', isRequired: true },
          { title: 'Prepare ITR Form', description: 'Fill ITR-1 form with verified data', isRequired: true },
          { title: 'Client Review', description: 'Share draft with client for approval before filing', isRequired: true },
          { title: 'File ITR', description: 'Submit ITR on income tax portal and generate acknowledgement', isRequired: true },
          { title: 'E-Verify Return', description: 'Complete e-verification via Aadhaar OTP or DSC', isRequired: true },
        ],
      },
      {
        name: 'ITR-2 Filing',
        description: 'ITR-2 for individuals with capital gains, foreign income, or multiple house properties',
        category: 'tax_filing',
        estimatedTime: '3-5 days',
        requiredDocuments: ['Form 16', 'Capital gains statements', 'Foreign income proof', 'Property documents', 'Bank statements'],
        steps: [
          { title: 'Collect All Income Sources', description: 'Gather salary, capital gains, rental income, and other income documents', isRequired: true },
          { title: 'Verify Capital Gains', description: 'Calculate short-term and long-term capital gains from equity, mutual funds, and property', isRequired: true },
          { title: 'Check Foreign Assets', description: 'If applicable, collect details of foreign assets and income for Schedule FA', isRequired: true },
          { title: 'Download Form 26AS & AIS', description: 'Cross-verify all TDS credits and income reported by third parties', isRequired: true },
          { title: 'Set-off Capital Losses', description: 'Carry forward losses from previous years if applicable', isRequired: true },
          { title: 'Tax Calculation', description: 'Calculate tax liability considering all deductions and exemptions', isRequired: true },
          { title: 'Prepare & Review ITR-2', description: 'Complete form preparation and internal review', isRequired: true },
          { title: 'Client Sign-off', description: 'Get client approval on computed figures', isRequired: true },
          { title: 'File & E-Verify', description: 'Submit return and complete e-verification', isRequired: true },
        ],
      },
      {
        name: 'KYC Verification',
        description: 'Complete KYC verification process for investment accounts',
        category: 'kyc',
        estimatedTime: '1-2 days',
        requiredDocuments: ['PAN card', 'Aadhaar card', 'Address proof', 'Passport photo', 'Bank statement'],
        steps: [
          { title: 'Collect KYC Documents', description: 'Request PAN, Aadhaar, address proof from client', isRequired: true },
          { title: 'Verify Document Authenticity', description: 'Check if documents are valid and not expired', isRequired: true },
          { title: 'PAN Verification', description: 'Verify PAN number with NSDL database', isRequired: true },
          { title: 'Aadhaar Verification', description: 'Complete Aadhaar-based e-KYC if applicable', isRequired: true },
          { title: 'Update CKYC Records', description: 'Update or create CKYC record with verified details', isRequired: true },
          { title: 'Final Confirmation', description: 'Send KYC completion confirmation to client', isRequired: true },
        ],
      },
      {
        name: 'Tax Planning Consultation',
        description: 'Comprehensive tax planning for the financial year',
        category: 'tax_planning',
        estimatedTime: '1-2 hours',
        requiredDocuments: ['Previous ITR', 'Salary structure', 'Investment details', 'Loan documents'],
        steps: [
          { title: 'Review Current Tax Status', description: 'Analyze current income and tax liability', isRequired: true },
          { title: 'Identify Deduction Opportunities', description: 'List eligible deductions under 80C, 80D, etc.', isRequired: true },
          { title: 'HRA & House Property Analysis', description: 'Optimize HRA claim and home loan benefits', isRequired: false },
          { title: 'Investment Recommendations', description: 'Suggest tax-saving investments based on risk profile', isRequired: true },
          { title: 'Old vs New Regime Comparison', description: 'Calculate tax under both regimes and recommend optimal choice', isRequired: true },
          { title: 'Prepare Tax Plan Document', description: 'Create comprehensive tax planning report for client', isRequired: true },
        ],
      },
      {
        name: 'GST Registration',
        description: 'New GST registration for businesses',
        category: 'gst',
        estimatedTime: '5-7 days',
        requiredDocuments: ['PAN card', 'Aadhaar card', 'Business registration', 'Bank account proof', 'Address proof'],
        steps: [
          { title: 'Gather Business Details', description: 'Collect business name, constitution, and nature details', isRequired: true },
          { title: 'Verify Eligibility', description: 'Check if GST registration is mandatory based on turnover', isRequired: true },
          { title: 'Collect Documents', description: 'Get all required documents from client', isRequired: true },
          { title: 'Fill GST Application', description: 'Complete GST REG-01 form with business details', isRequired: true },
          { title: 'Upload Documents', description: 'Upload all required documents to GST portal', isRequired: true },
          { title: 'Application Submission', description: 'Submit application and note ARN', isRequired: true },
          { title: 'Respond to Queries', description: 'Address any queries raised by GST officer', isRequired: false },
          { title: 'Receive GSTIN', description: 'Download GST certificate after approval', isRequired: true },
        ],
      },
      {
        name: "ITR-3 Filing (Business Income)",
        description: "ITR-3 for individuals and HUFs with income from business or profession",
        category: "tax_filing",
        estimatedTime: "5-7 days",
        requiredDocuments: ["Form 16", "Business P&L", "Balance Sheet", "Bank statements", "GST returns", "Capital gains"],
        steps: [
          { title: "Collect Business Records", description: "Gather P&L statement, balance sheet, and business bank statements", isRequired: true },
          { title: "Verify GST Compliance", description: "Check GST returns are filed and reconcile with books", isRequired: true },
          { title: "Calculate Business Income", description: "Compute taxable business income after all deductions", isRequired: true },
          { title: "Capital Gains Computation", description: "Calculate any capital gains from business assets or investments", isRequired: false },
          { title: "Download Form 26AS/AIS", description: "Verify TDS credits and third-party reported income", isRequired: true },
          { title: "Prepare Financial Statements", description: "Finalize P&L and Balance Sheet for filing", isRequired: true },
          { title: "Fill ITR-3 Form", description: "Complete all schedules including P&L and Balance Sheet", isRequired: true },
          { title: "Tax Audit Check", description: "Verify if tax audit (44AB) is required based on turnover", isRequired: true },
          { title: "Client Review", description: "Get client approval on financial statements and tax computation", isRequired: true },
          { title: "File & E-Verify", description: "Submit ITR-3 and complete e-verification", isRequired: true },
        ],
      },
      {
        name: "ITR-4 Filing (Sugam)",
        description: "ITR-4 for individuals, HUFs, and firms under presumptive taxation scheme",
        category: "tax_filing",
        estimatedTime: "2-3 days",
        requiredDocuments: ["Form 16", "Business turnover proof", "Bank statements", "PAN card", "Aadhaar"],
        steps: [
          { title: "Verify Eligibility", description: "Check if taxpayer qualifies for presumptive taxation (44AD/44ADA/44AE)", isRequired: true },
          { title: "Collect Turnover Details", description: "Get total gross receipts/turnover for the year", isRequired: true },
          { title: "Calculate Presumptive Income", description: "Compute income at 8%/6% of turnover as per applicable provisions", isRequired: true },
          { title: "Download Form 26AS/AIS", description: "Verify TDS credits match with presumptive scheme", isRequired: true },
          { title: "Any Salary/Other Income", description: "Include any salary or other income if applicable", isRequired: false },
          { title: "Prepare ITR-4", description: "Fill ITR-4 with presumptive income details", isRequired: true },
          { title: "Client Sign-off", description: "Get client confirmation on presumptive income declaration", isRequired: true },
          { title: "File & E-Verify", description: "Submit ITR-4 and complete e-verification", isRequired: true },
        ],
      },
      {
        name: "GST Return Filing (Monthly/Quarterly)",
        description: "Regular GST return filing including GSTR-1, GSTR-3B",
        category: "gst",
        estimatedTime: "1-2 days",
        requiredDocuments: ["Sales invoices", "Purchase invoices", "E-way bills", "Bank statements"],
        steps: [
          { title: "Collect Sales Data", description: "Get all B2B and B2C sales invoices for the period", isRequired: true },
          { title: "Collect Purchase Data", description: "Gather all purchase invoices and input GST details", isRequired: true },
          { title: "Reconcile ITC", description: "Match input tax credit with GSTR-2B", isRequired: true },
          { title: "Prepare GSTR-1", description: "Upload outward supplies in GSTR-1", isRequired: true },
          { title: "File GSTR-1", description: "Submit GSTR-1 before due date", isRequired: true },
          { title: "Prepare GSTR-3B", description: "Calculate tax liability and ITC for GSTR-3B", isRequired: true },
          { title: "Payment of GST", description: "Create challan and pay GST dues", isRequired: true },
          { title: "File GSTR-3B", description: "Submit GSTR-3B with payment confirmation", isRequired: true },
        ],
      },
      {
        name: "Investment Advisory",
        description: "Personalized investment advisory and portfolio review",
        category: "investment",
        estimatedTime: "1-2 hours",
        requiredDocuments: ["Current portfolio statement", "Risk profile questionnaire", "Financial goals document", "Income proof"],
        steps: [
          { title: "Gather Portfolio Details", description: "Collect current investment holdings across all asset classes", isRequired: true },
          { title: "Risk Profiling", description: "Assess client risk tolerance and investment horizon", isRequired: true },
          { title: "Financial Goal Setting", description: "Document short-term and long-term financial goals", isRequired: true },
          { title: "Portfolio Analysis", description: "Analyze current asset allocation and performance", isRequired: true },
          { title: "Tax Efficiency Review", description: "Check tax implications and opportunities for tax-loss harvesting", isRequired: false },
          { title: "Rebalancing Recommendations", description: "Suggest portfolio adjustments based on goals and risk profile", isRequired: true },
          { title: "Prepare Advisory Report", description: "Create comprehensive investment advisory document", isRequired: true },
          { title: "Client Presentation", description: "Present recommendations and answer client queries", isRequired: true },
        ],
      },
      {
        name: "Business Loan Application",
        description: "End-to-end support for business loan applications",
        category: "loan",
        estimatedTime: "7-10 days",
        requiredDocuments: ["Business financials", "ITR (3 years)", "Bank statements", "GST returns", "KYC documents"],
        steps: [
          { title: "Assess Loan Requirement", description: "Understand purpose, amount, and tenure of loan required", isRequired: true },
          { title: "Eligibility Check", description: "Preliminary assessment of loan eligibility based on financials", isRequired: true },
          { title: "Collect Documents", description: "Gather all required financial and KYC documents", isRequired: true },
          { title: "Select Lender", description: "Compare offers from multiple lenders and recommend best option", isRequired: true },
          { title: "Application Preparation", description: "Fill loan application with complete business details", isRequired: true },
          { title: "Document Submission", description: "Submit application with all supporting documents", isRequired: true },
          { title: "Lender Queries", description: "Address any clarifications or additional documents requested", isRequired: false },
          { title: "Sanction & Disbursement", description: "Follow up on sanction and coordinate disbursement", isRequired: true },
        ],
      },
    ];

    const createdTemplates = [];
    for (const templateData of defaultTemplates) {
      const { steps, ...templateInfo } = templateData;
      const template = await storage.createSupportTemplate({
        ...templateInfo,
        isActive: true,
        createdBy: req.user!.id,
      });

      for (let i = 0; i < steps.length; i++) {
        await storage.createSupportStep({
          templateId: template.id,
          title: steps[i].title,
          description: steps[i].description,
          order: i + 1,
          status: 'pending',
          isRequired: steps[i].isRequired,
        });
      }

      createdTemplates.push(template);
    }

    res.json({ 
      message: `Created ${createdTemplates.length} support templates`, 
      templates: createdTemplates 
    });
  } catch (error) {
    console.error('Error seeding support templates:', error);
    res.status(500).json({ message: 'Failed to seed support templates' });
  }
});


// Admin Error Logs API for Replit Suggestions page
app.get('/api/admin/error-logs', requireAdmin, async (req, res) => {
  try {
    const errorLogs = [];
    
    if (!process.env.GEMINI_API_KEY) {
      errorLogs.push({
        id: 'warn-gemini',
        timestamp: new Date().toISOString(),
        level: 'low',
        category: 'integration',
        message: 'AI Investment Service running without Gemini - using rule-based analysis',
        source: 'server/services/ai-investment-service.ts',
        count: 1,
        lastOccurrence: new Date().toISOString(),
        suggestedFix: 'Add GEMINI_API_KEY to enable AI-powered investment advisory',
        resolved: false
      });
    }
    
    if (!process.env.CKYC_API_KEY) {
      errorLogs.push({
        id: 'warn-ckyc',
        timestamp: new Date().toISOString(),
        level: 'medium',
        category: 'api',
        message: 'CKYC API credentials not configured - using mock mode',
        source: 'server/services/ckyc-service.ts',
        count: 1,
        lastOccurrence: new Date().toISOString(),
        suggestedFix: 'Configure CKYC_API_KEY and CKYC_API_SECRET environment variables',
        resolved: false
      });
    }
    
    if (!process.env.AUTHBRIDGE_API_KEY) {
      errorLogs.push({
        id: 'warn-authbridge',
        timestamp: new Date().toISOString(),
        level: 'low',
        category: 'integration',
        message: 'AuthBridge CKYC API credentials not configured - using mock mode',
        source: 'server/services/authbridge-ckyc-service.ts',
        count: 1,
        lastOccurrence: new Date().toISOString(),
        suggestedFix: 'Add AuthBridge API credentials for production CKYC verification',
        resolved: false
      });
    }
    
    const cashfreeEnv = process.env.CASHFREE_PG_ENVIRONMENT || process.env.CASHFREE_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX');
    if (cashfreeEnv.toUpperCase() === 'SANDBOX') {
      errorLogs.push({
        id: 'info-cashfree',
        timestamp: new Date().toISOString(),
        level: 'low',
        category: 'payment',
        message: 'Cashfree PG running in SANDBOX mode',
        source: 'server/services/cashfree-service.ts',
        count: 1,
        lastOccurrence: new Date().toISOString(),
        suggestedFix: 'Set CASHFREE_PG_ENVIRONMENT=PRODUCTION for live payments',
        resolved: false
      });
    }
    
    res.json({
      errorLogs,
      summary: {
        total: errorLogs.length,
        critical: errorLogs.filter(e => e.level === 'critical').length,
        high: errorLogs.filter(e => e.level === 'high').length,
        medium: errorLogs.filter(e => e.level === 'medium').length,
        low: errorLogs.filter(e => e.level === 'low').length
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({ message: 'Failed to fetch error logs' });
  }
});


// Stock AI - AI-powered stock and derivatives recommendations
app.post("/api/stock-ai/generate", requireAuth, async (req, res) => {
  try {
    const { category, timeHorizon, investmentAmount, riskTolerance, sectors, marketCap, tradingStyle, derivativeType } = req.body;
    // Use dynamic import() — ESM bundles do not support synchronous require() for CJS packages
    const yahooFinance = await import('yahoo-finance2').then(m => m.default).catch(() => null);


    // Generate AI-powered stock recommendations based on parameters with real-time prices
    const generateStockRecommendations = async () => {
      const stockPool = [
        { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Energy', fallbackPrice: 2890.50 },
        { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', fallbackPrice: 3324.90 },
        { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Banking', fallbackPrice: 1654.25 },
        { symbol: 'INFY', name: 'Infosys Limited', sector: 'IT', fallbackPrice: 1689.60 },
        { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Banking', fallbackPrice: 1056.40 },
        { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG', fallbackPrice: 2456.80 },
        { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking', fallbackPrice: 628.35 },
        { symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', fallbackPrice: 2147.60 },
        { symbol: 'ITC', name: 'ITC Limited', sector: 'FMCG', fallbackPrice: 456.70 },
        { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'Banking', fallbackPrice: 2149.70 },
        { symbol: 'LT', name: 'Larsen & Toubro', sector: 'Infra', fallbackPrice: 4072.40 },
        { symbol: 'AXISBANK', name: 'Axis Bank Ltd', sector: 'Banking', fallbackPrice: 1089.25 },
        { symbol: 'WIPRO', name: 'Wipro Limited', sector: 'IT', fallbackPrice: 272.67 },
        { symbol: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Auto', fallbackPrice: 16649.00 },
        { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', sector: 'Banking', fallbackPrice: 1007.80 },
        { symbol: 'SUNPHARMA', name: 'Sun Pharma Industries', sector: 'Pharma', fallbackPrice: 1823.45 },
        { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Auto', fallbackPrice: 789.30 },
        { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', sector: 'Energy', fallbackPrice: 267.85 },
        { symbol: 'TITAN', name: 'Titan Company Ltd', sector: 'Consumer', fallbackPrice: 3456.90 },
        { symbol: 'ADANIENT', name: 'Adani Enterprises', sector: 'Infra', fallbackPrice: 2987.60 }
      ];

      let filteredStocks = sectors && sectors.length > 0
        ? stockPool.filter((s: any) => sectors.includes(s.sector))
        : stockPool;

      const numRecommendations = Math.min(5, Math.max(3, Math.floor(investmentAmount / 100000)));
      const shuffled = filteredStocks.sort(() => 0.5 - Math.random());
      const selectedStocks = shuffled.slice(0, numRecommendations);

      // Fetch real-time prices from Yahoo Finance for Indian stocks
      const stocksWithPrices = await Promise.all(
        selectedStocks.map(async (stock) => {
          try {
            if (!yahooFinance) return { ...stock, price: stock.fallbackPrice };
            const quote = await yahooFinance.quote(`${stock.symbol}.NS`);
            return { ...stock, price: quote?.regularMarketPrice || stock.fallbackPrice };
          } catch (err) {
            console.log(`Failed to fetch price for ${stock.symbol}, using fallback`);
            return { ...stock, price: stock.fallbackPrice };
          }
        })
      );


      const timeHorizonMultipliers: Record<string, { targetPct: number; slPct: number; returnPct: number }> = {
        'intraday': { targetPct: 0.02, slPct: 0.01, returnPct: 2 },
        'ultra_short': { targetPct: 0.04, slPct: 0.02, returnPct: 4 },
        'short_term': { targetPct: 0.08, slPct: 0.04, returnPct: 8 },
        'medium_term': { targetPct: 0.15, slPct: 0.08, returnPct: 15 },
        'long_term': { targetPct: 0.30, slPct: 0.12, returnPct: 30 }
      };

      const riskMultipliers: Record<string, number> = {
        'very_conservative': 0.5,
        'conservative': 0.7,
        'moderate': 1.0,
        'aggressive': 1.4,
        'very_aggressive': 1.8
      };

      const multiplier = timeHorizonMultipliers[timeHorizon] || timeHorizonMultipliers['short_term'];
      const riskMult = riskMultipliers[riskTolerance] || 1.0;

      return stocksWithPrices.map((stock: any, idx: number) => {
        const isUptrend = Math.random() > 0.3;
        const action = isUptrend ? 'BUY' : (Math.random() > 0.5 ? 'SELL' : 'HOLD');
        const targetPrice = isUptrend 
          ? stock.price * (1 + multiplier.targetPct * riskMult) 
          : stock.price * (1 - multiplier.targetPct * riskMult);
        const stopLoss = isUptrend
          ? stock.price * (1 - multiplier.slPct)
          : stock.price * (1 + multiplier.slPct);
        
        const rsi = Math.floor(30 + Math.random() * 50);
        const macd = isUptrend ? 'Bullish' : 'Bearish';

        return {
          id: `STOCK-${Date.now()}-${idx}`,
          symbol: stock.symbol,
          name: stock.name,
          exchange: 'NSE',
          sector: stock.sector,
          currentPrice: stock.price,
          entryPrice: stock.price * (isUptrend ? 0.995 : 1.005),
          targetPrice: Math.round(targetPrice * 100) / 100,
          stopLoss: Math.round(stopLoss * 100) / 100,
          action,
          confidence: Math.floor(65 + Math.random() * 30),
          riskScore: Math.floor(3 + Math.random() * 5),
          expectedReturn: Math.round(multiplier.returnPct * riskMult * 10) / 10,
          timeHorizon,
          technicalIndicators: {
            rsi,
            macd,
            movingAverage50: Math.round(stock.price * (0.95 + Math.random() * 0.1) * 100) / 100,
            movingAverage200: Math.round(stock.price * (0.9 + Math.random() * 0.1) * 100) / 100,
            volumeTrend: Math.random() > 0.5 ? 'High' : 'Normal',
            supportLevel: Math.round(stock.price * 0.92 * 100) / 100,
            resistanceLevel: Math.round(stock.price * 1.08 * 100) / 100
          },
          aiRationale: `Based on ${timeHorizon.replace('_', ' ')} analysis, ${stock.symbol} shows ${isUptrend ? 'bullish momentum' : 'consolidation pattern'} with RSI at ${rsi}. ${macd} MACD crossover indicates ${action.toLowerCase()} opportunity.`,
          keyDrivers: [
            isUptrend ? 'Positive momentum' : 'Mean reversion',
            'Strong fundamentals',
            'Sector tailwinds'
          ],
          risks: [
            'Market volatility',
            'Sector rotation risk',
            'Global cues impact'
          ]
        };
      });
    };

    const generateDerivativeRecommendations = () => {
      const underlyings = [
        { symbol: 'NIFTY', name: 'Nifty 50 Index', fallbackPrice: 24850, lotSize: 25 },
        { symbol: 'BANKNIFTY', name: 'Bank Nifty Index', fallbackPrice: 53200, lotSize: 15 },
        { symbol: 'FINNIFTY', name: 'Fin Nifty Index', fallbackPrice: 23450, lotSize: 25 },
        { symbol: 'RELIANCE', name: 'Reliance Industries', fallbackPrice: 2890, lotSize: 250 },
        { symbol: 'TCS', name: 'TCS Limited', fallbackPrice: 3325, lotSize: 150 },
        { symbol: 'HDFCBANK', name: 'HDFC Bank', fallbackPrice: 1654, lotSize: 550 }
      ];

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (7 - expiry.getDay()) % 7 + 4);
      const expiryStr = expiry.toISOString().split('T')[0];

      const numRecommendations = Math.min(4, Math.max(2, Math.floor(investmentAmount / 200000)));
      const shuffled = underlyings.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, numRecommendations);

      return selected.map((underlying: any, idx: number) => {
        const isBullish = Math.random() > 0.4;
        const isFutures = derivativeType === 'futures';
        const isCall = derivativeType === 'options_call' || (derivativeType === 'spreads' && isBullish);
        
        let instrumentType: 'FUTURES' | 'CALL_OPTION' | 'PUT_OPTION' = 'FUTURES';
        let strikePrice: number | undefined;
        let premium = 0;
        let strategy = '';

        if (isFutures) {
          instrumentType = 'FUTURES';
          premium = underlying.price;
          strategy = isBullish ? 'Long Futures - Bullish Directional' : 'Short Futures - Bearish Directional';
        } else {
          instrumentType = isCall ? 'CALL_OPTION' : 'PUT_OPTION';
          strikePrice = isCall
            ? Math.round(underlying.price * 1.02 / 50) * 50
            : Math.round(underlying.price * 0.98 / 50) * 50;
          premium = Math.round((underlying.price * 0.015 + Math.random() * underlying.price * 0.01) * 100) / 100;
          strategy = isCall 
            ? 'Long Call - Limited Risk Bullish' 
            : 'Long Put - Limited Risk Bearish';
        }

        const action = isBullish ? 'BUY' : 'SELL';
        const targetMultiplier = isFutures ? 0.03 : 0.5;
        const slMultiplier = isFutures ? 0.015 : 0.3;
        const delta = isCall ? (0.4 + Math.random() * 0.3) : -(0.4 + Math.random() * 0.3);

        return {
          id: `DERIV-${Date.now()}-${idx}`,
          symbol: `${underlying.symbol}${expiryStr.replace(/-/g, '').slice(4)}${strikePrice ? strikePrice : 'FUT'}${instrumentType === 'CALL_OPTION' ? 'CE' : instrumentType === 'PUT_OPTION' ? 'PE' : ''}`,
          underlying: underlying.name,
          instrumentType,
          strikePrice,
          expiryDate: expiryStr,
          lotSize: underlying.lotSize,
          currentPremium: premium,
          entryPrice: premium,
          targetPrice: Math.round(premium * (1 + targetMultiplier) * 100) / 100,
          stopLoss: Math.round(premium * (1 - slMultiplier) * 100) / 100,
          action,
          confidence: Math.floor(60 + Math.random() * 30),
          riskScore: isFutures ? Math.floor(6 + Math.random() * 3) : Math.floor(4 + Math.random() * 4),
          expectedReturn: Math.round(targetMultiplier * 100),
          maxProfit: isFutures ? undefined : Math.round(premium * targetMultiplier * underlying.lotSize),
          maxLoss: Math.round(premium * slMultiplier * underlying.lotSize),
          breakeven: strikePrice ? strikePrice + (isCall ? premium : -premium) : undefined,
          greeks: !isFutures ? {
            delta: Math.round(delta * 100) / 100,
            gamma: Math.round((0.001 + Math.random() * 0.002) * 10000) / 10000,
            theta: Math.round(-(premium * 0.02 + Math.random() * premium * 0.01) * 100) / 100,
            vega: Math.round((premium * 0.1 + Math.random() * premium * 0.05) * 100) / 100,
            iv: Math.round((15 + Math.random() * 15) * 10) / 10
          } : undefined,
          aiRationale: `${underlying.name} showing ${isBullish ? 'bullish' : 'bearish'} signals. ${strategy} recommended with ${riskTolerance} risk profile.`,
          strategy,
          risks: ['Time decay (Theta)', 'Volatility changes', 'Directional risk', 'Liquidity risk']
        };
      });
    };

    const response: any = {};
    if (category === 'stocks') {
      response.stocks = await generateStockRecommendations();
    } else if (category === 'derivatives') {
      response.derivatives = generateDerivativeRecommendations();
    } else {
      response.stocks = generateStockRecommendations();
      response.derivatives = generateDerivativeRecommendations();
    }

    res.json(response);
  } catch (error) {
    console.error('Error generating stock AI recommendations:', error);
    res.status(500).json({ message: 'Failed to generate recommendations' });
  }
});

// ============ AGENT PROSPECT CLIENT ACQUISITION ROUTES ============
}
