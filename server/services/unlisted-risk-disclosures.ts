export interface RiskDisclosure {
  id: string;
  category: 'general' | 'liquidity' | 'regulatory' | 'operational' | 'market' | 'information' | 'valuation' | 'fraud';
  title: string;
  description: string;
  mandatory: boolean;
}

export interface RiskDisclosureAcknowledgment {
  userId: string;
  companyId: string;
  tradeType: 'buy' | 'sell';
  acknowledgedAt: Date;
  ipAddress: string;
  userAgent: string;
  disclosureVersion: string;
}

export const SEBI_RISK_DISCLOSURES: RiskDisclosure[] = [
  {
    id: 'general-1',
    category: 'general',
    title: 'Unlisted Securities Are High-Risk Investments',
    description: 'Unlisted securities are not traded on recognized stock exchanges and carry significantly higher risk than listed securities. You may lose part or all of your investment.',
    mandatory: true,
  },
  {
    id: 'liquidity-1',
    category: 'liquidity',
    title: 'Limited Liquidity',
    description: 'Unlike listed securities, there is no established market for unlisted shares. You may not be able to sell your shares when you want to, or at the price you expect. Finding a buyer may take considerable time.',
    mandatory: true,
  },
  {
    id: 'liquidity-2',
    category: 'liquidity',
    title: 'No Price Discovery Mechanism',
    description: 'There is no transparent price discovery mechanism for unlisted securities. The prices quoted may not reflect the true value of the shares and can vary significantly between transactions.',
    mandatory: true,
  },
  {
    id: 'regulatory-1',
    category: 'regulatory',
    title: 'Limited Regulatory Protection',
    description: 'Unlisted securities are not subject to the same level of regulatory scrutiny and investor protection as listed securities. SEBI regulations for listed companies may not apply.',
    mandatory: true,
  },
  {
    id: 'regulatory-2',
    category: 'regulatory',
    title: 'Disclosure Requirements',
    description: 'Unlisted companies are not required to make the same disclosures as listed companies. Financial information may be limited, outdated, or not independently verified.',
    mandatory: true,
  },
  {
    id: 'information-1',
    category: 'information',
    title: 'Information Asymmetry',
    description: 'There may be significant information asymmetry between buyers and sellers. Company insiders may possess material non-public information that affects the value of shares.',
    mandatory: true,
  },
  {
    id: 'information-2',
    category: 'information',
    title: 'Unaudited Financial Data',
    description: 'Financial data provided for unlisted companies may not be audited or verified. The accuracy and completeness of financial information cannot be guaranteed.',
    mandatory: true,
  },
  {
    id: 'market-1',
    category: 'market',
    title: 'Price Volatility',
    description: 'The value of unlisted shares can be highly volatile and may fluctuate significantly based on company performance, market conditions, or speculative trading.',
    mandatory: true,
  },
  {
    id: 'market-2',
    category: 'market',
    title: 'IPO Uncertainty',
    description: 'Companies may or may not pursue an IPO. Even if announced, IPO timelines are uncertain and may be delayed or cancelled. Pre-IPO share prices may not correlate with eventual listing prices.',
    mandatory: true,
  },
  {
    id: 'operational-1',
    category: 'operational',
    title: 'Transfer and Settlement Risks',
    description: 'Transfer of unlisted shares involves procedural risks including delayed transfers, documentation issues, and potential disputes over ownership.',
    mandatory: true,
  },
  {
    id: 'operational-2',
    category: 'operational',
    title: 'Counterparty Risk',
    description: 'In over-the-counter transactions, there is counterparty risk where the other party may fail to fulfill their obligations.',
    mandatory: true,
  },
  {
    id: 'operational-3',
    category: 'operational',
    title: 'Tax Implications',
    description: 'Transactions in unlisted securities may have different tax implications than listed securities. Consult your tax advisor for specific guidance.',
    mandatory: false,
  },
  {
    id: 'valuation-1',
    category: 'valuation',
    title: 'Valuation Uncertainty',
    description: 'Unlisted securities lack standard market-based valuation. Prices are based on internal valuations, comparable transactions, or negotiations. Actual value may differ significantly from quoted prices.',
    mandatory: true,
  },
  {
    id: 'valuation-2',
    category: 'valuation',
    title: 'No Independent Valuation',
    description: 'Unlike listed securities, there is no independent third-party valuation mechanism. Valuations may be influenced by interested parties and may not reflect fair market value.',
    mandatory: true,
  },
  {
    id: 'fraud-1',
    category: 'fraud',
    title: 'Fraud and Misrepresentation Risks',
    description: 'The unlisted securities market is susceptible to fraudulent schemes, including pump-and-dump schemes, fake company documents, and misrepresentation of financial data. Exercise extreme caution.',
    mandatory: true,
  },
  {
    id: 'fraud-2',
    category: 'fraud',
    title: 'Verification Limitations',
    description: 'Verification of company information, share certificates, and seller identity may be limited. FintekPro performs due diligence but cannot guarantee the authenticity of all information.',
    mandatory: true,
  },
];

