/**
 * Stamp Duty Service
 * 
 * Implements regulatory-compliant stamp duty calculation for securities transactions
 * as per Indian Stamp Act 1899 (amended by Finance Act 2019, effective July 1, 2020)
 * 
 * Rates:
 * - Unlisted Shares (off-market transfer): 0.015% (1.5 bps) - paid by seller
 * - Corporate Bonds/NCDs (transfer): 0.0001% (0.01 bps) - paid by transferor
 * - Debentures (new issue): 0.005% (0.5 bps) - paid by allottee
 * - G-Secs: EXEMPT
 * - SGBs: EXEMPT
 */

import { db } from "./db";
import { stampDutyConfig, stampDutyAuditLog, type StampDutyConfig, type InsertStampDutyAuditLog } from "@shared/schema";
import { eq, and, isNull, lte, or, gte } from "drizzle-orm";

// Regulatory stamp duty rates (in basis points)
export const STAMP_DUTY_RATES = {
  unlisted_shares: {
    rate: 1.5, // 0.015%
    payerSide: 'seller' as const,
    isExempt: false,
    regulatorReference: 'Indian Stamp Act 1899, Schedule IA, Article 56A',
    statuteSection: 'Article 56A - Transfer of shares in companies other than through Stock Exchange',
  },
  corporate_bond: {
    rate: 0.01, // 0.0001%
    payerSide: 'transferor' as const,
    isExempt: false,
    regulatorReference: 'Indian Stamp Act 1899, Schedule IA, Article 27',
    statuteSection: 'Article 27 - Transfer of debentures',
  },
  ncd: {
    rate: 0.01, // 0.0001%
    payerSide: 'transferor' as const,
    isExempt: false,
    regulatorReference: 'Indian Stamp Act 1899, Schedule IA, Article 27',
    statuteSection: 'Article 27 - Transfer of debentures (NCDs)',
  },
  tax_free_bond: {
    rate: 0.01, // 0.0001%
    payerSide: 'transferor' as const,
    isExempt: false,
    regulatorReference: 'Indian Stamp Act 1899, Schedule IA, Article 27',
    statuteSection: 'Article 27 - Transfer of debentures (Tax-Free Bonds)',
  },
  infrastructure_bond: {
    rate: 0.01, // 0.0001%
    payerSide: 'transferor' as const,
    isExempt: false,
    regulatorReference: 'Indian Stamp Act 1899, Schedule IA, Article 27',
    statuteSection: 'Article 27 - Transfer of debentures (Infrastructure Bonds)',
  },
  g_sec: {
    rate: 0,
    payerSide: 'buyer' as const,
    isExempt: true,
    exemptionReason: 'Government Securities exempt under Section 9 of Indian Stamp Act',
    regulatorReference: 'Indian Stamp Act 1899, Section 9',
    statuteSection: 'Section 9 - Exemption of instruments relating to Government Securities',
  },
  t_bill: {
    rate: 0,
    payerSide: 'buyer' as const,
    isExempt: true,
    exemptionReason: 'Treasury Bills exempt as Government Securities under Section 9',
    regulatorReference: 'Indian Stamp Act 1899, Section 9',
    statuteSection: 'Section 9 - Exemption of instruments relating to Government Securities',
  },
  sdl: {
    rate: 0,
    payerSide: 'buyer' as const,
    isExempt: true,
    exemptionReason: 'State Development Loans exempt as Government Securities under Section 9',
    regulatorReference: 'Indian Stamp Act 1899, Section 9',
    statuteSection: 'Section 9 - Exemption of instruments relating to Government Securities',
  },
  sgb: {
    rate: 0,
    payerSide: 'buyer' as const,
    isExempt: true,
    exemptionReason: 'Sovereign Gold Bonds exempt as Government Securities issued by RBI',
    regulatorReference: 'Indian Stamp Act 1899, Section 9',
    statuteSection: 'Section 9 - Exemption of instruments relating to Government Securities',
  },
  debenture_issue: {
    rate: 0.5, // 0.005%
    payerSide: 'buyer' as const, // allottee
    isExempt: false,
    regulatorReference: 'Indian Stamp Act 1899, Schedule IA, Article 27',
    statuteSection: 'Article 27 - Issue of debentures',
  },
} as const;

