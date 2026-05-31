// @ts-nocheck
import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { unifiedOCRService } from '../services/unified-ocr-service';
import { sandboxITRService } from '../sandbox-itr-service';
import { digilockerService } from '../services/digilockerService';
import * as schema from "@shared/schema";

const calculateCapitalGainsSchema = z.object({
  stcgAmount: z.number().min(0, "STCG amount must be positive"),
  ltcgAmount: z.number().min(0, "LTCG amount must be positive"),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Financial year must be in format YYYY-YY"),
  calculationDate: z.string().optional()
});

const calculateIncomeTaxSchema = z.object({
  income: z.number().min(0, 'Income must be positive'),
  regime: z.enum(['old', 'new'], { error: () => ({ message: "Regime must be 'old' or 'new'" }) }),
  deductions: z.object({
    section80C: z.number().min(0).optional(),
    section80D: z.number().min(0).optional(),
    standardDeduction: z.number().min(0).optional(),
    otherDeductions: z.number().min(0).optional()
  }).optional(),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Financial year must be in format YYYY-YY").optional()
});

const taxReminderSubscriptionSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  itrFormType: z.enum(['ITR-1', 'ITR-2', 'ITR-3', 'ITR-4', 'ITR-5', 'ITR-6', 'ITR-7'], { error: () => ({ message: 'Invalid ITR form type' })
  })
});

export function registerTaxFilingPart2Routes(app: Express): void {
app.get("/api/tax/documents/:documentId/logs", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { documentId } = req.params;
    const document = await storage.getTaxDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Verify user owns this document
    if (document.userId !== (req.user as any)!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const logs = await storage.getTaxDocumentAccessLogs(documentId);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching document access logs:", error);
    res.status(500).json({ error: "Failed to fetch access logs" });
  }
});

// Update tax document metadata
app.put("/api/tax/documents/:documentId", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { documentId } = req.params;
    const document = await storage.getTaxDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Verify user owns this document
    if (document.userId !== (req.user as any)!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updates = req.body;
    const updatedDocument = await storage.updateTaxDocument(documentId, updates);
    
    // Log document update
    await storage.createTaxDocumentAccessLog({
      documentId: document.id,
      userId: req.user!.id,
      action: 'update',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      accessedAt: new Date()
    });

    res.json({ success: true, document: updatedDocument });
  } catch (error) {
    console.error("Error updating tax document:", error);
    res.status(500).json({ error: "Failed to update tax document" });
  }
});

// ===== TAX RULES AND CALCULATION ROUTES =====

// Get all active tax rules
app.get("/api/tax-rules/active", async (req, res) => {
  try {
    const rules = await storage.getActiveTaxRules();
    res.json({ success: true, rules });
  } catch (error) {
    console.error("Error fetching active tax rules:", error);
    res.status(500).json({ error: "Failed to fetch active tax rules" });
  }
});

// Get specific tax rule for current date
app.get("/api/tax-rules/:ruleType/:category", async (req, res) => {
  try {
    const { ruleType, category } = req.params;
    const { date } = req.query;
    
    const calculationDate = date ? new Date(date as string) : new Date();
    const rule = await storage.getTaxRule(ruleType, category, calculationDate);
    
    if (!rule) {
      return res.status(404).json({ 
        error: `Tax rule not found for type '${ruleType}' and category '${category}'` 
      });
    }
    
    res.json({ success: true, rule });
  } catch (error) {
    console.error("Error fetching tax rule:", error);
    res.status(500).json({ error: "Failed to fetch tax rule" });
  }
});