export const DISCLOSURE_VERSION = '2024-01';

export class UnlistedRiskDisclosureService {
  getDisclosures(): RiskDisclosure[] {
    return SEBI_RISK_DISCLOSURES;
  }

  getMandatoryDisclosures(): RiskDisclosure[] {
    return SEBI_RISK_DISCLOSURES.filter(d => d.mandatory);
  }

  getDisclosuresByCategory(category: RiskDisclosure['category']): RiskDisclosure[] {
    return SEBI_RISK_DISCLOSURES.filter(d => d.category === category);
  }

  getDisclosureVersion(): string {
    return DISCLOSURE_VERSION;
  }

  validateAcknowledgment(acknowledgmentData: {
    acknowledgedDisclosureIds: string[];
    userId: string;
    companyId: string;
    tradeType: 'buy' | 'sell';
  }): { valid: boolean; missingDisclosures: string[] } {
    const mandatoryIds = this.getMandatoryDisclosures().map(d => d.id);
    const missingDisclosures = mandatoryIds.filter(
      id => !acknowledgmentData.acknowledgedDisclosureIds.includes(id)
    );

    return {
      valid: missingDisclosures.length === 0,
      missingDisclosures,
    };
  }

  getAcknowledgmentText(): string {
    return `I acknowledge that I have read and understood all the risk disclosures above regarding trading in unlisted securities. I understand that:

1. Unlisted securities are high-risk investments with limited liquidity
2. I may lose part or all of my investment
3. There is no guarantee of returns or ability to sell my shares
4. The information provided may be limited or unverified
5. I am making this investment decision based on my own judgment and risk assessment
6. I meet the eligibility criteria for trading in unlisted securities

I confirm that I am making this trade voluntarily and understand all associated risks.`;
  }

  getCompanySpecificRisks(companyData: {
    netWorth?: number;
    debtEquityRatio?: number;
    profitMargin?: number;
    riskScore?: number;
  }): string[] {
    const risks: string[] = [];

    if (companyData.netWorth !== undefined && companyData.netWorth < 0) {
      risks.push('⚠️ This company has negative net worth, indicating financial distress.');
    }

    if (companyData.debtEquityRatio !== undefined && companyData.debtEquityRatio > 2) {
      risks.push('⚠️ This company has high leverage (Debt/Equity > 2x), increasing financial risk.');
    }

    if (companyData.profitMargin !== undefined && companyData.profitMargin < 0) {
      risks.push('⚠️ This company is currently operating at a loss.');
    }

    if (companyData.riskScore !== undefined && companyData.riskScore > 70) {
      risks.push('⚠️ This company has been flagged as high-risk based on our compliance assessment.');
    }

    return risks;
  }

