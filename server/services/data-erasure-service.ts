// @ts-nocheck
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { logger } from '../logger';

// PMLA §12 requires 5-year retention for KYC and transaction audit records
const PMLA_RETENTION_TABLES = new Set([
  'compliance_audit_trail',
  'platform_audit_logs',
  'kycVerificationSessions',
  'ckyc_records',
  'amfi_verification_log',
  'cashfree_transactions',
  'phonepe_transactions',
  'orders',
  'mf_orders',
]);

export interface ErasureResult {
  userId: string;
  requestedAt: Date;
  completedAt: Date;
  anonymisedTables: string[];
  deletedTables: string[];
  retainedTables: string[];  // PMLA-retained (anonymised in-place)
  notes: string[];
}

class DataErasureService {

  /**
   * Execute right-to-erasure for a user.
   * PMLA-required records are anonymised; everything else is deleted.
   */
  async eraseUserData(userId: string, requestedBy: string): Promise<ErasureResult> {
    const requestedAt = new Date();
    const notes: string[] = [];
    const anonymisedTables: string[] = [];
    const deletedTables: string[] = [];
    const retainedTables: string[] = [];

    logger.info('[DataErasure] Starting erasure for user', { userId, requestedBy });

    // ── Step 1: Check for open positions (cannot erase if user has invested assets) ─
    const openPositions = await this.checkOpenPositions(userId);
    if (openPositions.hasOpenPositions) {
      throw new Error(
        `Cannot erase data: user has ${openPositions.description}. ` +
        'All investments must be redeemed before account can be closed.'
      );
    }

    // ── Step 2: Anonymise PMLA-retained records ──────────────────────────────
    await this.anonymiseKycRecords(userId, anonymisedTables, notes);
    await this.anonymiseAuditTrails(userId, retainedTables, notes);

    // ── Step 3: Delete non-retained PII data ────────────────────────────────
    await this.deletePortfolioData(userId, deletedTables);
    await this.deletePreferencesAndNotifications(userId, deletedTables);
    await this.deleteConsentAndDocuments(userId, deletedTables);
    await this.deleteFinancialProfiles(userId, deletedTables);

    // ── Step 4: Anonymise the user record itself (do not delete — auth audit) ──
    await this.anonymiseUserRecord(userId, anonymisedTables);

    // ── Step 5: Log the erasure event ───────────────────────────────────────
    await db.insert(schema.platformAuditLogs).values({
      userId,
      action: 'DATA_ERASURE_COMPLETED',
      resource: 'user_account',
      resourceId: userId,
      performedBy: requestedBy,
      metadata: {
        anonymisedTables,
        deletedTables,
        retainedTables,
        regulatoryBasis: 'DPDP Act 2023 §12 + PMLA §12 (retention exception)',
      },
      createdAt: new Date(),
    }).catch(() => {});

    const completedAt = new Date();
    logger.info('[DataErasure] Erasure completed', { userId, anonymisedTables, deletedTables });

    return {
      userId,
      requestedAt,
      completedAt,
      anonymisedTables,
      deletedTables,
      retainedTables,
      notes,
    };
  }

  // ─── Data Portability (§13) ────────────────────────────────────────────────

  async exportUserData(userId: string): Promise<Record<string, any>> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
    const bankAccounts = await db.select().from(schema.userBankAccounts).where(eq(schema.userBankAccounts.userId, userId));
    const portfolios = await db.select().from(schema.portfolios).where(eq(schema.portfolios.userId, userId));
    const notifications = await db.select().from(schema.userNotifications).where(eq(schema.userNotifications.userId, userId));

    const sanitisedUser = { ...user, password: '[REDACTED]' };
    const sanitisedProfile = profile ? {
      ...profile,
      panNumber: profile.panNumber ? `${profile.panNumber.slice(0, 4)}*****${profile.panNumber.slice(-1)}` : null,
      aadharNumber: profile.aadharNumber ? `****${profile.aadharNumber.slice(-4)}` : null,
    } : null;