// Calculate capital gains tax
app.post("/api/tax/calculate-capital-gains", async (req, res) => {
  try {
    const validation = calculateCapitalGainsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.issues 
      });
    }
    
    const { stcgAmount, ltcgAmount, financialYear, calculationDate } = validation.data;
    const calcDate = calculationDate ? new Date(calculationDate) : new Date();
    
    // Fetch STCG rate from database
    const stcgRule = await storage.getTaxRule('capital_gains', 'stcg', calcDate);
    if (!stcgRule) {
      return res.status(404).json({ 
        error: "STCG tax rate not found in database. Please contact administrator." 
      });
    }
    
    // Fetch LTCG rate and exemption from database
    const ltcgRateRule = await storage.getTaxRule('capital_gains', 'ltcg_rate', calcDate);
    const ltcgExemptionRule = await storage.getTaxRule('capital_gains', 'ltcg_exemption', calcDate);
    
    if (!ltcgRateRule || !ltcgExemptionRule) {
      return res.status(404).json({ 
        error: "LTCG tax rate or exemption not found in database. Please contact administrator." 
      });
    }
    
    // Parse rates from database (stored as decimal)
    const stcgRate = parseFloat(stcgRateRule.value) / 100; // Convert percentage to decimal
    const ltcgRate = parseFloat(ltcgRateRule.value) / 100;
    const ltcgExemption = parseFloat(ltcgExemptionRule.value);
    
    // Calculate taxes
    const stcgTax = stcgAmount * stcgRate;
    const taxableLtcg = Math.max(0, ltcgAmount - ltcgExemption);
    const ltcgTax = taxableLtcg * ltcgRate;
    const totalTax = stcgTax + ltcgTax;
    
    // Return detailed breakdown
    res.json({
      success: true,
      calculation: {
        stcgAmount,
        ltcgAmount,
        financialYear,
        calculationDate: calcDate.toISOString(),
        stcgTax: parseFloat(stcgTax.toFixed(2)),
        ltcgTax: parseFloat(ltcgTax.toFixed(2)),
        totalTax: parseFloat(totalTax.toFixed(2)),
        breakdown: {
          stcg: {
            amount: stcgAmount,
            rate: parseFloat(stcgRateRule.value),
            ratePercentage: `${stcgRateRule.value}%`,
            tax: parseFloat(stcgTax.toFixed(2)),
            effectiveFrom: stcgRule.effectiveFrom
          },
          ltcg: {
            amount: ltcgAmount,
            exemption: ltcgExemption,
            taxableAmount: taxableLtcg,
            rate: parseFloat(ltcgRateRule.value),
            ratePercentage: `${ltcgRateRule.value}%`,
            tax: parseFloat(ltcgTax.toFixed(2)),
            rateEffectiveFrom: ltcgRateRule.effectiveFrom,
            exemptionEffectiveFrom: ltcgExemptionRule.effectiveFrom
          }
        }
      }
    });
  } catch (error) {
    console.error("Error calculating capital gains tax:", error);
    res.status(500).json({ error: "Failed to calculate capital gains tax" });
  }
});

// Calculate income tax
app.post("/api/tax/calculate-income-tax", async (req, res) => {
  try {
    const validation = calculateIncomeTaxSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.issues 
      });
    }
    
    const { income, regime, deductions, financialYear } = validation.data;
    
    // Fetch all slab rates from database for the selected regime
    const slabCategory = regime === 'old' ? 'old_regime' : 'new_regime';
    const slabs = await storage.getTaxSlabs(slabCategory);
    
    if (!slabs || slabs.length === 0) {
      return res.status(404).json({ 
        error: `Income tax slabs not found for ${regime} regime. Please contact administrator.` 
      });
    }
    
    // Sort slabs by minAmount
    slabs.sort((a: any, b: any) => parseFloat(a.minAmount || '0') - parseFloat(b.minAmount || '0'));
    
    // Calculate taxable income
    let taxableIncome = income;
    const deductionsApplied: any = {};
    
    if (regime === 'new') {
      // New regime: Standard deduction of ₹75,000
      const standardDeduction = 75000;
      taxableIncome = Math.max(0, income - standardDeduction);
      deductionsApplied.standardDeduction = standardDeduction;
    } else {
      // Old regime: Apply various deductions
      let totalDeductions = 0;
      
      if (deductions?.section80C) {
        const max80C = 150000;
        const applied80C = Math.min(deductions.section80C, max80C);
        totalDeductions += applied80C;
        deductionsApplied.section80C = applied80C;
      }
      
      if (deductions?.section80D) {
        const max80D = 25000;
        const applied80D = Math.min(deductions.section80D, max80D);
        totalDeductions += applied80D;
        deductionsApplied.section80D = applied80D;
      }
      
      if (deductions?.standardDeduction) {
        totalDeductions += deductions.standardDeduction;
        deductionsApplied.standardDeduction = deductions.standardDeduction;
      }
      
      if (deductions?.otherDeductions) {
        totalDeductions += deductions.otherDeductions;
        deductionsApplied.otherDeductions = deductions.otherDeductions;
      }
      
      taxableIncome = Math.max(0, income - totalDeductions);
    }
    
    // Calculate tax using progressive slabs
    let totalTax = 0;
    const slabBreakdown: any[] = [];
    
    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i];
      const minAmount = parseFloat(slab.minAmount || '0');
      const maxAmount = slab.maxAmount ? parseFloat(slab.maxAmount) : Infinity;
      const rate = parseFloat(slab.value) / 100;
      
      if (taxableIncome > minAmount) {
        const taxableInSlab = Math.min(taxableIncome, maxAmount) - minAmount;
        const taxInSlab = taxableInSlab * rate;
        totalTax += taxInSlab;
        
        slabBreakdown.push({
          minAmount,
          maxAmount: maxAmount === Infinity ? null : maxAmount,
          rate: parseFloat(slab.value),
          ratePercentage: `${slab.value}%`,
          taxableAmount: parseFloat(taxableInSlab.toFixed(2)),
          tax: parseFloat(taxInSlab.toFixed(2))
        });
        
        if (taxableIncome <= maxAmount) {
          break;
        }
      }
    }
    
    const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
    
    res.json({
      success: true,
      calculation: {
        income,
        regime,
        taxableIncome: parseFloat(taxableIncome.toFixed(2)),
        deductionsApplied,
        totalTax: parseFloat(totalTax.toFixed(2)),
        effectiveRate: parseFloat(effectiveRate.toFixed(2)),
        effectiveRatePercentage: `${effectiveRate.toFixed(2)}%`,
        breakdown: slabBreakdown,
        financialYear: financialYear || 'Current'
      }
    });
  } catch (error) {
    console.error("Error calculating income tax:", error);
    res.status(500).json({ error: "Failed to calculate income tax" });
  }
});