  formatDisclosuresForDisplay(): {
    categories: {
      category: RiskDisclosure['category'];
      title: string;
      disclosures: RiskDisclosure[];
    }[];
    acknowledgmentText: string;
    version: string;
  } {
    const categoryTitles: Record<RiskDisclosure['category'], string> = {
      general: 'General Investment Risks',
      liquidity: 'Liquidity Risks',
      regulatory: 'Regulatory Risks',
      operational: 'Operational Risks',
      market: 'Market Risks',
      information: 'Information Risks',
      valuation: 'Valuation Risks',
      fraud: 'Fraud and Verification Risks',
    };

    const categories = Object.keys(categoryTitles).map(cat => ({
      category: cat as RiskDisclosure['category'],
      title: categoryTitles[cat as RiskDisclosure['category']],
      disclosures: this.getDisclosuresByCategory(cat as RiskDisclosure['category']),
    })).filter(c => c.disclosures.length > 0);

    return {
      categories,
      acknowledgmentText: this.getAcknowledgmentText(),
      version: this.getDisclosureVersion(),
    };
  }
}

export const unlistedRiskDisclosureService = new UnlistedRiskDisclosureService();

// Middleware for risk disclosure enforcement
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { unlistedRiskDisclosureAcknowledgments } from '../../shared/schema';
import { eq, and, gte } from 'drizzle-orm';

export interface RiskDisclosureRequest extends Request {
  riskDisclosureAcknowledged?: boolean;
  riskDisclosureRecord?: any;
}

/**
 * Check if user has valid risk disclosure acknowledgment for a company
 */
export async function hasValidRiskAcknowledgment(
  userId: string,
  companyId: string,
  tradeType: 'buy' | 'sell'
): Promise<{ valid: boolean; record?: any; reason?: string }> {
  const currentVersion = DISCLOSURE_VERSION;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [record] = await db
    .select()
    .from(unlistedRiskDisclosureAcknowledgments)
    .where(and(
      eq(unlistedRiskDisclosureAcknowledgments.userId, userId),
      eq(unlistedRiskDisclosureAcknowledgments.companyId, companyId),
      eq(unlistedRiskDisclosureAcknowledgments.tradeType, tradeType),
      eq(unlistedRiskDisclosureAcknowledgments.disclosureVersion, currentVersion),
      eq(unlistedRiskDisclosureAcknowledgments.allMandatoryAcknowledged, true),
      gte(unlistedRiskDisclosureAcknowledgments.acknowledgedAt, twentyFourHoursAgo)
    ))
    .limit(1);

  if (!record) {
    return { valid: false, reason: 'No valid risk disclosure acknowledgment found for this company' };
  }

  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return { valid: false, reason: 'Risk disclosure acknowledgment has expired', record };
  }

  return { valid: true, record };
}

/**
 * Save risk disclosure acknowledgment
 */
