import { db } from "../db";
import { disputeCases, reversalLedger, progressiveCommissionLedger, partnerWallets, partnerAuditLogs } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export class CommissionDisputeService {
  private static instance: CommissionDisputeService;

  static getInstance(): CommissionDisputeService {
    if (!this.instance) {
      this.instance = new CommissionDisputeService();
    }
    return this.instance;
  }

  async createDispute(data: {
    transactionId: string;
    raisedByPartnerId: string;
    reasonCode: string;
    description?: string;
  }): Promise<{ success: boolean; dispute?: any; error?: string }> {
    const existing = await db.select().from(disputeCases)
      .where(and(
        eq(disputeCases.transactionId, data.transactionId),
        eq(disputeCases.raisedByPartnerId, data.raisedByPartnerId),
      ));

    const openDisputes = existing.filter(d => d.status === 'OPEN' || d.status === 'UNDER_REVIEW');
    if (openDisputes.length > 0) {
      return { success: false, error: "An active dispute already exists for this transaction" };
    }

    const ledgerEntries = await db.select().from(progressiveCommissionLedger)
      .where(and(
        eq(progressiveCommissionLedger.transactionId, data.transactionId),
        eq(progressiveCommissionLedger.partnerId, data.raisedByPartnerId),
      ));

    if (ledgerEntries.length === 0) {
      return { success: false, error: "No commission entries found for this partner on this transaction" };
    }

    const [dispute] = await db.insert(disputeCases).values({
      transactionId: data.transactionId,
      raisedByPartnerId: data.raisedByPartnerId,
      reasonCode: data.reasonCode,
      description: data.description,
      status: 'OPEN',
    }).returning();

    await db.insert(partnerAuditLogs).values({
      actorId: data.raisedByPartnerId,
      action: "DISPUTE_RAISED",
      entityType: "commission_dispute",
      entityId: dispute.disputeId,
      metadata: { transactionId: data.transactionId, reasonCode: data.reasonCode },
    });

    return { success: true, dispute };
  }

  async updateDisputeStatus(disputeId: string, status: string, resolvedBy: string, resolutionNotes?: string): Promise<{ success: boolean; error?: string }> {
    const [dispute] = await db.select().from(disputeCases)
      .where(eq(disputeCases.disputeId, disputeId));

    if (!dispute) {
      return { success: false, error: "Dispute not found" };
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'REJECTED') {
      return { success: false, error: "Dispute is already closed" };
    }

    await db.update(disputeCases).set({
      status,
      resolvedBy,
      resolutionNotes,
      updatedAt: new Date(),
    }).where(eq(disputeCases.disputeId, disputeId));

    await db.insert(partnerAuditLogs).values({
      actorId: resolvedBy,
      action: `DISPUTE_${status}`,
      entityType: "commission_dispute",
      entityId: disputeId,
      metadata: { previousStatus: dispute.status, newStatus: status, resolutionNotes },
    });

    return { success: true };
  }

  async processReversal(data: {
    transactionId: string;
    partnerId: string;
    disputeId?: string;
    processedBy: string;
  }): Promise<{ success: boolean; reversals?: any[]; error?: string }> {
    const ledgerEntries = await db.select().from(progressiveCommissionLedger)
      .where(and(
        eq(progressiveCommissionLedger.transactionId, data.transactionId),
        eq(progressiveCommissionLedger.partnerId, data.partnerId),
      ));

    if (ledgerEntries.length === 0) {
      return { success: false, error: "No commission entries found for reversal" };
    }

    const existingReversals = await db.select().from(reversalLedger)
      .where(eq(reversalLedger.transactionId, data.transactionId));

    const reversedLedgerIds = new Set(existingReversals.map(r => r.originalLedgerId));

    const toReverse = ledgerEntries.filter(e => !reversedLedgerIds.has(e.ledgerId));
    if (toReverse.length === 0) {
      return { success: false, error: "All entries for this transaction are already reversed" };
    }

    try {
      const reversals = await db.transaction(async (tx) => {
        const results: any[] = [];

        for (const entry of toReverse) {
          const amount = parseFloat(entry.amount?.toString() || '0');

          const wallet = await tx.select().from(partnerWallets)
            .where(eq(partnerWallets.partnerId, data.partnerId))
            .limit(1);

          const walletBalance = wallet.length > 0 ? parseFloat(wallet[0].balance?.toString() || '0') : 0;
          let walletDebited = false;
          let negativeCarry = 0;

          if (walletBalance >= amount) {
            await tx.update(partnerWallets).set({
              balance: sql`${partnerWallets.balance} - ${amount.toFixed(2)}::decimal`,
              totalDebited: sql`${partnerWallets.totalDebited} + ${amount.toFixed(2)}::decimal`,
              lastTransactionAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(partnerWallets.partnerId, data.partnerId));
            walletDebited = true;
          } else if (walletBalance > 0) {
            await tx.update(partnerWallets).set({
              balance: sql`0.00`,
              totalDebited: sql`${partnerWallets.totalDebited} + ${walletBalance.toFixed(2)}::decimal`,
              lastTransactionAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(partnerWallets.partnerId, data.partnerId));
            walletDebited = true;
            negativeCarry = amount - walletBalance;
          } else {
            negativeCarry = amount;
          }

          const [reversal] = await tx.insert(reversalLedger).values({
            originalLedgerId: entry.ledgerId,
            transactionId: data.transactionId,
            partnerId: data.partnerId,
            reversalAmount: amount.toFixed(2),
            reversalType: 'FULL',
            walletDebited,
            negativeCarryForward: negativeCarry.toFixed(2),
            disputeId: data.disputeId,
          }).returning();

          results.push(reversal);
        }

        await tx.insert(partnerAuditLogs).values({
          actorId: data.processedBy,
          action: "COMMISSION_REVERSED",
          entityType: "commission_reversal",
          entityId: data.transactionId,
          metadata: {
            partnerId: data.partnerId,
            disputeId: data.disputeId,
            reversalCount: results.length,
            totalReversed: toReverse.reduce((sum, e) => sum + parseFloat(e.amount?.toString() || '0'), 0),
          },
        });

        return results;
      });

      return { success: true, reversals };
    } catch (e: any) {
      console.error("Reversal processing error:", e);
      return { success: false, error: "Failed to process reversal" };
    }
  }

  async getDisputes(filters: {
    partnerId?: string;
    status?: string;
    transactionId?: string;
    limit?: number;
  } = {}) {
    const conditions: any[] = [];
    if (filters.partnerId) conditions.push(eq(disputeCases.raisedByPartnerId, filters.partnerId));
    if (filters.status) conditions.push(eq(disputeCases.status, filters.status));
    if (filters.transactionId) conditions.push(eq(disputeCases.transactionId, filters.transactionId));

    const query = conditions.length > 0
      ? db.select().from(disputeCases).where(and(...conditions))
      : db.select().from(disputeCases);

    return query.orderBy(desc(disputeCases.createdAt)).limit(filters.limit || 100);
  }

  async getDisputeById(disputeId: string) {
    const [dispute] = await db.select().from(disputeCases)
      .where(eq(disputeCases.disputeId, disputeId));
    return dispute || null;
  }

  async getReversals(transactionId: string) {
    return db.select().from(reversalLedger)
      .where(eq(reversalLedger.transactionId, transactionId))
      .orderBy(desc(reversalLedger.createdAt));
  }
}

export const commissionDisputeService = CommissionDisputeService.getInstance();