// Create tax reminder subscription
app.post("/api/tax/reminder-subscription", async (req, res) => {
  try {
    const validation = taxReminderSubscriptionSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.issues 
      });
    }
    
    const { userId, itrFormType } = validation.data;
    
    // Check if user already has a subscription
    const existingSubscription = await storage.getUserTaxReminderSubscription(userId);
    if (existingSubscription && existingSubscription.subscriptionStatus === 'active') {
      return res.status(400).json({ 
        error: "User already has an active tax reminder subscription" 
      });
    }
    
    // Determine pricing based on ITR form type
    let annualPrice = 0;
    let pricingTier = 'basic';
    
    switch (itrFormType) {
      case 'ITR-1':
        annualPrice = 299;
        pricingTier = 'basic';
        break;
      case 'ITR-2':
        annualPrice = 599;
        pricingTier = 'standard';
        break;
      case 'ITR-3':
        annualPrice = 1299;
        pricingTier = 'premium';
        break;
      case 'ITR-4':
      case 'ITR-5':
      case 'ITR-6':
      case 'ITR-7':
        annualPrice = 1999;
        pricingTier = 'premium';
        break;
      default:
        return res.status(400).json({ error: "Invalid ITR form type" });
    }
    
    // Check if user has expert ITR filing service
    // Users with active CA-assisted ITR cases get free reminders
    const userProfile = await storage.getUserProfile(userId);
    let hasExpertService = false;
    
    try {
      const activeItrCases = await db
        .select({ id: schema.agentItrCases.id, status: schema.agentItrCases.status, caId: schema.agentItrCases.caId })
        .from(schema.agentItrCases)
        .where(
          and(
            eq(schema.agentItrCases.clientId, userId),
            sql`${schema.agentItrCases.status} NOT IN ('completed', 'cancelled', 'rejected')`
          )
        )
        .limit(1);
      
      hasExpertService = activeItrCases.length > 0 && activeItrCases[0].caId !== null;
      
      if (hasExpertService) {
        console.info(`[Tax Reminder] User ${userId} has active CA-assisted ITR case - eligible for free tier`);
      }
    } catch (error: any) {
      console.warn('[Tax Reminder] Failed to check expert service status:', error.message);
      hasExpertService = false;
    }
    
    const isFree = hasExpertService;
    if (isFree) {
      annualPrice = 0;
      pricingTier = 'free_expert_tier';
    }
    
    // Create subscription
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1); // 1 year subscription
    
    const subscription = await storage.createTaxReminderSubscription({
      userId,
      itrFormType,
      subscriptionStatus: 'active',
      pricingTier,
      annualPrice: annualPrice.toString(),
      isFree,
      validFrom: validFrom.toISOString().split('T')[0],
      validUntil: validUntil.toISOString().split('T')[0],
      reminderChannels: ['email']
    });
    
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        userId: subscription.userId,
        itrFormType: (subscription as any).itrFormType,
        subscriptionStatus: subscription.subscriptionStatus,
        pricingTier: subscription.pricingTier,
        annualPrice: parseFloat(subscription.annualPrice),
        isFree: subscription.isFree,
        validFrom: subscription.validFrom,
        validUntil: subscription.validUntil,
        reminderChannels: subscription.reminderChannels,
        createdAt: subscription.createdAt
      }
    });
  } catch (error) {
    console.error("Error creating tax reminder subscription:", error);
    res.status(500).json({ error: "Failed to create tax reminder subscription" });
  }
});

// Get user's tax reminder subscription
app.get("/api/tax/reminder-subscription/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const subscription = await storage.getUserTaxReminderSubscription(userId);
    
    if (!subscription) {
      return res.status(404).json({ 
        error: "No active tax reminder subscription found for this user" 
      });
    }
    
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        userId: subscription.userId,
        itrFormType: (subscription as any).itrFormType,
        subscriptionStatus: subscription.subscriptionStatus,
        pricingTier: subscription.pricingTier,
        annualPrice: parseFloat(subscription.annualPrice),
        isFree: subscription.isFree,
        validFrom: subscription.validFrom,
        validUntil: subscription.validUntil,
        reminderChannels: subscription.reminderChannels,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      }
    });
  } catch (error) {
    console.error("Error fetching tax reminder subscription:", error);
    res.status(500).json({ error: "Failed to fetch tax reminder subscription" });
  }
});