export type ProductType = keyof typeof STAMP_DUTY_RATES;

export interface StampDutyCalculation {
  transactionAmount: number;
  stampDutyRate: number; // In basis points
  stampDutyAmount: number;
  isExempt: boolean;
  exemptionReason?: string;
  payerSide: 'buyer' | 'seller' | 'transferor';
  regulatorReference: string;
  statuteSection: string;
  effectiveDate: string;
}

export interface StampDutyBreakdown {
  principal: number;
  stampDuty: number;
  stampDutyRate: string;
  isExempt: boolean;
  exemptionReason?: string;
  payerSide: string;
  regulatorReference: string;
  total: number;
}

class StampDutyService {
  private configCache: Map<string, StampDutyConfig> = new Map();
  private lastCacheRefresh: Date = new Date(0);
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Calculate stamp duty for a transaction
   */
  calculateStampDuty(
    productType: ProductType,
    transactionAmount: number,
    transactionType: 'purchase' | 'sale' | 'transfer' | 'issue' = 'purchase'
  ): StampDutyCalculation {
    const config = STAMP_DUTY_RATES[productType];
    
    if (!config) {
      throw new Error(`Unknown product type: ${productType}`);
    }

    // For issues (primary market), use issue rate if available
    const effectiveRate = transactionType === 'issue' && productType === 'debenture_issue' 
      ? STAMP_DUTY_RATES.debenture_issue.rate 
      : config.rate;

    const stampDutyAmount = config.isExempt 
      ? 0 
      : Math.round((transactionAmount * effectiveRate / 10000) * 100) / 100; // Round to 2 decimals

    return {
      transactionAmount,
      stampDutyRate: effectiveRate,
      stampDutyAmount,
      isExempt: config.isExempt,
      exemptionReason: config.isExempt ? (config as any).exemptionReason : undefined,
      payerSide: config.payerSide,
      regulatorReference: config.regulatorReference,
      statuteSection: config.statuteSection,
      effectiveDate: '2020-07-01', // Indian Stamp Act amendment effective date
    };
  }

  /**
   * Get stamp duty breakdown for display in order dialogs
   */
  getStampDutyBreakdown(
    productType: ProductType,
    transactionAmount: number
  ): StampDutyBreakdown {
    const calc = this.calculateStampDuty(productType, transactionAmount);
    
    return {
      principal: transactionAmount,
      stampDuty: calc.stampDutyAmount,
      stampDutyRate: calc.isExempt ? 'Exempt' : `${calc.stampDutyRate} bps (${(calc.stampDutyRate / 100).toFixed(4)}%)`,
      isExempt: calc.isExempt,
      exemptionReason: calc.exemptionReason,
      payerSide: calc.payerSide,
      regulatorReference: calc.regulatorReference,
      total: transactionAmount + calc.stampDutyAmount,
    };
  }

  /**
   * Get stamp duty config from database (with cache)
   */
  async getConfigFromDb(productType: string): Promise<StampDutyConfig | null> {
    // Check cache first
    const now = new Date();
    if (now.getTime() - this.lastCacheRefresh.getTime() > this.CACHE_TTL_MS) {
      this.configCache.clear();
      this.lastCacheRefresh = now;
    }

    if (this.configCache.has(productType)) {
      return this.configCache.get(productType)!;
    }

    try {
      const config = await db
        .select()
        .from(stampDutyConfig)
        .where(
          and(
            eq(stampDutyConfig.productType, productType),
            eq(stampDutyConfig.isActive, true),
            lte(stampDutyConfig.effectiveFrom, new Date().toISOString().split('T')[0]),
            or(
              isNull(stampDutyConfig.effectiveTo),
              gte(stampDutyConfig.effectiveTo, new Date().toISOString().split('T')[0])
            )
          )
        )
        .limit(1);

      if (config.length > 0) {
        this.configCache.set(productType, config[0]);
        return config[0];
      }
    } catch (error) {
      console.warn('[StampDutyService] Database query failed, using static rates:', error);
    }

    return null;
  }

