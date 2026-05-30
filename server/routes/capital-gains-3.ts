import { Express, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { capitalGainsReports, insertCapitalGainsReportSchema, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { proposalCapitalGainsService } from '../services/proposal-capital-gains-service';
import { realizedGainsAggregationService } from '../services/realized-gains-aggregation-service';
import { capitalGainsCalculator } from '../services/capital-gains-calculator';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';
import { z } from 'zod';
import { sandboxITRService } from '../sandbox-itr-service';
import rateLimit from 'express-rate-limit';

const taxRegimeComparisonSchema = z.object({
  fiscalYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  salaryIncome: z.number().min(0).default(0),
  otherIncome: z.number().min(0).default(0),
  deductions80C: z.number().min(0).max(150000).default(0),
  deductions80D: z.number().min(0).max(100000).default(0),
  homeLoanInterest: z.number().min(0).default(0),
});

const itrAutoPopulateSchema = z.object({
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
  assessmentYear: z.string().regex(/^\d{4}-\d{2}$/),
  fiscalYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const taxApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many tax API requests. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerCapitalGainPart3Routes(app: Express): void {
  app.post("/api/capital-gains/itr-export-actual", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { assessmentYear, panNumber, fiscalYear } = req.body;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();
      const assessYear = assessmentYear || getAssessmentYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user.id, fy);

      if (gains.trades.length === 0) {
        return res.json({
          mode: 'ACTUAL',
          fiscalYear: fy,
          assessmentYear: assessYear,
          panNumber: panNumber || 'XXXPX0000X',
          message: 'No realized capital gains found for this fiscal year',
          generatedAt: new Date().toISOString(),
          sectionA1_EquitySTCG: { totalCapitalGain: 0, netTaxableGain: 0, transactions: [] },
          sectionA2_EquityLTCG: { totalCapitalGain: 0, netTaxableGain: 0, transactions: [] },
          sectionB_OtherSTCG: { totalCapitalGain: 0, netTaxableGain: 0, transactions: [] },
          sectionC_OtherLTCG: { totalCapitalGain: 0, netTaxableGain: 0, transactions: [] },
          summary: {
            totalRealizedGains: 0,
            totalSTCG: 0,
            totalLTCG: 0,
            totalTaxLiability: 0
          }
        });
      }

      const equitySTCG: any[] = [];
      const equityLTCG: any[] = [];
      const debtSTCG: any[] = [];
      const debtLTCG: any[] = [];

      for (const trade of gains.trades) {
        const entry = {
          orderId: trade.orderId,
          schemeName: trade.schemeName,
          isin: trade.isin,
          saleDate: trade.saleDate,
          gainType: trade.gainType,
          realizedGain: trade.realizedGain,
          taxableGain: trade.taxableGain,
          estimatedTax: trade.estimatedTax,
        };

        if (trade.gainType === 'STCG') {
          equitySTCG.push(entry);
        } else {
          equityLTCG.push(entry);
        }
      }

      const totalEquitySTCG = equitySTCG.reduce((sum, e) => sum + e.realizedGain, 0);
      const totalEquityLTCG = equityLTCG.reduce((sum, e) => sum + e.realizedGain, 0);

      res.json({
        mode: 'ACTUAL',
        fiscalYear: fy,
        assessmentYear: assessYear,
        panNumber: panNumber || 'XXXPX0000X',
        generatedAt: new Date().toISOString(),

        sectionA1_EquitySTCG: {
          description: 'Short Term Capital Gain on equity shares/units on which STT is paid',
          applicableSection: '111A',
          taxRate: '20%',
          transactions: equitySTCG,
          totalCapitalGain: totalEquitySTCG,
          netTaxableGain: Math.max(0, totalEquitySTCG)
        },

        sectionA2_EquityLTCG: {
          description: 'Long Term Capital Gain on equity shares/units on which STT is paid',
          applicableSection: '112A',
          taxRate: '12.5%',
          exemptionLimit: 125000,
          transactions: equityLTCG,
          totalCapitalGain: totalEquityLTCG,
          exemptionClaimed: Math.min(125000, Math.max(0, totalEquityLTCG)),
          netTaxableGain: Math.max(0, totalEquityLTCG - 125000)
        },

        sectionB_OtherSTCG: {
          description: 'Short Term Capital Gain on assets other than equity',
          transactions: debtSTCG,
          totalCapitalGain: 0,
          netTaxableGain: 0
        },

        sectionC_OtherLTCG: {
          description: 'Long Term Capital Gain on assets other than equity',
          transactions: debtLTCG,
          totalCapitalGain: 0,
          netTaxableGain: 0
        },

        summary: {
          totalRealizedGains: gains.totalRealizedGains,
          totalSTCG: gains.stcg.total,
          totalLTCG: gains.ltcg.total,
          totalTaxLiability: gains.totalTaxLiability,
          tradesCount: gains.trades.length
        },

        quarterlyBreakdown: gains.quarterlyBreakdown
      });
    } catch (error) {
      console.error("Error generating actual ITR export:", error);
      res.status(500).json({ error: "Failed to generate ITR export from realized gains" });
    }
  });

  app.post("/api/tax/regime-comparison", 
    requireAuth,
    requireRole('user', 'client', 'agent', 'admin'),
    taxApiRateLimiter,
    async (req: Request, res: Response) => {
    try {
      const validationResult = taxRegimeComparisonSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.error.issues
        });
      }

      const { salaryIncome, otherIncome, deductions80C, deductions80D, homeLoanInterest, fiscalYear } = validationResult.data;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user!.id, fy);

      const totalCapitalGains = gains.totalRealizedGains || 0;
      const stcg = gains.stcg?.total || 0;
      const ltcg = gains.ltcg?.total || 0;
      
      const totalNonCGIncome = salaryIncome + otherIncome;

      const oldRegimeTotalDeductions = deductions80C + deductions80D + homeLoanInterest + 50000;
      const oldRegimeTaxableNonCG = Math.max(0, totalNonCGIncome - oldRegimeTotalDeductions);
      
      let oldRegimeIncomeTax = 0;
      if (oldRegimeTaxableNonCG > 250000) {
        if (oldRegimeTaxableNonCG <= 500000) {
          oldRegimeIncomeTax = (oldRegimeTaxableNonCG - 250000) * 0.05;
        } else if (oldRegimeTaxableNonCG <= 1000000) {
          oldRegimeIncomeTax = 12500 + (oldRegimeTaxableNonCG - 500000) * 0.20;
        } else {
          oldRegimeIncomeTax = 112500 + (oldRegimeTaxableNonCG - 1000000) * 0.30;
        }
      }

      const newRegimeStandardDeduction = 75000;
      const newRegimeTaxableNonCG = Math.max(0, totalNonCGIncome - newRegimeStandardDeduction);
      
      let newRegimeIncomeTax = 0;
      if (newRegimeTaxableNonCG > 300000) {
        if (newRegimeTaxableNonCG <= 700000) {
          newRegimeIncomeTax = (newRegimeTaxableNonCG - 300000) * 0.05;
        } else if (newRegimeTaxableNonCG <= 1000000) {
          newRegimeIncomeTax = 20000 + (newRegimeTaxableNonCG - 700000) * 0.10;
        } else if (newRegimeTaxableNonCG <= 1200000) {
          newRegimeIncomeTax = 50000 + (newRegimeTaxableNonCG - 1000000) * 0.15;
        } else if (newRegimeTaxableNonCG <= 1500000) {
          newRegimeIncomeTax = 80000 + (newRegimeTaxableNonCG - 1200000) * 0.20;
        } else {
          newRegimeIncomeTax = 140000 + (newRegimeTaxableNonCG - 1500000) * 0.30;
        }
      }

      const stcgTax = Math.max(0, stcg) * 0.20;
      const ltcgExemption = 125000;
      const ltcgTaxable = Math.max(0, ltcg - ltcgExemption);
      const ltcgTax = ltcgTaxable * 0.125;
      const capitalGainsTax = stcgTax + ltcgTax;

      const oldRegimeTotalTax = oldRegimeIncomeTax + capitalGainsTax;
      const newRegimeTotalTax = newRegimeIncomeTax + capitalGainsTax;
      
      const oldRegimeCess = oldRegimeTotalTax * 0.04;
      const newRegimeCess = newRegimeTotalTax * 0.04;
      
      const oldRegimeFinalTax = oldRegimeTotalTax + oldRegimeCess;
      const newRegimeFinalTax = newRegimeTotalTax + newRegimeCess;

      const taxSavings = Math.abs(oldRegimeFinalTax - newRegimeFinalTax);
      const recommendedRegime = newRegimeFinalTax <= oldRegimeFinalTax ? 'new' : 'old';

      let recommendation = '';
      if (recommendedRegime === 'new') {
        recommendation = `The New Tax Regime saves you ₹${taxSavings.toLocaleString('en-IN')}. It's beneficial since your deductions (₹${(deductions80C + deductions80D + homeLoanInterest).toLocaleString('en-IN')}) are below the break-even threshold.`;
      } else {
        recommendation = `The Old Tax Regime saves you ₹${taxSavings.toLocaleString('en-IN')}. Your deductions (₹${(deductions80C + deductions80D + homeLoanInterest).toLocaleString('en-IN')}) make it more beneficial than the new regime.`;
      }

      console.log(`[TaxRegimeComparison] User ${req.user!.id}: Old=${oldRegimeFinalTax.toFixed(2)}, New=${newRegimeFinalTax.toFixed(2)}, Recommended=${recommendedRegime}`);

      res.json({
        fiscalYear: fy,
        comparison: {
          oldRegime: {
            taxableIncome: oldRegimeTaxableNonCG,
            incomeTax: oldRegimeIncomeTax,
            capitalGainsTax,
            cess: oldRegimeCess,
            totalTax: oldRegimeFinalTax,
            deductionsClaimed: oldRegimeTotalDeductions,
            breakdown: {
              section80C: deductions80C,
              section80D: deductions80D,
              homeLoanInterest,
              standardDeduction: 50000
            }
          },
          newRegime: {
            taxableIncome: newRegimeTaxableNonCG,
            incomeTax: newRegimeIncomeTax,
            capitalGainsTax,
            cess: newRegimeCess,
            totalTax: newRegimeFinalTax,
            deductionsClaimed: newRegimeStandardDeduction,
            breakdown: {
              standardDeduction: newRegimeStandardDeduction,
              note: 'No chapter VI-A deductions allowed under new regime'
            }
          }
        },
        capitalGainsBreakdown: {
          stcg: { amount: stcg, taxRate: '20%', tax: stcgTax },
          ltcg: { amount: ltcg, exemption: ltcgExemption, taxable: ltcgTaxable, taxRate: '12.5%', tax: ltcgTax },
          totalTax: capitalGainsTax
        },
        recommendation: {
          regime: recommendedRegime,
          savings: taxSavings,
          explanation: recommendation
        }
      });
    } catch (error) {
      console.error("Error in tax regime comparison:", error);
      res.status(500).json({ error: "Failed to compare tax regimes" });
    }
  });

  app.post("/api/itr/auto-populate",
    requireAuth,
    requireRole('user', 'client', 'agent', 'admin'),
    taxApiRateLimiter,
    async (req: Request, res: Response) => {
    try {
      const validationResult = itrAutoPopulateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.error.issues
        });
      }

      const { panNumber, assessmentYear, fiscalYear } = validationResult.data;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user!.id, fy);

      const stcgEquity = gains.stcg?.equity || 0;
      const ltcgEquity = gains.ltcg?.equity || 0;
      const ltcgGrandfathered = gains.ltcg?.equityWithGrandfathering || 0;

      const scheduleCGData = {
        panNumber,
        assessmentYear,
        fiscalYear: fy,
        generatedAt: new Date().toISOString(),
        
        shortTermCapitalGains111A: {
          section: '111A',
          description: 'STCG on sale of listed equity shares/units of equity oriented MF where STT paid',
          fullValueOfConsideration: gains.trades
            .filter(t => t.gainType === 'STCG')
            .reduce((sum, t) => sum + (t.taxableGain + (t.realizedGain - t.taxableGain)), 0),
          costOfAcquisition: gains.trades
            .filter(t => t.gainType === 'STCG')
            .reduce((sum, t) => sum + (t.realizedGain - t.taxableGain), 0),
          capitalGain: stcgEquity,
          taxRate: 20
        },
        
        longTermCapitalGains112A: {
          section: '112A',
          description: 'LTCG on sale of listed equity shares/units of equity oriented MF where STT paid',
          fullValueOfConsideration: gains.trades
            .filter(t => t.gainType === 'LTCG')
            .reduce((sum, t) => sum + (t.taxableGain + (t.realizedGain - t.taxableGain)), 0),
          costOfAcquisition: gains.trades
            .filter(t => t.gainType === 'LTCG')
            .reduce((sum, t) => sum + (t.realizedGain - t.taxableGain), 0),
          capitalGain: ltcgEquity + ltcgGrandfathered,
          grandfatheringBenefitApplied: ltcgGrandfathered > 0,
          exemptionUnder112A: Math.min(125000, Math.max(0, ltcgEquity + ltcgGrandfathered)),
          netTaxableGain: Math.max(0, ltcgEquity + ltcgGrandfathered - 125000),
          taxRate: 12.5
        },
        
        summary: {
          totalSTCG: stcgEquity,
          totalLTCG: ltcgEquity + ltcgGrandfathered,
          ltcgExemption: Math.min(125000, Math.max(0, ltcgEquity + ltcgGrandfathered)),
          netTaxableLTCG: Math.max(0, ltcgEquity + ltcgGrandfathered - 125000),
          estimatedTax: gains.totalTaxLiability,
          tradesCount: gains.trades.length
        },

        itrForm: sandboxITRService.getSuitableITRForm({
          salaryIncome: 0,
          businessIncome: 0,
          capitalGains: stcgEquity + ltcgEquity + ltcgGrandfathered,
          otherIncome: 0,
          interestIncome: 0,
          rentalIncome: 0,
          dividendIncome: 0
        }, 'individual'),

        trades: gains.trades.map(t => ({
          orderId: t.orderId,
          schemeName: t.schemeName,
          isin: t.isin,
          saleDate: t.saleDate,
          gainType: t.gainType,
          realizedGain: t.realizedGain,
          taxableGain: t.taxableGain
        }))
      };

      console.log(`[ITRAutoPopulate] Generated Schedule CG for PAN ${panNumber}, AY ${assessmentYear}, ${gains.trades.length} trades`);

      res.json({
        success: true,
        data: scheduleCGData
      });
    } catch (error) {
      console.error("Error in ITR auto-populate:", error);
      res.status(500).json({ error: "Failed to auto-populate ITR data" });
    }
  });

  app.post("/api/tax/pnl-report",
    requireAuth,
    requireRole('user', 'client', 'agent', 'admin'),
    taxApiRateLimiter,
    async (req: Request, res: Response) => {
    try {
      const { fiscalYear, format = 'json' } = req.body;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user!.id, fy);

      const pnlReport = {
        reportType: 'Tax P&L Statement',
        fiscalYear: fy,
        generatedAt: new Date().toISOString(),
        generatedFor: req.user!.id,

        summary: {
          totalRealizedGains: gains.totalRealizedGains,
          shortTermGains: gains.stcg.total,
          longTermGains: gains.ltcg.total,
          totalTaxLiability: gains.totalTaxLiability,
          numberOfTrades: gains.trades.length
        },

        shortTermCapitalGains: {
          equity: gains.stcg.equity,
          debt: gains.stcg.debtPreApr2023 + gains.stcg.debtPostApr2023,
          others: gains.stcg.others,
          total: gains.stcg.total,
          taxRate: '20%',
          taxAmount: Math.max(0, gains.stcg.total) * 0.20
        },

        longTermCapitalGains: {
          equity: gains.ltcg.equity,
          equityWithGrandfathering: gains.ltcg.equityWithGrandfathering,
          debtWithIndexation: gains.ltcg.debtWithIndexation,
          debtWithoutIndexation: gains.ltcg.debtWithoutIndexation,
          others: gains.ltcg.others,
          total: gains.ltcg.total,
          exemption: Math.min(125000, Math.max(0, gains.ltcg.total)),
          taxableAmount: Math.max(0, gains.ltcg.total - 125000),
          taxRate: '12.5%',
          taxAmount: Math.max(0, gains.ltcg.total - 125000) * 0.125
        },

        transactionDetails: gains.trades.map(trade => ({
          orderId: trade.orderId,
          security: trade.schemeName,
          isin: trade.isin,
          saleDate: trade.saleDate,
          holdingPeriod: trade.gainType === 'LTCG' ? 'Long Term (>365 days)' : 'Short Term (<=365 days)',
          realizedGain: trade.realizedGain,
          taxableGain: trade.taxableGain,
          estimatedTax: trade.estimatedTax
        })),

        quarterlyAdvanceTax: gains.quarterlyBreakdown,

        disclaimer: 'This report is for informational purposes. Please verify all calculations with a qualified tax professional before filing.'
      };

      console.log(`[TaxPnLReport] Generated for user ${req.user!.id}, FY ${fy}, format: ${format}`);

      res.json({
        success: true,
        format,
        data: pnlReport
      });
    } catch (error) {
      console.error("Error generating Tax P&L report:", error);
      res.status(500).json({ error: "Failed to generate Tax P&L report" });
    }
  });

  app.post("/api/advance-tax/validate",
    requireAuth,
    requireRole('user', 'client', 'agent', 'admin'),
    taxApiRateLimiter,
    async (req: Request, res: Response) => {
    try {
      const { fiscalYear } = req.body;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user!.id, fy);
      const advanceTaxStatus = await realizedGainsAggregationService.getAdvanceTaxStatus(req.user!.id, fy);

      const fintekProCalculation = {
        stcg: gains.stcg.total,
        ltcg: gains.ltcg.total,
        ltcgExemption: Math.min(125000, Math.max(0, gains.ltcg.total)),
        totalTaxLiability: gains.totalTaxLiability,
        quarters: advanceTaxStatus.quarters
      };

      const stcgTax = Math.max(0, gains.stcg.total) * 0.20;
      const ltcgTaxable = Math.max(0, gains.ltcg.total - 125000);
      const ltcgTax = ltcgTaxable * 0.125;
      const expectedTotal = stcgTax + ltcgTax;

      const discrepancy = Math.abs(gains.totalTaxLiability - expectedTotal);
      const isConsistent = discrepancy < 1;

      const validationResult = {
        fiscalYear: fy,
        fintekProCalculation,
        
        crossCheck: {
          expectedTotalTax: expectedTotal,
          calculatedTotalTax: gains.totalTaxLiability,
          discrepancy,
          isConsistent,
          validatedAt: new Date().toISOString()
        },

        advanceTaxSchedule: {
          q1: { dueDate: `${fy.split('-')[0]}-06-15`, percentage: 15, status: advanceTaxStatus.quarters[0]?.status },
          q2: { dueDate: `${fy.split('-')[0]}-09-15`, percentage: 45, status: advanceTaxStatus.quarters[1]?.status },
          q3: { dueDate: `${fy.split('-')[0]}-12-15`, percentage: 75, status: advanceTaxStatus.quarters[2]?.status },
          q4: { dueDate: `${parseInt(fy.split('-')[0]) + 1}-03-15`, percentage: 100, status: advanceTaxStatus.quarters[3]?.status }
        },

        warnings: !isConsistent ? [
          `Calculation discrepancy of ₹${discrepancy.toFixed(2)} detected. Please review transaction data.`
        ] : []
      };

      if (!isConsistent) {
        console.warn(`[AdvanceTaxValidation] Discrepancy for user ${req.user!.id}: Expected ${expectedTotal.toFixed(2)}, Got ${gains.totalTaxLiability.toFixed(2)}`);
      }

      res.json({
        success: true,
        validation: validationResult
      });
    } catch (error) {
      console.error("Error validating advance tax:", error);
      res.status(500).json({ error: "Failed to validate advance tax calculations" });
    }
  });

  /**
   * FIX SPEC SECTION 4.4 & 5.3: Lot Validation Endpoint
   * Validates lots before allowing tax/exit load calculations
   * HARD BLOCKER: Returns capitalGainsEnabled=false if dates are missing
   */
  app.post("/api/capital-gains/validate-lots", requireAuth, async (req: Request, res: Response) => {
    try {
      const { lots } = req.body;
      
      if (!lots || !Array.isArray(lots)) {
        return res.json({
          success: true,
          validation: {
            isValid: false,
            capitalGainsEnabled: false,
            exitLoadEnabled: false,
            validationErrors: ['No lots provided'],
            disabledReason: 'Transaction lots are required for tax calculations'
          }
        });
      }

      const validation = capitalGainsCalculator.validateLotsForTax(lots);
      
      res.json({
        success: true,
        validation,
        complianceNote: "Capital gains and exit load calculations are based on transaction-level data from the client's CAS statement and FIFO methodology, as per Indian tax regulations."
      });
    } catch (error) {
      console.error("Error validating lots:", error);
      res.status(500).json({ error: "Failed to validate lots" });
    }
  });

  /**
   * FIX SPEC SECTION 4.2: Tax Calculation Validation (DSP Healthcare Test)
   * Returns LTCG/STCG units breakdown for validation
   * 
   * DSP Healthcare Example (Fix Spec Section 4.2):
   * - Lot 1: 07-Oct-2024, 4974.876 units
   * - Lot 2: 29-Oct-2024, 4966.475 units
   * - If saleDate = 2025-10-20: Lot 1 = LTCG (378 days), Lot 2 = STCG (356 days) = Mixed
   */
  app.post("/api/capital-gains/calculate-tax-breakdown", requireAuth, async (req: Request, res: Response) => {
    try {
      const { lots, saleDate } = req.body;
      
      // First validate lots (hard blocker per Section 4.4)
      const validation = capitalGainsCalculator.validateLotsForTax(lots || []);
      if (!validation.isValid) {
        return res.json({
          success: false,
          error: validation.disabledReason,
          capitalGainsEnabled: false,
          validation
        });
      }

      // Pass saleDate for accurate STCG/LTCG calculation at redemption time
      const taxBreakdown = capitalGainsCalculator.validateTaxCalculation(lots, saleDate);
      
      res.json({
        success: true,
        taxBreakdown,
        summary: {
          totalLots: lots.length,
          ltcgUnits: taxBreakdown.ltcgUnits,
          stcgUnits: taxBreakdown.stcgUnits,
          taxStatus: taxBreakdown.ltcgUnits > 0 && taxBreakdown.stcgUnits > 0 ? 'Mixed' :
                    taxBreakdown.ltcgUnits > 0 ? 'All LTCG' : 'All STCG',
          referenceDate: taxBreakdown.referenceDate
        },
        complianceNote: "FIFO lot-wise calculation per Indian equity mutual fund tax regulations."
      });
    } catch (error) {
      console.error("Error calculating tax breakdown:", error);
      res.status(500).json({ error: "Failed to calculate tax breakdown" });
    }
  });

  /**
   * FIX SPEC SECTION 5.2: FIFO Partial Redemption Simulation
   * Simulates which lots are consumed when redeeming a specific amount
   */
  app.post("/api/capital-gains/simulate-redemption", requireAuth, async (req: Request, res: Response) => {
    try {
      const { lots, redemptionAmount, currentNav } = req.body;
      
      if (!lots || !Array.isArray(lots) || lots.length === 0) {
        return res.json({
          success: false,
          error: 'Transaction lots are required for redemption simulation',
          exitLoadEnabled: false
        });
      }

      if (!redemptionAmount || !currentNav) {
        return res.status(400).json({ 
          error: 'redemptionAmount and currentNav are required' 
        });
      }

      // Validate lots first
      const validation = capitalGainsCalculator.validateLotsForTax(lots);
      if (!validation.isValid) {
        return res.json({
          success: false,
          error: validation.disabledReason,
          exitLoadEnabled: false,
          validation
        });
      }

      const simulation = capitalGainsCalculator.simulateFIFORedemption(
        lots, 
        parseFloat(redemptionAmount), 
        parseFloat(currentNav)
      );
      
      res.json({
        success: true,
        simulation,
        summary: {
          unitsToRedeem: simulation.unitsToRedeem.toFixed(3),
          lotsConsumed: simulation.consumedLots.length,
          totalExitLoad: simulation.totalExitLoad.toFixed(2),
          ltcgAmount: simulation.ltcgAmount.toFixed(2),
          stcgAmount: simulation.stcgAmount.toFixed(2),
          lotsWithExitLoad: simulation.consumedLots.filter(l => l.hasExitLoad).length
        },
        complianceNote: "FIFO methodology applied. Exit load calculated per lot based on holding period."
      });
    } catch (error) {
      console.error("Error simulating redemption:", error);
      res.status(500).json({ error: "Failed to simulate redemption" });
    }
  });

  console.log("✅ Capital Gains routes registered");
}