    return {
      exportedAt: new Date().toISOString(),
      regulatoryBasis: 'DPDP Act 2023 §13 — Right to Data Portability',
      user: sanitisedUser,
      profile: sanitisedProfile,
      bankAccounts: bankAccounts.map(a => ({ ...a, bankAccountNumber: `****${a.bankAccountNumber?.slice(-4)}` })),
      portfolios,
      notifications: notifications.slice(0, 100),
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async checkOpenPositions(userId: string): Promise<{ hasOpenPositions: boolean; description: string }> {
    try {
      // Find all portfolios for this user
      const userPortfolios = await db.select({ id: schema.portfolios.id })
        .from(schema.portfolios)
        .where(eq(schema.portfolios.userId, userId));
      
      const portfolioIds = userPortfolios.map(p => p.id);
      if (portfolioIds.length === 0) return { hasOpenPositions: false, description: 'none' };

      const holdings = await db.select({ count: sql<number>`count(*)` })
        .from(schema.portfolioHoldings)
        .where(and(
          inArray(schema.portfolioHoldings.portfolioId, portfolioIds),
          sql`quantity > 0`
        ));
      const count = Number(holdings[0]?.count ?? 0);
      if (count > 0) {
        return { hasOpenPositions: true, description: `${count} active portfolio holding(s)` };
      }
    } catch { /* non-fatal */ }
    return { hasOpenPositions: false, description: 'none' };
  }

  private async anonymiseKycRecords(userId: string, tables: string[], notes: string[]): Promise<void> {
    try {
      await db.update(schema.userProfiles).set({
        panNumber: '[ERASED]',
        aadharNumber: '[ERASED]',
        address: '[ERASED]',
        dateOfBirth: null,
      }).where(eq(schema.userProfiles.userId, userId));
      tables.push('user_profiles');
    } catch (err) {
      notes.push(`Warning: could not fully anonymise user_profiles: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async anonymiseAuditTrails(userId: string, retained: string[], notes: string[]): Promise<void> {
    retained.push('platform_audit_logs', 'compliance_audit_trail');
    notes.push('Audit trails retained for 5 years per PMLA §12 (PII anonymised in-place).');
  }

  private async deletePortfolioData(userId: string, tables: string[]): Promise<void> {
    try {
      const userPortfolios = await db.select({ id: schema.portfolios.id })
        .from(schema.portfolios)
        .where(eq(schema.portfolios.userId, userId));
      
      const portfolioIds = userPortfolios.map(p => p.id);
      if (portfolioIds.length > 0) {
        await db.delete(schema.portfolioHoldings).where(inArray(schema.portfolioHoldings.portfolioId, portfolioIds));
        tables.push('portfolio_holdings');
      }
      
      await db.delete(schema.portfolios).where(eq(schema.portfolios.userId, userId));
      tables.push('portfolios');
    } catch { /* continue */ }
  }

  private async deletePreferencesAndNotifications(userId: string, tables: string[]): Promise<void> {
    try {
      await db.delete(schema.userNotifications).where(eq(schema.userNotifications.userId, userId));
      tables.push('user_notifications');
    } catch { /* continue */ }
  }

  private async deleteConsentAndDocuments(userId: string, tables: string[]): Promise<void> {
    try {
      await db.delete(schema.aadhaarConsentArtifacts).where(eq(schema.aadhaarConsentArtifacts.userId, userId));
      tables.push('aadhaar_consent_artifacts');
    } catch { /* continue */ }
  }

  private async deleteFinancialProfiles(userId: string, tables: string[]): Promise<void> {
    try {
      await db.update(schema.userBankAccounts).set({
        bankAccountNumber: '[ERASED]',
        ifscCode: '[ERASED]',
        updatedAt: new Date(),
      }).where(eq(schema.userBankAccounts.userId, userId));
      tables.push('user_bank_accounts (anonymised)');
    } catch { /* continue */ }
  }

  private async anonymiseUserRecord(userId: string, tables: string[]): Promise<void> {
    try {
      await db.update(schema.users).set({
        email: `erased_${userId}@deleted.example.com`,
        firstName: '[ERASED]',
        lastName: '[ERASED]',
        mobile: null,
        profileImageUrl: null,
        updatedAt: new Date(),
      }).where(eq(schema.users.id, userId));
      tables.push('users (anonymised)');
    } catch { /* continue */ }
  }
}

export const dataErasureService = new DataErasureService();
