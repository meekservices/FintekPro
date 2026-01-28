/**
 * KYC Portfolio Migration Service
 * 
 * Handles the transition from prospect to registered client:
 * 1. When client completes KYC and grants AA consent
 * 2. Migrate currentPortfolio data to comprehensiveHoldings table
 * 3. Clear prospect holdings to avoid duplicates
 * 4. Enable auto-sync for ongoing AA refreshes
 * 
 * Regulatory Compliance:
 * - Records consent audit trail
 * - SEBI/RBI compliant data handling
 */

import { db } from '../db';
import { 
  prospectClients,
  comprehensiveHoldings,
  users,
  portfolios,
  dataSourceConsents,
  aaConsentSessions,
  type InsertComprehensiveHolding
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { unifiedHoldingsReaderService, type UnifiedHolding } from './unified-holdings-reader-service';

interface MigrationResult {
  success: boolean;
  migratedHoldings: number;
  clearedProspectData: boolean;
  autoSyncEnabled: boolean;
  errors: string[];
}

interface ConsentRecord {
  userId: string;
  dataSource: 'mutual_funds' | 'demat' | 'bank' | 'all';
  consentGiven: boolean;
  ipAddress?: string;
  userAgent?: string;
}

class KycPortfolioMigrationService {
  
  /**
   * Main handler: Called when client completes KYC and grants AA consent
   * This is the orchestrator for the full migration flow
   */
  async onKycComplete(params: {
    prospectId: string;
    userId: string;
    consentRecords: ConsentRecord[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<MigrationResult> {
    const { prospectId, userId, consentRecords, ipAddress, userAgent } = params;
    const errors: string[] = [];
    let migratedHoldings = 0;
    let clearedProspectData = false;
    let autoSyncEnabled = false;

    console.log(`[KycMigration] Starting migration for prospect ${prospectId} -> user ${userId}`);

    try {
      // Step 1: Record all consents for audit trail
      await this.recordConsents(userId, consentRecords, ipAddress, userAgent);

      // Step 2: Get existing prospect holdings
      const prospectHoldings = await unifiedHoldingsReaderService.getHoldings(prospectId);
      console.log(`[KycMigration] Found ${prospectHoldings.length} holdings to migrate`);

      // Step 3: Ensure portfolio exists for the registered user
      const portfolioId = await this.ensureUserPortfolio(userId);

      // Step 4: Migrate holdings to comprehensiveHoldings table
      if (prospectHoldings.length > 0) {
        migratedHoldings = await this.migrateHoldingsToComprehensive(
          userId, 
          portfolioId, 
          prospectHoldings
        );
      }

      // Step 5: Clear prospect's currentPortfolio to avoid duplicates
      await this.clearProspectHoldings(prospectId);
      clearedProspectData = true;

      // Step 6: Enable auto-sync if AA consent was granted
      const hasAAConsent = consentRecords.some(c => c.consentGiven && 
        ['mutual_funds', 'demat', 'all'].includes(c.dataSource));
      
      if (hasAAConsent) {
        autoSyncEnabled = true;
        console.log(`[KycMigration] Auto-sync enabled for user ${userId}`);
      }

      console.log(`[KycMigration] Migration complete: ${migratedHoldings} holdings migrated`);

      return {
        success: true,
        migratedHoldings,
        clearedProspectData,
        autoSyncEnabled,
        errors,
      };

    } catch (error: any) {
      console.error(`[KycMigration] Migration failed:`, error);
      errors.push(error.message);
      
      return {
        success: false,
        migratedHoldings,
        clearedProspectData,
        autoSyncEnabled,
        errors,
      };
    }
  }

  /**
   * Record consent for regulatory audit trail
   */
  private async recordConsents(
    userId: string,
    consents: ConsentRecord[],
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    for (const consent of consents) {
      await db.insert(dataSourceConsents).values({
        userId: userId as any,
        dataSource: consent.dataSource,
        provider: consent.dataSource === 'mutual_funds' ? 'BSE_STAR' : 
                  consent.dataSource === 'demat' ? 'NSDL_CDSL' : 'ALL',
        consentGiven: consent.consentGiven,
        consentPurpose: 'auto_populate_holdings',
        consentText: this.getConsentText(consent.dataSource),
        ipAddress,
        userAgent,
      });
    }
    console.log(`[KycMigration] Recorded ${consents.length} consent records`);
  }

  /**
   * Ensure user has a default portfolio
   */
  private async ensureUserPortfolio(userId: string): Promise<string> {
    const [existing] = await db
      .select({ id: portfolios.id })
      .from(portfolios)
      .where(eq(portfolios.userId, userId))
      .limit(1);

    if (existing) {
      return existing.id;
    }

    const [newPortfolio] = await db.insert(portfolios).values({
      userId,
      name: 'Primary Portfolio',
      isDefault: true,
    }).returning();

    return newPortfolio.id;
  }

  /**
   * Migrate holdings from prospect format to comprehensiveHoldings table
   * with duplicate detection (ISIN + folioNumber)
   */
  private async migrateHoldingsToComprehensive(
    userId: string,
    portfolioId: string,
    holdings: UnifiedHolding[]
  ): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    let inserted = 0;

    for (const holding of holdings) {
      // Duplicate check: same ISIN + folioNumber for this user
      const existingKey = holding.isin && holding.folioNumber;
      if (existingKey) {
        const [duplicate] = await db
          .select({ id: comprehensiveHoldings.id })
          .from(comprehensiveHoldings)
          .where(and(
            eq(comprehensiveHoldings.userId, userId),
            eq(comprehensiveHoldings.isin, holding.isin!),
            eq(comprehensiveHoldings.folio, holding.folioNumber!)
          ))
          .limit(1);

        if (duplicate) {
          console.log(`[KycMigration] Skipping duplicate: ${holding.isin} / ${holding.folioNumber}`);
          continue;
        }
      }

      const record: InsertComprehensiveHolding = {
        portfolioId,
        userId,
        holdingDate: today,
        symbol: holding.symbol || holding.isin || 'UNKNOWN',
        isin: holding.isin,
        assetName: holding.name,
        assetType: holding.assetType,
        assetClass: holding.assetClass,
        quantity: String(holding.quantity || 0),
        avgCostPerUnit: holding.averageCost ? String(holding.averageCost) : undefined,
        currentPrice: holding.currentPrice ? String(holding.currentPrice) : undefined,
        marketValue: String(holding.currentValue || 0),
        costBasis: holding.investedValue ? String(holding.investedValue) : undefined,
        unrealizedGainLoss: holding.unrealizedGain ? String(holding.unrealizedGain) : undefined,
        unrealizedGainLossPercent: holding.unrealizedGainPercent ? String(holding.unrealizedGainPercent) : undefined,
        folio: holding.folioNumber,
        dematAccountNumber: holding.dematAccountNumber,
        depository: holding.depository,
        dataSource: 'migrated_from_prospect',
      };

      await db.insert(comprehensiveHoldings).values(record);
      inserted++;
    }

    return inserted;
  }

  /**
   * Clear prospect holdings after migration
   */
  private async clearProspectHoldings(prospectId: string): Promise<void> {
    await db.update(prospectClients)
      .set({ 
        currentPortfolio: [],
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));
    
    console.log(`[KycMigration] Cleared prospect holdings for ${prospectId}`);
  }

  /**
   * Handler for AA auto-sync refresh
   * Clears existing holdings before fetching fresh data to prevent duplicates
   */
  async onAutoSyncRefresh(userId: string, dataSource: 'mutual_funds' | 'demat' | 'all'): Promise<{
    clearedCount: number;
    readyForFetch: boolean;
  }> {
    console.log(`[KycMigration] Auto-sync refresh triggered for ${userId}, source: ${dataSource}`);

    // Clear existing holdings for this data source
    let clearedCount = 0;

    if (dataSource === 'mutual_funds' || dataSource === 'all') {
      const deleted = await db.delete(comprehensiveHoldings)
        .where(and(
          eq(comprehensiveHoldings.userId, userId),
          eq(comprehensiveHoldings.assetType, 'mutual_fund')
        ))
        .returning();
      clearedCount += deleted.length;
    }

    if (dataSource === 'demat' || dataSource === 'all') {
      const deleted = await db.delete(comprehensiveHoldings)
        .where(and(
          eq(comprehensiveHoldings.userId, userId),
          eq(comprehensiveHoldings.dataSource, 'aa_demat')
        ))
        .returning();
      clearedCount += deleted.length;
    }

    console.log(`[KycMigration] Cleared ${clearedCount} holdings before refresh`);

    return {
      clearedCount,
      readyForFetch: true,
    };
  }

  /**
   * Store fetched holdings from AA after refresh
   * Called by AA service after successful data fetch
   */
  async storeAAFetchedHoldings(
    userId: string,
    portfolioId: string,
    holdings: UnifiedHolding[],
    source: 'aa_mf' | 'aa_demat'
  ): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    let inserted = 0;

    for (const holding of holdings) {
      // Duplicate prevention by ISIN + folio
      if (holding.isin && holding.folioNumber) {
        const [existing] = await db
          .select({ id: comprehensiveHoldings.id })
          .from(comprehensiveHoldings)
          .where(and(
            eq(comprehensiveHoldings.userId, userId),
            eq(comprehensiveHoldings.isin, holding.isin),
            eq(comprehensiveHoldings.folio, holding.folioNumber)
          ))
          .limit(1);

        if (existing) {
          // Update existing instead of inserting duplicate
          await db.update(comprehensiveHoldings)
            .set({
              quantity: String(holding.quantity || 0),
              currentPrice: holding.currentPrice ? String(holding.currentPrice) : undefined,
              marketValue: String(holding.currentValue || 0),
              unrealizedGainLoss: holding.unrealizedGain ? String(holding.unrealizedGain) : undefined,
              lastUpdated: new Date(),
            })
            .where(eq(comprehensiveHoldings.id, existing.id));
          continue;
        }
      }

      await db.insert(comprehensiveHoldings).values({
        portfolioId,
        userId,
        holdingDate: today,
        symbol: holding.symbol || holding.isin || 'UNKNOWN',
        isin: holding.isin,
        assetName: holding.name,
        assetType: holding.assetType,
        assetClass: holding.assetClass,
        quantity: String(holding.quantity || 0),
        avgCostPerUnit: holding.averageCost ? String(holding.averageCost) : undefined,
        currentPrice: holding.currentPrice ? String(holding.currentPrice) : undefined,
        marketValue: String(holding.currentValue || 0),
        costBasis: holding.investedValue ? String(holding.investedValue) : undefined,
        unrealizedGainLoss: holding.unrealizedGain ? String(holding.unrealizedGain) : undefined,
        folio: holding.folioNumber,
        dematAccountNumber: holding.dematAccountNumber,
        depository: holding.depository,
        dataSource: source,
      });
      inserted++;
    }

    console.log(`[KycMigration] Stored ${inserted} holdings from ${source}`);
    return inserted;
  }

  private getConsentText(dataSource: string): string {
    const texts: Record<string, string> = {
      mutual_funds: 'I authorize FintekPro to fetch my mutual fund holdings from CAMS/KFintech via BSE StarMF for portfolio analysis and investment advisory.',
      demat: 'I authorize FintekPro to fetch my demat holdings from NSDL/CDSL via Account Aggregator for portfolio analysis and investment advisory.',
      bank: 'I authorize FintekPro to fetch my bank account details via Account Aggregator for financial planning.',
      all: 'I authorize FintekPro to fetch all my financial data including mutual funds, demat holdings, and bank accounts via Account Aggregator for comprehensive portfolio analysis and investment advisory.',
    };
    return texts[dataSource] || texts.all;
  }
}

export const kycPortfolioMigrationService = new KycPortfolioMigrationService();