export async function saveRiskAcknowledgment(data: {
  userId: string;
  companyId: string;
  tradeType: 'buy' | 'sell';
  tradeEntityId?: string;
  tradeEntityType?: string;
  acknowledgedDisclosureIds: string[];
  companySpecificRisksAcknowledged?: string[];
  acknowledgmentStatement?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; record?: any; error?: string }> {
  const mandatoryIds = unlistedRiskDisclosureService.getMandatoryDisclosures().map(d => d.id);
  const allMandatoryAcknowledged = mandatoryIds.every(id => data.acknowledgedDisclosureIds.includes(id));

  if (!allMandatoryAcknowledged) {
    const missing = mandatoryIds.filter(id => !data.acknowledgedDisclosureIds.includes(id));
    return { 
      success: false, 
      error: `Missing mandatory disclosures: ${missing.join(', ')}` 
    };
  }

  const [record] = await db
    .insert(unlistedRiskDisclosureAcknowledgments)
    .values({
      userId: data.userId,
      companyId: data.companyId,
      tradeType: data.tradeType,
      tradeEntityId: data.tradeEntityId,
      tradeEntityType: data.tradeEntityType,
      disclosureVersion: DISCLOSURE_VERSION,
      acknowledgedDisclosureIds: data.acknowledgedDisclosureIds,
      allMandatoryAcknowledged: true,
      companySpecificRisksAcknowledged: data.companySpecificRisksAcknowledged || [],
      acknowledgmentStatement: data.acknowledgmentStatement || unlistedRiskDisclosureService.getAcknowledgmentText(),
      acknowledgedFullText: true,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    })
    .returning();

  return { success: true, record };
}

/**
 * Resolve companyId from various entity types (deal, listing, buy-request, cart)
 * Used by middleware when companyId is not directly provided in request
 */
async function resolveCompanyIdFromEntity(req: Request): Promise<string | null> {
  const { storage } = await import('../storage');
  const { unlistedCart } = await import('../../shared/schema');
  
  // Try to get from deal
  const dealId = req.params.dealId || req.params.id;
  if (dealId && (req.path.includes('/deals/') || req.path.includes('/deal'))) {
    try {
      const deal = await storage.getUnlistedDealById(dealId);
      if (deal?.companyId) return deal.companyId;
    } catch (e) {
      console.warn('Failed to resolve company from deal:', e);
    }
  }
  
  // Try to get from listing
  const listingId = req.params.listingId || req.body.listingId;
  if (listingId) {
    try {
      const listing = await storage.getSellListingById(listingId);
      if (listing?.companyId) return listing.companyId;
    } catch (e) {
      console.warn('Failed to resolve company from listing:', e);
    }
  }
  
  // Try to get from buy request
  const buyRequestId = req.params.buyRequestId || req.body.buyRequestId;
  if (buyRequestId) {
    try {
      const buyRequest = await storage.getBuyRequestById(buyRequestId);
      if (buyRequest?.companyId) return buyRequest.companyId;
    } catch (e) {
      console.warn('Failed to resolve company from buy request:', e);
    }
  }
  
  // Try to get from cart item (using direct db query since no storage method exists)
  const cartId = req.params.cartId || req.params.id;
  if (cartId && req.path.includes('/cart')) {
    try {
      const [cartItem] = await db
        .select({ companyId: unlistedCart.companyId })
        .from(unlistedCart)
        .where(eq(unlistedCart.id, cartId))
        .limit(1);
      if (cartItem?.companyId) return cartItem.companyId;
    } catch (e) {
      console.warn('Failed to resolve company from cart:', e);
    }
  }
  
  return null;
}

/**
 * Middleware: Require risk disclosure acknowledgment before trade operations
 * Resolves companyId from deal/listing/buy-request if not directly provided
 */
export const requireRiskDisclosure = (tradeType: 'buy' | 'sell') => {
  return async (req: RiskDisclosureRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        });
      }

      // Try direct companyId first, then resolve from entity
      let companyId = req.body.companyId || req.params.companyId;
      
      if (!companyId) {
        companyId = await resolveCompanyIdFromEntity(req);
      }
      
      // If still no companyId, we cannot enforce - fail closed for safety
      if (!companyId) {
        console.warn(`[RiskDisclosure] Could not resolve companyId for ${req.method} ${req.path}`);
        return res.status(400).json({
          success: false,
          error: 'COMPANY_RESOLUTION_FAILED',
          message: 'Could not determine company for risk disclosure verification',
        });
      }

      const { valid, record, reason } = await hasValidRiskAcknowledgment(userId, companyId, tradeType);

      if (!valid) {
        return res.status(403).json({
          success: false,
          error: 'RISK_DISCLOSURE_REQUIRED',
          message: 'You must acknowledge risk disclosures before placing this order',
          reason,
          disclosures: unlistedRiskDisclosureService.formatDisclosuresForDisplay(),
          requiresAcknowledgment: true,
          tradeType,
          companyId,
        });
      }

      req.riskDisclosureAcknowledged = true;
      req.riskDisclosureRecord = record;
      next();
    } catch (error) {
      console.error('Risk disclosure middleware error:', error);
      next(error);
    }
  };
};