// ===== CAPITAL GAINS PORTFOLIO CALCULATION & REMINDERS =====

// Calculate capital gains from user's portfolio
app.post("/api/tax/calculate-portfolio-gains/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    const { capitalGainsCalculator } = await import('../services/capital-gains-calculator');
    const gainsBreakdown = await capitalGainsCalculator.calculatePortfolioGains(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        stcgAmount: gainsBreakdown.stcgAmount,
        ltcgAmount: gainsBreakdown.ltcgAmount,
        stcgTax: gainsBreakdown.stcgTax,
        ltcgTax: gainsBreakdown.ltcgTax,
        totalTaxLiability: gainsBreakdown.totalTaxLiability,
        holdings: gainsBreakdown.holdings,
        calculatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error calculating portfolio gains:", error);
    res.status(500).json({ 
      error: "Failed to calculate capital gains from portfolio",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get capital gains reminders for user
app.get("/api/tax/capital-gains-reminders/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    const { capitalGainsCalculator } = await import('../services/capital-gains-calculator');
    const reminders = await capitalGainsCalculator.getRemindersForUser(userId);
    
    // Format reminders for response
    const formattedReminders = reminders.map((reminder: any) => ({
      id: reminder.id,
      quarter: reminder.quarter,
      financialYear: reminder.financialYear,
      dueDate: reminder.dueDate,
      estimatedSTCG: parseFloat(reminder.estimatedSTCG || '0'),
      estimatedLTCG: parseFloat(reminder.estimatedLTCG || '0'),
      totalTaxLiability: parseFloat(reminder.totalTaxLiability || '0'),
      status: reminder.status,
      reminderSentAt: reminder.reminderSentAt,
      createdAt: reminder.createdAt
    }));
    
    res.json({
      success: true,
      data: {
        userId,
        reminders: formattedReminders,
        totalReminders: formattedReminders.length
      }
    });
  } catch (error) {
    console.error("Error fetching capital gains reminders:", error);
    res.status(500).json({ 
      error: "Failed to fetch capital gains reminders",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Generate quarterly reminders for user
app.post("/api/tax/generate-quarterly-reminders/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { financialYear, subscriptionId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    if (!financialYear) {
      return res.status(400).json({ error: "Financial year is required (format: YYYY-YY)" });
    }
    
    // Check if user has an active subscription
    const subscription = subscriptionId 
      ? await storage.getUserTaxReminderSubscription(userId)
      : null;
    
    if (!subscription || subscription.subscriptionStatus !== 'active') {
      return res.status(403).json({ 
        error: "Active tax reminder subscription required to generate reminders",
        requiresSubscription: true
      });
    }
    
    const { capitalGainsCalculator } = await import('../services/capital-gains-calculator');
    const reminders = await capitalGainsCalculator.generateQuarterlyReminders(
      userId,
      subscription.id,
      financialYear
    );
    
    res.json({
      success: true,
      data: {
        userId,
        financialYear,
        remindersCreated: reminders.length,
        reminders: reminders.map((r: any) => ({
          quarter: r.quarter,
          dueDate: r.dueDate,
          estimatedSTCG: r.estimatedSTCG,
          estimatedLTCG: r.estimatedLTCG,
          totalTaxLiability: r.totalTaxLiability,
          cumulativePercentage: r.cumulativePercentage
        }))
      }
    });
  } catch (error) {
    console.error("Error generating quarterly reminders:", error);
    res.status(500).json({ 
      error: "Failed to generate quarterly reminders",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Check expert ITR filing subscription
app.get("/api/tax/check-expert-filing/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    // Check if user has expert ITR filing service
    const subscription = await storage.getUserTaxReminderSubscription(userId);
    
    const isFreeEligible = subscription?.isFree === true || 
                           subscription?.subscriptionStatus === 'free_expert_tier';
    
    res.json({
      success: true,
      data: {
        userId,
        isFreeEligible,
        hasActiveSubscription: subscription?.subscriptionStatus === 'active',
        subscriptionDetails: subscription ? {
          pricingTier: subscription.pricingTier,
          itrFormType: (subscription as any).itrFormType,
          validUntil: subscription.validUntil
        } : null
      }
    });
  } catch (error) {
    console.error("Error checking expert filing eligibility:", error);
    res.status(500).json({ 
      error: "Failed to check expert filing eligibility",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get BBPS categories
}