  /**
   * Log stamp duty calculation for audit trail (7-year retention)
   */
  async logAudit(
    transactionId: string,
    transactionType: 'bond_order' | 'unlisted_deal',
    productType: string,
    isin: string | null,
    productName: string,
    transactionAmount: number,
    calculation: StampDutyCalculation,
    payerUserId: string,
    payerState?: string
  ): Promise<void> {
    try {
      // Calculate 7-year retention expiry
      const retentionExpiry = new Date();
      retentionExpiry.setFullYear(retentionExpiry.getFullYear() + 7);

      const auditEntry: InsertStampDutyAuditLog = {
        transactionId,
        transactionType,
        productType,
        isin,
        productName,
        transactionAmount: transactionAmount.toString(),
        stampDutyRate: calculation.stampDutyRate.toString(),
        stampDutyAmount: calculation.stampDutyAmount.toString(),
        isExempt: calculation.isExempt,
        exemptionReason: calculation.exemptionReason,
        payerUserId,
        payerSide: calculation.payerSide,
        payerState,
        regulatorReference: calculation.regulatorReference,
        statuteSection: calculation.statuteSection,
        effectiveRateDate: calculation.effectiveDate,
        collectionStatus: 'collected',
        retentionExpiresAt: retentionExpiry,
      };

      await db.insert(stampDutyAuditLog).values(auditEntry);
      
      console.log(`[StampDutyService] Audit logged for ${transactionType} ${transactionId}: ₹${calculation.stampDutyAmount}`);
    } catch (error) {
      console.error('[StampDutyService] Failed to log audit:', error);
      // Don't throw - audit failure shouldn't block transaction
    }
  }

  /**
   * Get all stamp duty rates for admin/display
   */
  getAllRates(): Record<string, any> {
    return Object.entries(STAMP_DUTY_RATES).map(([key, value]) => ({
      productType: key,
      ...value,
      ratePercent: `${(value.rate / 100).toFixed(4)}%`,
      effectiveFrom: '2020-07-01',
    }));
  }

  /**
   * Check if a product type is exempt from stamp duty
   */
  isExempt(productType: ProductType): boolean {
    return STAMP_DUTY_RATES[productType]?.isExempt ?? false;
  }

  /**
   * Get payer side for a product type
   */
  getPayerSide(productType: ProductType): 'buyer' | 'seller' | 'transferor' {
    return STAMP_DUTY_RATES[productType]?.payerSide ?? 'buyer';
  }

  /**
   * Seed stamp duty configuration to database
   */
  async seedConfiguration(): Promise<void> {
    try {
      const entries = Object.entries(STAMP_DUTY_RATES);
      
      for (const [productType, config] of entries) {
        const existing = await db
          .select()
          .from(stampDutyConfig)
          .where(eq(stampDutyConfig.productType, productType))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(stampDutyConfig).values({
            productType,
            productTypeLabel: productType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            stampDutyBps: config.rate.toString(),
            isExempt: config.isExempt,
            exemptionReason: (config as any).exemptionReason || null,
            payerSide: config.payerSide,
            applicableTransactionTypes: ['purchase', 'sale', 'transfer'],
            regulatorReference: config.regulatorReference,
            statuteSection: config.statuteSection,
            effectiveFrom: '2020-07-01',
            collectingAgent: 'platform',
            remittanceFrequency: 'monthly',
            isActive: true,
          });
          console.log(`[StampDutyService] Seeded config for ${productType}`);
        }
      }
      
      console.log('[StampDutyService] Configuration seeding complete');
    } catch (error) {
      console.warn('[StampDutyService] Failed to seed configuration:', error);
    }
  }
}

export const stampDutyService = new StampDutyService();
