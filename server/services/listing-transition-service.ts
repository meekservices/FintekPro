/**
 * Listing Transition Service
 * 
 * Handles the complete workflow when a company transitions from unlisted to listed status.
 * This includes:
 * - Moving company data from unlisted_companies to stocks table
 * - Updating portfolio holdings to reference new listed instrument
 * - Changing transaction rules from OTC to exchange-based
 * - Notifying affected stakeholders
 * - Maintaining audit trail for regulatory compliance
 */

import { db } from '../db';
import { 
  unlistedCompanies, 
  listedStocks, 
  portfolioHoldings,
  type UnlistedCompany 
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export type ListingStage = 'unlisted' | 'pre_ipo' | 'ipo_announced' | 'ipo_open' | 'listed' | 'delisted';

export interface ListingTransitionRequest {
  companyId: string;
  targetStage: ListingStage;
  listingDate?: Date;
  exchange?: 'NSE' | 'BSE' | 'NSE_BSE';
  stockSymbol?: string;
  ipoPrice?: number;
  listPrice?: number;
  lotSize?: number;
  notes?: string;
  initiatedBy: string;
}

export interface TransitionResult {
  success: boolean;
  companyId: string;
  previousStage: string;
  newStage: string;
  stockId?: string;
  affectedHoldings: number;
  notificationsSent: number;
  auditId: string;
  errors: string[];
  warnings: string[];
}

export interface TransitionAuditEntry {
  id: string;
  companyId: string;
  companyName: string;
  previousStage: string;
  newStage: string;
  stockId?: string;
  exchange?: string;
  stockSymbol?: string;
  ipoPrice?: number;
  listPrice?: number;
  affectedHoldings: number;
  initiatedBy: string;
  initiatedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  errors: string[];
  notes?: string;
}

const transitionAuditLog: TransitionAuditEntry[] = [];

export class ListingTransitionService {
  
  /**
   * Validate if a transition is allowed based on current stage
   */
  private getValidTransitions(currentStage: string): ListingStage[] {
    const transitions: Record<string, ListingStage[]> = {
      'unlisted': ['pre_ipo', 'ipo_announced'],
      'pre_ipo': ['ipo_announced', 'unlisted'],
      'ipo_announced': ['ipo_open', 'pre_ipo'],
      'ipo_open': ['listed', 'ipo_announced'],
      'listed': ['delisted'],
      'delisted': ['unlisted'],
    };
    return transitions[currentStage] || [];
  }

  /**
   * Check if a transition is valid
   */
  isValidTransition(currentStage: string, targetStage: ListingStage): boolean {
    const validTransitions = this.getValidTransitions(currentStage);
    return validTransitions.includes(targetStage);
  }

  /**
   * Get required fields for a specific transition
   */
  getRequiredFieldsForTransition(targetStage: ListingStage): string[] {
    switch (targetStage) {
      case 'ipo_announced':
        return ['ipoPrice'];
      case 'ipo_open':
        return ['ipoPrice', 'lotSize'];
      case 'listed':
        return ['exchange', 'stockSymbol', 'listPrice', 'listingDate'];
      default:
        return [];
    }
  }

  /**
   * Validate transition request has all required fields
   */
  validateTransitionRequest(request: ListingTransitionRequest, currentStage: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.isValidTransition(currentStage, request.targetStage)) {
      errors.push(`Invalid transition from '${currentStage}' to '${request.targetStage}'. Valid transitions: ${this.getValidTransitions(currentStage).join(', ')}`);
    }

    const requiredFields = this.getRequiredFieldsForTransition(request.targetStage);
    for (const field of requiredFields) {
      if (!(request as any)[field]) {
        errors.push(`Field '${field}' is required for transition to '${request.targetStage}'`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute the full listing transition workflow
   */
  async executeTransition(request: ListingTransitionRequest): Promise<TransitionResult> {
    const auditId = nanoid();
    const errors: string[] = [];
    const warnings: string[] = [];
    let affectedHoldings = 0;
    let notificationsSent = 0;
    let stockId: string | undefined;

    // Get current company data
    const [company] = await db.select().from(unlistedCompanies).where(eq(unlistedCompanies.id, request.companyId));
    
    if (!company) {
      return {
        success: false,
        companyId: request.companyId,
        previousStage: 'unknown',
        newStage: request.targetStage,
        affectedHoldings: 0,
        notificationsSent: 0,
        auditId,
        errors: ['Company not found'],
        warnings: [],
      };
    }

    const previousStage = company.listingStage || 'unlisted';

    // Create audit entry
    const auditEntry: TransitionAuditEntry = {
      id: auditId,
      companyId: request.companyId,
      companyName: company.name,
      previousStage,
      newStage: request.targetStage,
      exchange: request.exchange,
      stockSymbol: request.stockSymbol,
      ipoPrice: request.ipoPrice,
      listPrice: request.listPrice,
      affectedHoldings: 0,
      initiatedBy: request.initiatedBy,
      initiatedAt: new Date(),
      status: 'in_progress',
      errors: [],
      notes: request.notes,
    };
    transitionAuditLog.push(auditEntry);

    // Validate transition
    const validation = this.validateTransitionRequest(request, previousStage);
    if (!validation.valid) {
      auditEntry.status = 'failed';
      auditEntry.errors = validation.issues;
      return {
        success: false,
        companyId: request.companyId,
        previousStage,
        newStage: request.targetStage,
        affectedHoldings: 0,
        notificationsSent: 0,
        auditId,
        errors: validation.issues,
        warnings: [],
      };
    }

    try {
      // Execute transition based on target stage
      if (request.targetStage === 'listed') {
        // Full listing transition - create stock entry
        const stockResult = await this.createStockFromUnlisted(company, request);
        if (stockResult.success && stockResult.stockId) {
          stockId = stockResult.stockId;
          auditEntry.stockId = stockId;
          
          // Update portfolio holdings
          const holdingsResult = await this.migratePortfolioHoldings(request.companyId, stockId, company.name);
          affectedHoldings = holdingsResult.updated;
          auditEntry.affectedHoldings = affectedHoldings;
          
          if (holdingsResult.errors.length > 0) {
            warnings.push(...holdingsResult.errors);
          }
          
          // Send notifications
          const notifResult = await this.notifyStakeholders(request.companyId, company.name, request);
          notificationsSent = notifResult.sent;
        } else {
          errors.push(...stockResult.errors);
        }
      }

      // Update company listing stage
      await db.update(unlistedCompanies)
        .set({ 
          listingStage: request.targetStage,
          status: request.targetStage === 'listed' ? 'listed' : company.status,
        })
        .where(eq(unlistedCompanies.id, request.companyId));

      auditEntry.status = 'completed';
      auditEntry.completedAt = new Date();

      return {
        success: true,
        companyId: request.companyId,
        previousStage,
        newStage: request.targetStage,
        stockId,
        affectedHoldings,
        notificationsSent,
        auditId,
        errors,
        warnings,
      };

    } catch (error: any) {
      auditEntry.status = 'failed';
      auditEntry.errors = [error.message];
      
      return {
        success: false,
        companyId: request.companyId,
        previousStage,
        newStage: request.targetStage,
        affectedHoldings: 0,
        notificationsSent: 0,
        auditId,
        errors: [error.message],
        warnings,
      };
    }
  }

  /**
   * Create a stock entry from unlisted company data
   */
  private async createStockFromUnlisted(
    company: UnlistedCompany, 
    request: ListingTransitionRequest
  ): Promise<{ success: boolean; stockId?: string; errors: string[] }> {
    try {
      const stockId = nanoid();
      
      const exchangeInfoData: Record<string, any> = {};
      if (request.exchange === 'NSE' || request.exchange === 'NSE_BSE') {
        exchangeInfoData.nse = { symbol: request.stockSymbol, listed: true };
      }
      if (request.exchange === 'BSE' || request.exchange === 'NSE_BSE') {
        exchangeInfoData.bse = { code: request.stockSymbol, listed: true };
      }

      await db.insert(listedStocks).values({
        id: stockId,
        symbol: request.stockSymbol!,
        companyName: company.name,
        isin: company.isin || null,
        cin: company.cin || null,
        nseCode: (request.exchange === 'NSE' || request.exchange === 'NSE_BSE') ? 'EQ' : null,
        bseCode: (request.exchange === 'BSE' || request.exchange === 'NSE_BSE') ? request.stockSymbol : null,
        sector: this.mapSectorToStockSector(company.sector),
        broadSector: this.mapSectorToStockSector(company.sector),
        industry: company.industry || null,
        marketCap: null,
        currentPrice: request.listPrice?.toString() || null,
        exchangeInfo: exchangeInfoData,
        isActive: true,
      });

      return { success: true, stockId, errors: [] };
    } catch (error: any) {
      return { success: false, errors: [`Failed to create stock: ${error.message}`] };
    }
  }

  /**
   * Map unlisted company sector to stock sector enum
   */
  private mapSectorToStockSector(sector?: string | null): string {
    const sectorMap: Record<string, string> = {
      'Financial Services': 'financial_services',
      'Technology': 'technology',
      'Consumer Services': 'consumer_services',
      'Healthcare': 'healthcare',
      'Manufacturing': 'industrials',
      'Energy': 'energy',
      'Real Estate': 'real_estate',
      'Infrastructure': 'infrastructure',
    };
    return sectorMap[sector || ''] || 'others';
  }

  /**
   * Migrate portfolio holdings from unlisted to listed stock
   */
  private async migratePortfolioHoldings(
    unlistedCompanyId: string, 
    stockId: string,
    companyName: string
  ): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    try {
      // Find all portfolio holdings for this unlisted company
      const holdings = await db.select()
        .from(portfolioHoldings)
        .where(
          and(
            eq(portfolioHoldings.instrumentType, 'unlisted'),
            eq(portfolioHoldings.instrumentId, unlistedCompanyId)
          )
        );

      for (const holding of holdings) {
        try {
          await db.update(portfolioHoldings)
            .set({
              instrumentType: 'stock',
              instrumentId: stockId,
              notes: `Migrated from unlisted (${companyName}) on ${new Date().toISOString()}. Previous unlisted ID: ${unlistedCompanyId}`,
            })
            .where(eq(portfolioHoldings.id, holding.id));
          updated++;
        } catch (holdingError: any) {
          errors.push(`Failed to migrate holding ${holding.id}: ${holdingError.message}`);
        }
      }

      return { updated, errors };
    } catch (error: any) {
      return { updated: 0, errors: [`Failed to query holdings: ${error.message}`] };
    }
  }

  /**
   * Send notifications to affected stakeholders
   * Note: This logs notifications for now - can be connected to actual notification system later
   */
  private async notifyStakeholders(
    companyId: string,
    companyName: string,
    request: ListingTransitionRequest
  ): Promise<{ sent: number; errors: string[] }> {
    let sent = 0;
    const errors: string[] = [];

    try {
      // Find users who have holdings in this company
      const holdings = await db.select({
        userId: portfolioHoldings.userId,
      })
        .from(portfolioHoldings)
        .where(eq(portfolioHoldings.instrumentId, companyId));

      const uniqueUserIds = [...new Set(holdings.map(h => h.userId).filter(Boolean))];

      for (const userId of uniqueUserIds) {
        if (!userId) continue;
        
        // Log notification for now - can integrate with email/SMS service later
        console.log(`[ListingTransition] Notification for user ${userId}: ${companyName} listed on ${request.exchange} as ${request.stockSymbol}`);
        sent++;
      }

      return { sent, errors };
    } catch (error: any) {
      return { sent: 0, errors: [`Failed to send notifications: ${error.message}`] };
    }
  }

  /**
   * Get transition audit log
   */
  getAuditLog(filters?: { companyId?: string; status?: string }): TransitionAuditEntry[] {
    let result = [...transitionAuditLog];
    
    if (filters?.companyId) {
      result = result.filter(e => e.companyId === filters.companyId);
    }
    if (filters?.status) {
      result = result.filter(e => e.status === filters.status);
    }
    
    return result.sort((a, b) => b.initiatedAt.getTime() - a.initiatedAt.getTime());
  }

  /**
   * Get pending companies for listing (pre_ipo or ipo_announced)
   */
  async getPendingListings(): Promise<UnlistedCompany[]> {
    const results = await db.select()
      .from(unlistedCompanies)
      .where(
        sql`${unlistedCompanies.listingStage} IN ('pre_ipo', 'ipo_announced', 'ipo_open')`
      );
    return results;
  }

  /**
   * Get transaction rules based on listing stage
   */
  getTransactionRules(listingStage: string): {
    tradingType: 'otc' | 'exchange';
    settlementDays: number;
    minKycLevel: string;
    requiresDisclosure: boolean;
    escrowRequired: boolean;
  } {
    if (listingStage === 'listed') {
      return {
        tradingType: 'exchange',
        settlementDays: 1, // T+1 settlement
        minKycLevel: 'basic',
        requiresDisclosure: false,
        escrowRequired: false,
      };
    }
    
    // Unlisted/pre-IPO rules
    return {
      tradingType: 'otc',
      settlementDays: 3, // T+3 for unlisted
      minKycLevel: 'enhanced',
      requiresDisclosure: true,
      escrowRequired: true,
    };
  }
}

export const listingTransitionService = new ListingTransitionService();
